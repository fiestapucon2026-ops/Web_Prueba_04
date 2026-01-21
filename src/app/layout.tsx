import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Festival Pucón 2026",
  description: "Venta oficial de entradas",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased bg-black text-white">
        {children}
      </body>
    </html>
  );
}
