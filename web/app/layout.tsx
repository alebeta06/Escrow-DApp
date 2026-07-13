import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Escrow DApp",
  description: "Atomic ERC20 escrow — CodeCrypto M9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
