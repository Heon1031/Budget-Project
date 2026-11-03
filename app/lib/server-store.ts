// cloudflare:workers는 Worker 안에서만 있다. 화면 시험(Node)에서도 이 파일을 불러올 수 있게 쓸 때 가져온다.
async function database() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}

// 서버는 암호화된 글자를 맡아 두고 돌려줄 뿐이다. 내용을 풀 열쇠는 폰에만 있다.

const ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const AUTH_PATTERN = /^[0-9a-f]{64}$/;
const RECORD_ID_PATTERN = /^[a-z]+(:[A-Za-z0-9_-]{1,40})?$/;
const MAX_FAILS = 10;
const LOCK_MS = 15 * 60 * 1000;
const MAX_BLOB = 64 * 1024;
const MAX_PUSH = 200;

export type StoredRecord = { id: string; blob: string | null; deleted: number; seq: number };
export type PushRecord = { id: string; blob: string | null; deleted: boolean };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// 길이가 같은 두 글자를 처음부터 끝까지 비교해서, 걸린 시간으로 맞는 글자 수를 짐작하지 못하게 한다.
function sameText(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function readCredentials(request: Request) {
  const householdId = request.headers.get("x-household") ?? "";
  const auth = request.headers.get("x-auth") ?? "";
  if (!ID_PATTERN.test(householdId) || !AUTH_PATTERN.test(auth)) {
    throw new HttpError(400, "연결 정보 형식이 맞지 않아요.");
  }
  return { householdId, auth };
}

export async function createHousehold(householdId: string, auth: string) {
  if (!ID_PATTERN.test(householdId) || !AUTH_PATTERN.test(auth)) {
    throw new HttpError(400, "연결 정보 형식이 맞지 않아요.");
  }
  const authHash = await sha256Hex(auth);
  const result = await (await database()).prepare(
    "INSERT INTO households (id, auth_hash, created_at) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING RETURNING id",
  )
    .bind(householdId, authHash, Date.now())
    .first<{ id: string }>();
  if (!result) throw new HttpError(409, "이미 있는 연결 코드예요.");
}

export async function authenticate(householdId: string, auth: string) {
  const row = await (await database()).prepare(
    "SELECT auth_hash, fail_count, locked_until FROM households WHERE id = ?",
  )
    .bind(householdId)
    .first<{ auth_hash: string; fail_count: number; locked_until: number }>();
  // 없는 코드와 틀린 비밀번호를 같은 말로 돌려줘서, 어떤 코드가 있는지 알아내지 못하게 한다.
  if (!row) throw new HttpError(401, "연결 코드나 비밀번호가 맞지 않아요.");

  const now = Date.now();
  if (row.locked_until > now) {
    const minutes = Math.ceil((row.locked_until - now) / 60_000);
    throw new HttpError(429, `비밀번호를 여러 번 틀려서 잠겼어요. ${minutes}분 뒤에 다시 해 주세요.`);
  }

  if (!sameText(await sha256Hex(auth), row.auth_hash)) {
    const fails = row.fail_count + 1;
    const locked = fails >= MAX_FAILS;
    await (await database()).prepare("UPDATE households SET fail_count = ?, locked_until = ? WHERE id = ?")
      .bind(locked ? 0 : fails, locked ? now + LOCK_MS : 0, householdId)
      .run();
    throw new HttpError(401, "연결 코드나 비밀번호가 맞지 않아요.");
  }

  if (row.fail_count > 0) {
    await (await database()).prepare("UPDATE households SET fail_count = 0 WHERE id = ?").bind(householdId).run();
  }
}

export async function pullRecords(householdId: string, since: number) {
  const { results } = await (await database()).prepare(
    "SELECT id, blob, deleted, seq FROM records WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT 1000",
  )
    .bind(householdId, since)
    .all<StoredRecord>();
  return results;
}

export async function pushRecords(householdId: string, records: PushRecord[]) {
  if (!Array.isArray(records) || records.length === 0 || records.length > MAX_PUSH) {
    throw new HttpError(400, "보낼 기록 수가 맞지 않아요.");
  }
  for (const record of records) {
    if (typeof record?.id !== "string" || !RECORD_ID_PATTERN.test(record.id)) {
      throw new HttpError(400, "기록 이름 형식이 맞지 않아요.");
    }
    if (!record.deleted && (typeof record.blob !== "string" || record.blob.length > MAX_BLOB)) {
      throw new HttpError(400, "기록 내용이 비었거나 너무 커요.");
    }
  }

  // 한 묶음(batch)은 한꺼번에 처리되므로 순번이 겹치지 않는다.
  const db = await database();
  const statements = records.map((record) =>
    db.prepare(
      `INSERT INTO records (household_id, id, blob, deleted, seq)
       VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(seq), 0) + 1 FROM records WHERE household_id = ?1))
       ON CONFLICT (household_id, id) DO UPDATE SET
         blob = excluded.blob, deleted = excluded.deleted, seq = excluded.seq`,
    ).bind(householdId, record.id, record.deleted ? null : record.blob, record.deleted ? 1 : 0),
  );
  await db.batch(statements);
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "";
  if (message.includes("no such table")) {
    return Response.json(
      { error: "서버 저장소가 아직 준비되지 않았어요. `npm run db:local` 또는 `npm run db:remote`를 실행해 주세요." },
      { status: 503 },
    );
  }
  console.error(error);
  return Response.json({ error: "서버에서 문제가 생겼어요." }, { status: 500 });
}
