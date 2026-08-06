import { withBotId } from "botid/next/config";
import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  cacheComponents: true,
  turbopack: {
    resolveAlias: {
      "zlib-sync": "./lib/shims/zlib-sync.js",
    },
  },
  webpack(config) {
    if (!config.resolve) {
      config.resolve = { alias: {} };
    }

    if (!config.resolve.alias) {
      config.resolve.alias = {};
    }

    config.resolve.alias["zlib-sync"] = path.resolve(
      import.meta.dirname,
      "lib/shims/zlib-sync.js"
    );

    return config;
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.ngrok-free.app",
        "*.ngrok.app",
        "*.ngrok.io",
        "localhost:3000",
      ],
    },
  },
  outputFileTracingIncludes: {
    "/api/**": ["./.wiki/**/*.md", "./.agents/skills/**/*.md"],
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        protocol: "https",
        // https://nextjs.org/docs/messages/next-image-unconfigured-host
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default withBotId(nextConfig);
