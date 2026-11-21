import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: "32px 16px", background: "#f4f6fb", color: "#132034" }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 13, letterSpacing: ".18em", textTransform: "uppercase", color: "#5a6b85" }}>404</p>
        <h1 style={{ margin: "14px 0 12px", fontSize: "clamp(34px, 7vw, 56px)", lineHeight: 1.05, letterSpacing: "-.03em" }}>This page took a different route.</h1>
        <p style={{ margin: "0 0 28px", fontSize: 17, lineHeight: 1.55, color: "#4a5a72" }}>The address may be old or mistyped. The work and the story are a click away.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/" style={{ padding: "12px 22px", borderRadius: 999, background: "#132034", color: "#fff", textDecoration: "none", fontWeight: 600 }}>Home</Link>
          <Link href="/#work" style={{ padding: "12px 22px", borderRadius: 999, background: "#fff", color: "#132034", textDecoration: "none", fontWeight: 600, boxShadow: "inset 0 0 0 1px rgba(19,32,52,.14)" }}>See the work</Link>
          <Link href="/about" style={{ padding: "12px 22px", borderRadius: 999, background: "#fff", color: "#132034", textDecoration: "none", fontWeight: 600, boxShadow: "inset 0 0 0 1px rgba(19,32,52,.14)" }}>About</Link>
        </div>
      </div>
    </main>
  );
}
