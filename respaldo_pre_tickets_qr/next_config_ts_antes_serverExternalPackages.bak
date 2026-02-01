import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  turbopack: {
    root: process.cwd(),
  },
  // Incluir paquetes que fallan en Vercel (module-not-found) en build
  transpilePackages: ['react-qr-code', 'html-to-image', 'downloadjs', 'qrcode'],
};

export default nextConfig;
