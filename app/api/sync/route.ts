import {
  authenticate,
  errorResponse,
  pullRecords,
  pushRecords,
  readCredentials,
  type PushRecord,
} from "../../lib/server/server-store";

const noStore = { "cache-control": "no-store" };

export async function GET(request: Request) {
  try {
    const { householdId, auth } = readCredentials(request);
    await authenticate(householdId, auth);
    const since = Number(new URL(request.url).searchParams.get("since")) || 0;
    const records = await pullRecords(householdId, since);
    return Response.json({ records }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const { householdId, auth } = readCredentials(request);
    await authenticate(householdId, auth);
    const body = (await request.json()) as { records?: PushRecord[] };
    await pushRecords(householdId, body.records ?? []);
    return Response.json({ ok: true }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
