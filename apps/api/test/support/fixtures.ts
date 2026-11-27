import { randomUUID } from "node:crypto";
import type { Db } from "./db.js";

// Minimal rows for database-rule tests. Ids are random so tests never collide, and
// most tests run inside a rolled-back transaction anyway.

const tag = () => randomUUID().slice(0, 8);

export async function createUser(db: Db, status = "ACTIVE"): Promise<string> {
  const id = randomUUID();
  const email = `user-${tag()}@example.test`;
  await db.query(
    `INSERT INTO users (id, email, normalized_email, display_name, status, deactivated_at, updated_at)
     VALUES ($1, $2, $2, 'Test user', $3, $4, now())`,
    [id, email, status, status === "DEACTIVATED" ? new Date() : null],
  );
  return id;
}

export async function createSubject(db: Db, name = "Physics"): Promise<string> {
  const id = randomUUID();
  await db.query("INSERT INTO subjects (id, name, slug, updated_at) VALUES ($1, $2, $3, now())", [
    id,
    name,
    `${name.toLowerCase()}-${tag()}`,
  ]);
  return id;
}

export async function createTest(
  db: Db,
  { kind = "FULL", isFreeDemo = false }: { kind?: string; isFreeDemo?: boolean } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO tests (id, title, slug, kind, is_free_demo, updated_at) VALUES ($1, 'Mock', $2, $3, $4, now())",
    [id, `mock-${tag()}`, kind, isFreeDemo],
  );
  return id;
}

export async function createVersion(
  db: Db,
  testId: string,
  { number = 1, timingMode = "SECTION", seconds = 1440 } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO test_versions (id, test_id, version_number, timing_mode, duration_seconds, marking_config, updated_at)
     VALUES ($1, $2, $3, $4, $5, '{"correct":4,"incorrect":-1}', now())`,
    [id, testId, number, timingMode, seconds],
  );
  return id;
}

export async function createSection(
  db: Db,
  versionId: string,
  {
    sortOrder,
    title = `Section ${sortOrder}`,
    seconds = 480,
    subjectId = null as string | null,
  }: {
    sortOrder: number;
    title?: string;
    seconds?: number | null;
    subjectId?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO test_version_sections (id, test_version_id, subject_id, title, sort_order, duration_seconds)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, versionId, subjectId, title, sortOrder, seconds],
  );
  return id;
}

export async function createQuestion(
  db: Db,
  versionId: string,
  {
    order,
    sectionId = null as string | null,
    type = "SINGLE_CHOICE",
    sourceQuestionId = null as string | null,
  }: {
    order: number;
    sectionId?: string | null;
    type?: string;
    sourceQuestionId?: string | null;
  },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO test_version_questions
       (id, test_version_id, section_id, source_question_id, question_order, type,
        prompt_snapshot, answer_key_snapshot, marking_snapshot)
     VALUES ($1, $2, $3, $4, $5, $6, '{"text":"Q"}', '{"key":"a"}', '{"correct":4}')`,
    [id, versionId, sectionId, sourceQuestionId, order, type],
  );
  return id;
}

export async function publish(db: Db, versionId: string): Promise<void> {
  await db.query(
    "UPDATE test_versions SET status = 'PUBLISHED', published_at = now() WHERE id = $1",
    [versionId],
  );
}

/** A published, section-timed three-section test with two questions per section. */
export async function createPublishedSectionalTest(db: Db) {
  const testId = await createTest(db, { kind: "SECTIONAL" });
  const versionId = await createVersion(db, testId);
  const subjects = [
    await createSubject(db, "Physics"),
    await createSubject(db, "Chemistry"),
    await createSubject(db, "Mathematics"),
  ];
  const sections: string[] = [];
  const questions: string[] = [];
  for (const [i, subjectId] of subjects.entries()) {
    const sectionId = await createSection(db, versionId, {
      sortOrder: i + 1,
      subjectId,
      title: `S${i + 1}`,
    });
    sections.push(sectionId);
    questions.push(await createQuestion(db, versionId, { order: i * 2 + 1, sectionId }));
    questions.push(
      await createQuestion(db, versionId, { order: i * 2 + 2, sectionId, type: "NUMERICAL" }),
    );
  }
  await publish(db, versionId);
  return { testId, versionId, subjects, sections, questions };
}

