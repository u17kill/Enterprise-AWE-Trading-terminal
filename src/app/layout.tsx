import type { Metadata } from "next";
import "./globals.css";
import "./chart-workspace.css";
import "./financial-calendar.css";
import "./brand.css";
import "./market-news.css";
import "./leader-holdings.css";
import "./options-calculator.css";
import "./master-philosophy.css";
import "./canary.css";
import "./investment-framework.css";
import "./fund-charter.css";

export const metadata: Metadata = {
  title: "Enterprise AWE Trading Terminal",
  description: "A clean market overview and chart workspace for your watchlist.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
