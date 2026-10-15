import { allowedRequest } from "../../../apps/api/security";
import { NextResponse } from "next/server";
import {
  agents,
  categories,
  tools,
  invariantIds,
  campaignSchema,
} from "../../../packages/core/index";
import { registry } from "../../../packages/fault-operators/index";
import { store, launch, busy } from "../../../apps/api/service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!allowedRequest(req))
    return NextResponse.json({ error: "Host rejected" }, { status: 403 });
  return NextResponse.json(
    {
      campaigns: store().list(),
      agents,
      tools,
      invariants: invariantIds,
      categories,
      operators: registry,
      busy: busy(),
      providers: {
        createos: process.env.CREATEOS_SANDBOX_API_KEY
          ? "configured; live verification required"
          : "unconfigured",
        planner:
          process.env.PLANNER_API_KEY &&
          process.env.PLANNER_URL &&
          process.env.PLANNER_MODEL
            ? "configured"
            : "unconfigured",
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(req: Request) {
  if (!allowedRequest(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  try {
    const text = await req.text();
    if (text.length > 16384)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const parsed = campaignSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    return NextResponse.json(launch(parsed.data), { status: 202 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("BUSY") ? 409 : 400 },
    );
  }
}
