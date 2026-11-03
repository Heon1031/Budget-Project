import { createHousehold, errorResponse } from "../../lib/server-store";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { householdId?: unknown; auth?: unknown };
    await createHousehold(String(body.householdId ?? ""), String(body.auth ?? ""));
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
