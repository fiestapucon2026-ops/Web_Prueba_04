import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['qrcode'],
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  turbopack: {
    root: process.cwd(),
  },
  // Incluir paquetes que fallan en Vercel (module-not-found) en build
  // qrcode está en serverExternalPackages; no puede estar también en transpilePackages (Next 16/Turbopack)
  transpilePackages: ['react-qr-code', 'html-to-image', 'downloadjs'],
};

export default nextConfig;
