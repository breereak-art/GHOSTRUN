import { mkdirSync, writeFileSync } from "node:fs";
import { newCampaign, executeCampaign } from "../packages/orchestrator/index";
import { localBackend } from "../packages/counterfactual/index";
import { Store } from "../packages/scenario-store/index";
import { exportEvidence, exportRegression } from "../packages/evidence/index";
const store = new Store();
const campaign = newCampaign({
  agentVersion: "payment-vulnerable@1",
  categories: ["network"],
  budget: 24,
  depth: 2,
  seed: 7,
  backend: "trusted-local",
});
await executeCampaign(campaign, localBackend, (c) => store.save(c));
mkdirSync("data/exports", { recursive: true });
for (const ce of campaign.counterexamples.filter(
  (c) => c.status === "confirmed",
)) {
  writeFileSync(
    "data/exports/" + ce.id + ".evidence.json",
    JSON.stringify(exportEvidence(campaign, ce), null, 2),
  );
  writeFileSync(
    "data/exports/" + ce.id + ".regression.json",
    JSON.stringify(exportRegression(campaign, ce), null, 2),
  );
}
console.log(
  JSON.stringify(
    {
      campaignId: campaign.id,
      status: campaign.status,
      executions: campaign.runs.length,
      confirmed: campaign.counterexamples.filter(
        (x) => x.status === "confirmed",
      ).length,
      verdicts: campaign.runs.map((r) => ({
        purpose: r.purpose,
        verdict: r.verdict,
        scenario: r.scenarioId,
      })),
    },
    null,
    2,
  ),
);
store.close();
if (
  campaign.status !== "completed" ||
  !campaign.counterexamples.some((c) => c.status === "confirmed")
)
  process.exitCode = 1;
