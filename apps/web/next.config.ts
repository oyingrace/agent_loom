import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    "ioredis",
    "bcrypt",
    "pg",
    "iron-session",
    "@stellar/stellar-base"
  ]
};

export default nextConfig;