export async function createAttempt(
  db: Db,
  {
    testId,
    versionId,
    userId = null,
    guest = null,
    number = 1,
    status = "IN_PROGRESS",
  }: {
    testId: string;
    versionId: string;
    userId?: string | null;
    guest?: string | null;
    number?: number;
    status?: string;
  },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO test_attempts (id, test_id, test_version_id, user_id, guest_token_hash, status, attempt_number, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + interval '30 minutes', now())`,
    [id, testId, versionId, userId, guest, status, number],
  );
  return id;
}

export async function createPlan(db: Db): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO subscription_plans (id, name, duration_days, price_paise, updated_at) VALUES ($1, 'All access 30', 30, 49900, now())",
    [id],
  );
  return id;
}

export async function createSubscriptionRequest(
  db: Db,
  userId: string,
  planId: string,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO subscription_requests
       (id, user_id, plan_id, requested_duration_days, price_snapshot_paise, payment_method, amount_paid_paise, transaction_reference, updated_at)
     VALUES ($1, $2, $3, 30, 49900, 'UPI', 49900, $4, now())`,
    [id, userId, planId, `UTR-${tag()}`],
  );
  return id;
}

export async function createProduct(db: Db, onHand?: number): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO products (id, sku, slug, title, mrp_paise, selling_price_paise, updated_at) VALUES ($1, $2, $3, 'Book', 50000, 45000, now())",
    [id, `SKU-${tag()}`, `book-${tag()}`],
  );
  if (onHand !== undefined) {
    await db.query(
      "INSERT INTO inventory_balances (id, product_id, on_hand_quantity, updated_at) VALUES ($1, $2, $3, now())",
      [randomUUID(), id, onHand],
    );
  }
  return id;
}

export async function createOrder(db: Db, userId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO orders (id, order_number, user_id, item_subtotal_paise, shipping_paise, total_paise, address_snapshot, updated_at)
     VALUES ($1, $2, $3, 45000, 5000, 50000, '{}', now())`,
    [id, `SV-${tag()}`, userId],
  );
  return id;
}

export async function createPaymentSubmission(
  db: Db,
  orderId: string,
  decision:
    | { status: "SUBMITTED" }
    | { status: "APPROVED"; reviewer: string }
    | { status: "REJECTED"; reviewer: string; reason: string } = { status: "SUBMITTED" },
): Promise<string> {
  const id = randomUUID();
  const reviewer = decision.status === "SUBMITTED" ? null : decision.reviewer;
  const reason = decision.status === "REJECTED" ? decision.reason : null;
  await db.query(
    `INSERT INTO payment_submissions (id, order_id, method, amount_paise, transaction_reference, status, reviewed_by_id, reviewed_at, rejection_reason)
     VALUES ($1, $2, 'UPI', 50000, $3, $4, $5, CASE WHEN $5::uuid IS NULL THEN NULL ELSE now() END, $6)`,
    [id, orderId, `UTR-${tag()}`, decision.status, reviewer, reason],
  );
  return id;
}

export async function createCart(
  db: Db,
  owner: { userId: string } | { guest: string },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "INSERT INTO carts (id, user_id, guest_token_hash, updated_at) VALUES ($1, $2, $3, now())",
    [id, "userId" in owner ? owner.userId : null, "guest" in owner ? owner.guest : null],
  );
  return id;
}

export async function addCartItem(
  db: Db,
  cartId: string,
  productId: string,
  quantity: number,
): Promise<void> {
  await db.query(
    "INSERT INTO cart_items (id, cart_id, product_id, quantity, updated_at) VALUES ($1, $2, $3, $4, now())",
    [randomUUID(), cartId, productId, quantity],
  );
}
