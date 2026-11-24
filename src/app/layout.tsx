import type { Metadata } from "next";
import { IntelligenceHashRoute } from '../components/intelligence-hash-route';
import "./globals.css";
import "./chart-workspace.css";
import "./brand.css";
import "./options-calculator.css";
import "./master-philosophy.css";
import "./canary.css";
import "./canary-page-nav.css";
import "./intelligence-page-nav.css";
import "./investment-framework.css";
import "./fund-charter.css";
import "./sitewide-ui.css";
import "./market-overview.css";

export const metadata: Metadata = {
  title: "Enterprise AWE Trading Terminal",
  description: "A clean market overview and chart workspace for your watchlist.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body><IntelligenceHashRoute/>{children}</body></html>;
}
