import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    // Remove console.log in production, keep console.warn and console.error
    removeConsole: process.env.NODE_ENV === "production" ? {
      exclude: ['error', 'warn']
    } : false,
  },
  /* config options here */
};

export default nextConfig;
