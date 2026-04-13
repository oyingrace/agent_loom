import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";

import { Header } from "@/components/layout/Header";
import { QueryProvider } from "@/context/query-client";
import { ThemeProvider } from "@/context/theme";
import { UserProvider } from "@/context/user";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
});

export const metadata: Metadata = {
  title: "Agent Loom",
  description:
    "Stellar-native paid proxies, MCP, and workflows for AI agents (testnet-first)."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <ThemeProvider>
          <QueryProvider>
            <UserProvider>
              <Header />
              <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
            </UserProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
