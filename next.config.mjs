/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  env: {
    NEXT_PUBLIC_DB_URL: process.env.NEXT_PUBLIC_DB_URL,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY,
    NEXT_PUBLIC_WEB3_AUTH_CLIENT_ID:
      process.env.NEXT_PUBLIC_WEB3_AUTH_CLIENT_ID,
  },
};

export default nextConfig;
