import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mergeGuestCart, mergeGuestCartSteps } from "../support/cart-merge.js";
import {
  connectAsApp,
  expectAccepted,
  expectRefused,
  inRollback,
  waitUntilBlocked,
  type Db,
} from "../support/db.js";
import { addCartItem, createCart, createProduct, createUser } from "../support/fixtures.js";

// Approval condition D: one active cart per guest, historical carts kept, merged carts
// marked MERGED, and a transactional, idempotent merge.

describe("carts", () => {
  it("allows one ACTIVE cart per guest token and per learner", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      const insert =
        "INSERT INTO carts (id, user_id, guest_token_hash, updated_at) VALUES (gen_random_uuid(), $1, $2, now())";
      await expectAccepted(db, insert, [null, "g"]);
      await expectRefused(db, insert, /carts_one_active_per_guest/, [null, "g"]);
      await expectAccepted(db, insert, [learner, null]);
      await expectRefused(db, insert, /carts_one_active_per_user/, [learner, null]);
    });
  });

  it("keeps historical carts and lets the same guest token start a new one", async () => {
    await inRollback(async (db) => {
      const old = await createCart(db, { guest: "g" });
      await db.query("UPDATE carts SET status = 'ABANDONED' WHERE id = $1", [old]);
      await createCart(db, { guest: "g" });
      const { rows } = await db.query(
        "SELECT status FROM carts WHERE guest_token_hash = 'g' ORDER BY created_at, status",
      );
      expect(rows.map((r: { status: string }) => r.status).toSorted()).toEqual([
        "ABANDONED",
        "ACTIVE",
      ]);
    });
  });

  it("requires exactly one owner, and MERGED exactly when a merge target is set", async () => {
    await inRollback(async (db) => {
      const learner = await createUser(db);
      const target = await createCart(db, { userId: learner });
      await expectRefused(
        db,
        "INSERT INTO carts (id, updated_at) VALUES (gen_random_uuid(), now())",
        /carts_exactly_one_owner_check/,
      );
      const insert =
        "INSERT INTO carts (id, guest_token_hash, status, merged_into_cart_id, updated_at) VALUES ($1, 'g2', $2, $3, now())";
      await expectRefused(db, insert, /carts_merge_target_check/, [randomUUID(), "MERGED", null]);
      await expectRefused(db, insert, /carts_merge_target_check/, [
        randomUUID(),
        "ABANDONED",
        target,
      ]);
      const self = randomUUID();
      await expectRefused(db, insert, /carts_merge_target_check|violates foreign key/, [
        self,
        "MERGED",
        self,
      ]);
    });
  });
});

describe("guest cart merge (committed transactions)", () => {
  let db: Db;
  let other: Db | undefined;
  let learner: string;
  let [bookA, bookB, bookC] = ["", "", ""];

  beforeEach(async () => {
    db = await connectAsApp();
    learner = await createUser(db);
    [bookA, bookB, bookC] = [
      await createProduct(db),
      await createProduct(db),
      await createProduct(db),
    ];
  });

  afterEach(async () => {
    await db.end();
    await other?.end();
    other = undefined;
  });

  const itemsOf = async (cartId: string) =>
    Object.fromEntries(
      (
        await db.query<{ product_id: string; quantity: number }>(
          "SELECT product_id, quantity FROM cart_items WHERE cart_id = $1",
          [cartId],
        )
      ).rows.map((r) => [r.product_id, r.quantity]),
    );

  it("merges into the learner's cart with the larger quantity, keeps the guest cart as MERGED", async () => {
    const mine = await createCart(db, { userId: learner });
    await addCartItem(db, mine, bookA, 1);
    await addCartItem(db, mine, bookB, 5);
    const guestToken = `g-${randomUUID()}`;
    const guest = await createCart(db, { guest: guestToken });
    await addCartItem(db, guest, bookA, 3);
    await addCartItem(db, guest, bookB, 2);
    await addCartItem(db, guest, bookC, 1);

    expect(await mergeGuestCart(db, guest, learner)).toBe("merged");
    expect(await itemsOf(mine)).toEqual({ [bookA]: 3, [bookB]: 5, [bookC]: 1 });
    const merged = await db.query(
      "SELECT status, merged_into_cart_id, guest_token_hash FROM carts WHERE id = $1",
      [guest],
    );
    expect(merged.rows[0]).toEqual({
      status: "MERGED",
      merged_into_cart_id: mine,
      guest_token_hash: guestToken,
    });
    // The guest cart's items remain as the historical record; nothing is lost.
    expect(await itemsOf(guest)).toEqual({ [bookA]: 3, [bookB]: 2, [bookC]: 1 });
  });

  it("creates the learner's cart when there is none", async () => {
    const guest = await createCart(db, { guest: `g-${randomUUID()}` });
    await addCartItem(db, guest, bookA, 2);
    await mergeGuestCart(db, guest, learner);
    const { rows } = await db.query<{ id: string }>(
      "SELECT id FROM carts WHERE user_id = $1 AND status = 'ACTIVE'",
      [learner],
    );
    expect(rows).toHaveLength(1);
    expect(await itemsOf(rows[0].id)).toEqual({ [bookA]: 2 });
  });

  it("is idempotent: a retried login changes nothing", async () => {
    const mine = await createCart(db, { userId: learner });
    await addCartItem(db, mine, bookA, 1);
    const guest = await createCart(db, { guest: `g-${randomUUID()}` });
    await addCartItem(db, guest, bookA, 2);
    expect(await mergeGuestCart(db, guest, learner)).toBe("merged");
    expect(await mergeGuestCart(db, guest, learner)).toBe("already-merged");
    expect(await mergeGuestCart(db, guest, learner)).toBe("already-merged");
    expect(await itemsOf(mine)).toEqual({ [bookA]: 2 });
  });

  it("is safe under two concurrent merges: the second waits for the first, then does nothing", async () => {
    other = await connectAsApp();
    const mine = await createCart(db, { userId: learner });
    await addCartItem(db, mine, bookA, 1);
    const guest = await createCart(db, { guest: `g-${randomUUID()}` });
    await addCartItem(db, guest, bookA, 4);
    await addCartItem(db, guest, bookB, 1);

    // Session 1 performs the merge but hasn't committed yet; session 2 merges the same
    // guest cart (a double-submitted login) and must wait on the guest cart's lock.
    await db.query("BEGIN");
    expect(await mergeGuestCartSteps(db, guest, learner)).toBe("merged");
    const otherPid = (await other.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]
      .pid;
    const second = mergeGuestCart(other, guest, learner);
    await waitUntilBlocked(db, otherPid);
    await db.query("COMMIT");

    expect(await second).toBe("already-merged");
    expect(await itemsOf(mine)).toEqual({ [bookA]: 4, [bookB]: 1 });
  });

  it("rolls back completely if the merge fails part-way", async () => {
    const mine = await createCart(db, { userId: learner });
    await addCartItem(db, mine, bookA, 1);
    const guest = await createCart(db, { guest: `g-${randomUUID()}` });
    await addCartItem(db, guest, bookA, 3);
    await db.query("BEGIN");
    await mergeGuestCartSteps(db, guest, learner);
    await db.query("ROLLBACK"); // e.g. the request failed after step 4
    const status = await db.query("SELECT status FROM carts WHERE id = $1", [guest]);
    expect(status.rows[0]).toEqual({ status: "ACTIVE" });
    expect(await itemsOf(mine)).toEqual({ [bookA]: 1 });
    expect(await mergeGuestCart(db, guest, learner)).toBe("merged");
    expect(await itemsOf(mine)).toEqual({ [bookA]: 3 });
  });
});
