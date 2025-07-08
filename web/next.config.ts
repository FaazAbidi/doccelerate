import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  env: {
    // Make environment variables available to the client
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  },
  // Enable experimental features if needed
  experimental: {
    // Add any experimental features here
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      components: require('path').join(__dirname, 'app/components'),
    };
    return config;
  },
};

export default nextConfig;
