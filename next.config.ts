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
  // qrcode en serverExternalPackages para PDF (server). TicketCard ya no usa react-qr-code/html-to-image.
};

export default nextConfig;
