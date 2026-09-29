import type { NextConfig } from "next";

const nextConfig: NextConfig = {
// Configures external image domains for the <Image /> component
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
    ],
  },
  allowedDevOrigins: ['172.21.37.63'],
};

export default nextConfig;
