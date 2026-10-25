import Image from "next/image";
import Link from "next/link";

export function Brand() {
  return <Link className="brand" href="/" aria-label="Enterprise AWE Trading Terminal，返回总览看板">
    <span className="brand-emblem"><Image src="/enterprise-awe-logo-light.png" alt="" width={1563} height={1006} priority /></span>
    <span className="brand-wordmark"><strong>Enterprise AWE</strong><small>Trading Terminal</small></span>
  </Link>;
}
