import Link from "next/link";

export default function NotFound() {
  return <div className="not-found"><span className="section-eyebrow">SYMBOL NOT FOUND</span><h1>没有找到这个资产</h1><p>请回到总览看板，从精选资产目录中选择一个代码。</p><Link href="/">← 返回总览看板</Link></div>;
}
