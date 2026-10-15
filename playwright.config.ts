import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/end-to-end",
  timeout: 60000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", headless: true },
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: !process.env.CI,
    env: {
      GHOSTRUN_DB: "data/e2e.sqlite",
      CREATEOS_SANDBOX_API_KEY: "",
      PLANNER_API_KEY: "",
    },
    timeout: 120000,
  },
});
