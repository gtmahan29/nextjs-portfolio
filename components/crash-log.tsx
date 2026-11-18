"use client";

import { useEffect, useState } from "react";

/**
 * Crash log: tells a tab crash (iOS Safari killing the page for memory and reloading it) apart
 * from a normal reload, and keeps where it happened. Everything stays in this browser.
 *
 * While the page is visible it writes a breadcrumb every second (page, scroll, which 3D scenes
 * are alive). Leaving or hiding the page marks the breadcrumb clean. If the next load finds a
 * breadcrumb that was never marked clean, the page died while on screen: it is saved as a crash.
 * Open any page with ?crashlog to read the last ten.
 */
type Crumb = { at: number; url: string; y: number; height: number; scenes: string; canvases: number; clean: boolean };
const CRUMB = "crash-crumb", LOG = "crash-log";

const read = <T,>(store: Storage, key: string, fallback: T): T => {
  try { const raw = store.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
};
const write = (store: Storage, key: string, value: unknown) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } };

function snapshot(clean: boolean): Crumb {
  const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-scene-state]")).map(s => `${s.id || s.className.split(" ")[0]}:${s.dataset.sceneState}`);
  const canvases = Array.from(document.querySelectorAll("canvas")).filter(c => c.width > 1 && c.height > 1).length;
  return { at: Date.now(), url: location.pathname, y: Math.round(scrollY), height: document.documentElement.scrollHeight, scenes: scenes.join(" "), canvases, clean };
}

export default function CrashLog() {
  const [entries, setEntries] = useState<Crumb[] | null>(null);

  useEffect(() => {
    const last = read<Crumb | null>(sessionStorage, CRUMB, null);
    if (last && !last.clean) {
      const log = read<Crumb[]>(localStorage, LOG, []);
      write(localStorage, LOG, [last, ...log].slice(0, 10));
    }
    const mark = (clean: boolean) => write(sessionStorage, CRUMB, snapshot(clean));
    mark(document.hidden);
    const timer = window.setInterval(() => { if (!document.hidden) mark(false); }, 1000);
    const onVisibility = () => mark(document.hidden);
    const onHide = () => mark(true);
    document.addEventListener("visibilitychange", onVisibility);
    addEventListener("pagehide", onHide);
    if (new URLSearchParams(location.search).has("crashlog")) setEntries(read<Crumb[]>(localStorage, LOG, []));
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      removeEventListener("pagehide", onHide);
      mark(true);
    };
  }, []);

  if (!entries) return null;
  return (
    <div role="dialog" aria-label="Crash log" style={{ position: "fixed", inset: "auto 12px 12px", zIndex: 2147483000, maxHeight: "60vh", overflow: "auto", padding: 14, borderRadius: 14, background: "#0c1324", color: "#e8edf6", font: "12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace", boxShadow: "0 20px 50px -20px rgba(0,0,0,.6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <strong>Crash log ({entries.length})</strong>
        <span>
          <button type="button" onClick={() => { write(localStorage, LOG, []); setEntries([]); }} style={{ color: "inherit", marginRight: 12 }}>Clear</button>
          <button type="button" onClick={() => setEntries(null)} style={{ color: "inherit" }}>Close</button>
        </span>
      </div>
      {entries.length === 0 ? <p>No crashes recorded in this browser.</p> : entries.map(e => (
        <p key={e.at} style={{ margin: "0 0 10px", whiteSpace: "pre-wrap" }}>
          {new Date(e.at).toLocaleString()} · {e.url} · scroll {e.y}/{e.height} ({Math.round((e.y / Math.max(1, e.height)) * 100)}%) · {e.canvases} canvases{"\n"}{e.scenes || "no 3D sections"}
        </p>
      ))}
    </div>
  );
}
