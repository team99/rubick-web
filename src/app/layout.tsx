import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rubick — Rumah123 Data Assistant",
  description: "Ask natural language questions about Rumah123 data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <body className="h-full bg-[#FAFAF8] dark:bg-[#1A1A1A] text-[#1A1A1A] dark:text-[#E8E8E8] antialiased">
        {children}
      </body>
    </html>
  );
}
