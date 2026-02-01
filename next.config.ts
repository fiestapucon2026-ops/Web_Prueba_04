import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  // Fija la raíz del proyecto para evitar que Turbopack use un lockfile padre (fallo en Vercel)
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
