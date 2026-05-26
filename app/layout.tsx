import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Venture Radar",
  description: "VC theme intelligence dashboard for LAUNCH venture research."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
