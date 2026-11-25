import type { Db } from "./db.js";

/**
 * Reference implementation of the guest cart merge documented in prisma/README.md
 * ("Guest cart merge"). The bookstore service will implement the same steps; this
 * version exists so the database's support for them is tested now.
 */
/**
 * The merge steps, inside a transaction the caller has already opened. Returns
 * "already-merged" when the guest cart is no longer ACTIVE (retry or concurrent merge).
 */
export async function mergeGuestCartSteps(
  db: Db,
  guestCartId: string,
  userId: string,
): Promise<"merged" | "already-merged"> {
  // 1. Lock the guest cart. A retried or concurrent merge waits here, then sees MERGED.
  const guest = await db.query<{ status: string }>(
    "SELECT status FROM carts WHERE id = $1 FOR UPDATE",
    [guestCartId],
  );
  if (guest.rows[0]?.status !== "ACTIVE") return "already-merged";

  // 2. The learner's single ACTIVE cart, created if needed (the partial unique index
  //    serializes concurrent creation).
  await db.query(
    `INSERT INTO carts (id, user_id, updated_at) VALUES (gen_random_uuid(), $1, now())
     ON CONFLICT (user_id) WHERE status = 'ACTIVE' AND user_id IS NOT NULL DO NOTHING`,
    [userId],
  );
  const target = await db.query<{ id: string }>(
    "SELECT id FROM carts WHERE user_id = $1 AND status = 'ACTIVE' FOR UPDATE",
    [userId],
  );
  const targetId = target.rows[0].id;

  // 3. Copy items; for a book in both carts keep the larger quantity (prototype rule).
  await db.query(
    `INSERT INTO cart_items (id, cart_id, product_id, quantity, updated_at)
     SELECT gen_random_uuid(), $1, product_id, quantity, now() FROM cart_items WHERE cart_id = $2
     ON CONFLICT (cart_id, product_id)
     DO UPDATE SET quantity = GREATEST(cart_items.quantity, EXCLUDED.quantity), updated_at = now()`,
    [targetId, guestCartId],
  );

  // 4. Mark the guest cart MERGED; its items stay as the historical record.
  await db.query(
    "UPDATE carts SET status = 'MERGED', merged_into_cart_id = $1, updated_at = now() WHERE id = $2",
    [targetId, guestCartId],
  );
  return "merged";
}

/** The whole merge in its own transaction, as the sign-in flow will run it. */
export async function mergeGuestCart(
  db: Db,
  guestCartId: string,
  userId: string,
): Promise<"merged" | "already-merged"> {
  await db.query("BEGIN");
  try {
    const outcome = await mergeGuestCartSteps(db, guestCartId, userId);
    await db.query("COMMIT");
    return outcome;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}
