import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Melwa Credit Ledger",
  description: "Melwa Credit Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#fdecec]">
        <div className="flex-1 flex flex-col">{children}</div>
        <footer className="py-6 text-center text-xs text-muted-foreground">
          © 2026 ProferCode (Pvt) Ltd. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
