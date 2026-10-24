import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AWE Trading Terminal",
  description: "A clean market overview and chart workspace for your watchlist.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
