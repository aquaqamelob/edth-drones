import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  
  // Mark geoip-lite as external to avoid build-time data file issues
  serverExternalPackages: ['geoip-lite'],
  
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'camera=*, microphone=*, geolocation=*, accelerometer=*, gyroscope=*, magnetometer=*',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
