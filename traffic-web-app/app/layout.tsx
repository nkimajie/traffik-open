import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import GlobalProvider from "@/lib/context/providers/global-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Traffik — Shop major markets across Nigeria",
  description:
    "Buy clothes, hair, fabrics, shoes, and more from major Nigerian markets — Balogun, Ariaria, Kurmi, Onitsha, and beyond. Every order escrow-protected.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}
