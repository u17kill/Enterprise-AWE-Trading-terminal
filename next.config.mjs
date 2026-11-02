/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.AWE_NEXT_DIST_DIR ? { distDir: process.env.AWE_NEXT_DIST_DIR } : {}),
};

export default nextConfig;
