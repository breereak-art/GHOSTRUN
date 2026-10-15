import { allowedRequest } from "../../../../../apps/api/security";
import { NextResponse } from "next/server";
import { store } from "../../../../../apps/api/service";
import {
  exportEvidence,
  exportRegression,
} from "../../../../../packages/evidence/index";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!allowedRequest(req))
    return NextResponse.json({ error: "Host rejected" }, { status: 403 });
  const { id } = await params;
  const c = store().get(id);
  if (!c)
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  const url = new URL(req.url),
    ce = c.counterexamples.find(
      (x) => x.id === url.searchParams.get("counterexample"),
    );
  const kind = url.searchParams.get("kind") ?? "campaign";
  if (kind !== "campaign" && !ce)
    return NextResponse.json(
      { error: "Counterexample not found" },
      { status: 404 },
    );
  const body =
    kind === "regression"
      ? exportRegression(c, ce!)
      : kind === "evidence"
        ? exportEvidence(c, ce!)
        : c;
  return NextResponse.json(body, {
    headers: {
      "Content-Disposition":
        'attachment; filename="ghostrun-' + kind + '.json"',
      "Cache-Control": "no-store",
    },
  });
}
