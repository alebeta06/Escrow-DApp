import type { Metadata } from "next";
import "./globals.css";
import { EthereumProvider } from "@/lib/ethereum";

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
      <body className="antialiased">
        <EthereumProvider>{children}</EthereumProvider>
      </body>
    </html>
  );
}
