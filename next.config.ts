import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Garmin client uses dynamic require()s the bundler can't resolve —
  // load it from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["@gooin/garmin-connect"],
};

export default nextConfig;
