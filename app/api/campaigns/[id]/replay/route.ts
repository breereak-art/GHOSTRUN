import { allowedRequest } from "../../../../../apps/api/security";
import { NextResponse } from "next/server";
import { z } from "zod";
import { store, launch } from "../../../../../apps/api/service";
export const runtime = "nodejs";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!allowedRequest(req))
    return NextResponse.json({ error: "Origin rejected" }, { status: 403 });
  try {
    const { id } = await params,
      c = store().get(id);
    if (!c)
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 },
      );
    const raw = await req.text();
    if (raw.length > 4096)
      return NextResponse.json({ error: "Request too large" }, { status: 413 });
    const input = z
      .object({ scenarioId: z.string().max(100), hardened: z.boolean() })
      .strict()
      .parse(JSON.parse(raw));
    const w = c.candidates.find((x) => x.world.id === input.scenarioId)?.world;
    if (!w)
      return NextResponse.json(
        { error: "Scenario not found" },
        { status: 404 },
      );
    return NextResponse.json(
      launch(
        {
          ...c.config,
          budget: 1,
          planner: "deterministic",
          agentVersion: input.hardened ? "payment-hardened@1" : w.agentVersion,
        },
        w,
      ),
      { status: 202 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid replay";
    return NextResponse.json(
      { error: message },
      { status: message.startsWith("BUSY") ? 409 : 400 },
    );
  }
}
