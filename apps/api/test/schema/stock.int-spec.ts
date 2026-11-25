import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  connectAsApp,
  expectAccepted,
  expectRefused,
  inRollback,
  scalar,
  waitUntilBlocked,
  type Db,
} from "../support/db.js";
import { createOrder, createProduct, createUser } from "../support/fixtures.js";

// Bookstore stock reservations (§10.4): the database must make overselling impossible.

const RESERVE = `UPDATE inventory_balances
  SET reserved_quantity = reserved_quantity + $2, version = version + 1, updated_at = now()
  WHERE product_id = $1 AND on_hand_quantity - reserved_quantity >= $2
  RETURNING reserved_quantity`;

describe("stock reservations", () => {
  it("never lets reserved stock exceed stock on hand, even with an unguarded update", async () => {
    await inRollback(async (db) => {
      const book = await createProduct(db, 2);
      await expectRefused(
        db,
        "UPDATE inventory_balances SET reserved_quantity = 3 WHERE product_id = $1",
        /inventory_balances_valid_quantity_check/,
        [book],
      );
      await expectRefused(
        db,
        "UPDATE inventory_balances SET on_hand_quantity = -1 WHERE product_id = $1",
        /inventory_balances_valid_quantity_check/,
        [book],
      );
    });
  });

  it("records one reservation per order and product, with a positive quantity", async () => {
    await inRollback(async (db) => {
      const book = await createProduct(db, 5);
      const order = await createOrder(db, await createUser(db));
      const insert =
        "INSERT INTO stock_reservations (id, order_id, product_id, quantity, updated_at) VALUES (gen_random_uuid(), $1, $2, $3, now())";
      await expectAccepted(db, insert, [order, book, 1]);
      await expectRefused(db, insert, /stock_reservations_order_id_product_id_key/, [
        order,
        book,
        1,
      ]);
      await expectRefused(
        db,
        insert,
        /stock_reservations_valid_quantity_check|stock_reservations_order_id_product_id_key/,
        [order, book, 0],
      );
    });
  });

  it("refuses deleting a product that has inventory history (RESTRICT)", async () => {
    await inRollback(async (db) => {
      const book = await createProduct(db, 1);
      await db.query(
        "INSERT INTO inventory_movements (id, product_id, type, quantity_delta, reason) VALUES (gen_random_uuid(), $1, 'STOCK_ADDED', 1, 'initial')",
        [book],
      );
      await expectRefused(
        db,
        "DELETE FROM products WHERE id = $1",
        /violates (RESTRICT|foreign key)/,
        [book],
      );
    });
  });
});

describe("concurrent reservation of the last copy (committed transactions)", () => {
  let a: Db;
  let b: Db;

  beforeEach(async () => {
    [a, b] = [await connectAsApp(), await connectAsApp()];
  });

  afterEach(async () => {
    await a.end();
    await b.end();
  });

  it("exactly one of two simultaneous orders gets it", async () => {
    const book = await createProduct(a, 1);
    await a.query("BEGIN");
    const first = await a.query(RESERVE, [book, 1]);
    await b.query("BEGIN");
    const bPid = await scalar<number>(b, "SELECT pg_backend_pid()");
    const second = b.query(RESERVE, [book, 1]);
    await waitUntilBlocked(a, bPid); // b waits for a's row lock
    await a.query("COMMIT");
    const secondResult = await second;
    await b.query("COMMIT");
    expect(first.rowCount).toBe(1);
    expect(secondResult.rowCount).toBe(0); // re-checked after the lock: no stock left
    expect(
      await scalar(a, "SELECT reserved_quantity FROM inventory_balances WHERE product_id = $1", [
        book,
      ]),
    ).toBe(1);
  });
});
