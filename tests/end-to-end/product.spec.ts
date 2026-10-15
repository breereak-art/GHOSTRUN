import { test, expect } from "@playwright/test";
test("creates real campaign, inspects traces, exports evidence and tests reference", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Overview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "New campaign", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create a campaign" }),
  ).toBeVisible();
  await dialog.getByLabel("Execution budget").fill("24");
  for (const cat of ["data", "state", "authorization", "agent", "concurrency"])
    await dialog.getByLabel(cat, { exact: true }).uncheck();
  await dialog.getByRole("button", { name: "Start campaign" }).click();
  await expect(
    page.getByRole("heading", { name: "Execution monitor", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".budget-row")).toContainText("completed", {
    timeout: 30000,
  });
  await page
    .getByRole("button", { name: "Scenario explorer", exact: true })
    .click();
  await page
    .getByPlaceholder("Search scenarios, operators, reasons…")
    .fill("response-lost");
  await page.locator("tbody .cell-button").first().click();
  const inspector = page.getByRole("dialog", { name: "Scenario inspector" });
  await expect(
    inspector.getByRole("heading", { name: "Execution trace" }),
  ).toBeVisible();
  await expect(inspector.locator(".trace")).toContainText("bank.transfer");
  await page.getByRole("button", { name: "Close inspector" }).click();
  await page.getByRole("button", { name: /^Failure evidence/ }).click();
  await page.locator(".evidence-row").first().click();
  const evidence = page.getByRole("dialog", {
    name: "Failure evidence inspector",
  });
  await expect(evidence).toContainText("3 / 3");
  const downloadPromise = page.waitForEvent("download");
  await evidence.getByRole("link", { name: "Evidence JSON" }).click();
  const downloaded = await downloadPromise;
  expect(downloaded.suggestedFilename()).toBe("ghostrun-evidence.json");
  await evidence
    .getByRole("button", { name: "Run hardened reference" })
    .click();
  await expect(page.locator(".budget-row")).toContainText("completed", {
    timeout: 30000,
  });
  await expect(page.locator(".run-row")).toContainText("PASS");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.screenshot({ path: "data/qa-overview.png", fullPage: true });
  await page.getByRole("button", { name: /^Failure evidence/ }).click();
  await page.locator(".evidence-row").first().click();
  await page.screenshot({ path: "data/qa-evidence.png", fullPage: true });
});
test("API rejects arbitrary target and cross-origin mutation", async ({
  request,
}) => {
  const bad = await request.post("/api/campaigns", {
    data: { agentVersion: "../../evil.js" },
  });
  expect(bad.status()).toBe(400);
  const cross = await request.post("/api/campaigns", {
    headers: { Origin: "https://hostile.example" },
    data: {},
  });
  expect(cross.status()).toBe(403);
});
test("responsive navigation and empty search", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page
    .getByRole("button", { name: "Scenario explorer", exact: true })
    .click();
  await page
    .getByPlaceholder("Search scenarios, operators, reasons…")
    .fill("no-such-scenario");
  await expect(page.getByText("No scenarios match this search.")).toBeVisible();
  await page.screenshot({ path: "data/qa-mobile.png", fullPage: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("connection failure is visible and retry restores real data", async ({
  page,
}) => {
  await page.route("**/api/campaigns", (route) => route.abort("failed"));
  await page.goto("/");
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch" }),
  ).toBeVisible();
  await page.unroute("**/api/campaigns");
  await page.getByRole("button", { name: "Retry / dismiss" }).click();
  await expect(page.getByText("Experiments executed")).toBeVisible();
});
