import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  poweredByHeader: false,
  outputFileTracingRoot: process.cwd(),
};
export default config;
