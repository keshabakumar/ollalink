import "./src/env.mjs";
import { withSentryConfig } from "@sentry/nextjs";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@v1/ui", "@v1/backend", "@v1/analytics", "@v1/logger"],
};

let exportedConfig = nextConfig;
if (process.env.SENTRY_AUTH_TOKEN) {
  exportedConfig = withSentryConfig(nextConfig, {
    silent: !process.env.CI,
    telemetry: false,
    widenClientFileUpload: true,
    hideSourceMaps: true,
    disableLogger: true,
    tunnelRoute: "/monitoring",
  });
}

export default exportedConfig;
