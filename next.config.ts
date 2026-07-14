import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Garmin client uses dynamic require()s the bundler can't resolve, so it
  // (and its heavy transitive deps) load from node_modules at runtime. Each dep
  // must be listed here or Vercel's function tracer drops it — the sync endpoint
  // crashed on a missing `axios` until these were externalised + traced.
  serverExternalPackages: [
    "@gooin/garmin-connect",
    "axios",
    "axios-cookiejar-support",
    "tough-cookie",
    "oauth-1.0a",
    "qs",
    "lodash",
    "luxon",
    "form-data",
    "app-root-path",
    "ioredis",
    "redis",
    "@upstash/redis",
  ],
  // Belt-and-suspenders: force the whole dependency tree into the sync function
  // bundle in case the tracer still misses a dynamically-required file.
  outputFileTracingIncludes: {
    "/api/garmin/sync": ["./node_modules/@gooin/**/*", "./node_modules/axios/**/*"],
  },
};

export default nextConfig;
