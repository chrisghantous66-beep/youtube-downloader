"use client";

import { useState, useCallback, useRef } from "react";

type Format = {
  id: string;
  quality: string;
  ext: string;
  size: string;
  isAudio: boolean;
  estimatedBytes: number;
};

type VideoInfo = {
  title: string;
  author: string;
  duration: string;
  thumbnail: string;
  formats: Format[];
};

type Platform = "instagram" | "facebook";

type DownloadProgress = {
  bytesDownloaded: number;
  speed: number;
  startTime: number;
  totalBytes: number;
};

const PLATFORMS: {
  key: Platform;
  label: string;
  icon: string;
  placeholder: string;
  neonColor: string;
  neonDim: string;
  bgGlow: string;
  urlPattern: RegExp;
}[] = [
  {
    key: "instagram",
    label: "Instagram",
    icon: "◇",
    placeholder: "https://www.instagram.com/reel/...",
    neonColor: "#ff2d95",
    neonDim: "rgba(255,45,149,0.3)",
    bgGlow: "rgba(255,45,149,0.08)",
    urlPattern: /^(https?:\/\/)?(www\.)?instagram\.com\/(reel\/|p\/|tv\/|stories\/)/,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "◈",
    placeholder: "https://www.facebook.com/watch/?v=...",
    neonColor: "#00d4ff",
    neonDim: "rgba(0,212,255,0.3)",
    bgGlow: "rgba(0,212,255,0.08)",
    urlPattern: /^(https?:\/\/)?(www\.|web\.|m\.)?(facebook\.com\/(watch\/?\?v=|reel\/|share\/|video\/|plugins\/video)|fb\.watch\/)/,
  },
];

function validateUrl(url: string, platform: Platform): string | null {
  const cfg = PLATFORMS.find((p) => p.key === platform)!;
  if (!cfg.urlPattern.test(url.trim())) {
    const labels: Record<Platform, string> = {
      instagram: "Instagram (instagram.com/reel/, /p/, /tv/)",
      facebook: "Facebook (facebook.com, fb.watch)",
    };
    return `Lien invalide pour ${labels[platform]}`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

// ─── Neon corner decoration ───
function Corners({ color }: { color: string }) {
  return (
    <>
      <div className="absolute top-0 left-0 w-5 h-5 border-t border-l rounded-tl-lg" style={{ borderColor: `${color}66` }} />
      <div className="absolute top-0 right-0 w-5 h-5 border-t border-r rounded-tr-lg" style={{ borderColor: `${color}66` }} />
      <div className="absolute bottom-0 left-0 w-5 h-5 border-b border-l rounded-bl-lg" style={{ borderColor: `${color}66` }} />
      <div className="absolute bottom-0 right-0 w-5 h-5 border-b border-r rounded-br-lg" style={{ borderColor: `${color}66` }} />
    </>
  );
}

// ─── Download progress overlay ───
function ProgressOverlay({
  progress,
  glowColor,
}: {
  progress: DownloadProgress;
  glowColor: string;
}) {
  const elapsed = Date.now() - progress.startTime;
  const pct = progress.totalBytes > 0
    ? Math.min(99, Math.round((progress.bytesDownloaded / progress.totalBytes) * 100))
    : 0;

  let eta = "";
  if (progress.speed > 0 && progress.totalBytes > 0) {
    const s = Math.ceil((progress.totalBytes - progress.bytesDownloaded) / progress.speed);
    eta = s > 3600 ? `~${Math.floor(s / 3600)}h` : s > 60 ? `~${Math.floor(s / 60)}m` : `~${s}s`;
  }

  const blocks = 36;
  const filled = Math.floor((pct / 100) * blocks);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#050510]/95 backdrop-blur-sm">
      {/* Background grid */}
      <div className="absolute inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      <div className="w-full max-w-md mx-4 relative">
        <div className="relative rounded-2xl p-5" style={{
          background: "linear-gradient(135deg, rgba(10,10,30,0.98), rgba(5,5,20,0.98))",
          border: `1px solid ${glowColor}33`,
          boxShadow: `0 0 60px ${glowColor}15, 0 0 120px ${glowColor}08, inset 0 0 40px ${glowColor}03`,
        }}>
          <Corners color={glowColor} />

          {/* Scanlines */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.02]"
            style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)" }} />

          <div className="relative space-y-4">
            {/* Title */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: glowColor, boxShadow: `0 0 10px ${glowColor}` }} />
                <span className="text-xs tracking-[0.25em] uppercase font-mono" style={{ color: glowColor }}>
                  DOWNLOADING
                </span>
              </div>
              <span className="text-xs font-mono font-bold" style={{ color: glowColor }}>
                {pct}%
              </span>
            </div>

            {/* Bar */}
            <div className="h-7 rounded-lg relative overflow-hidden"
              style={{ background: "rgba(0,0,0,0.6)", border: `1px solid ${glowColor}18`, boxShadow: `inset 0 0 15px rgba(0,0,0,0.8)` }}>
              <div className="absolute inset-y-0 left-0 transition-all duration-150 rounded-lg"
                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${glowColor}15, ${glowColor}35)`, boxShadow: `inset 0 0 12px ${glowColor}15` }} />
              <div className="absolute inset-0 flex gap-[2px] p-[2px]">
                {Array.from({ length: blocks }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-sm transition-all duration-150"
                    style={{
                      background: i < filled ? `${glowColor}${i === filled - 1 ? "cc" : "66"}` : "rgba(255,255,255,0.03)",
                      boxShadow: i < filled ? `0 0 ${i === filled - 1 ? "14px" : "3px"} ${glowColor}` : "none",
                    }} />
                ))}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: "DOWNLOADED", value: formatBytes(progress.bytesDownloaded) },
                { label: "SPEED", value: formatSpeed(progress.speed) },
                { label: eta ? "ETA" : "ELAPSED", value: eta || formatTime(elapsed) },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-[8px] tracking-[0.15em] uppercase font-mono mb-1" style={{ color: `${glowColor}55` }}>{s.label}</div>
                  <div className="text-xs font-mono font-semibold" style={{ color: glowColor }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Bottom line */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${glowColor}25, transparent)` }} />
              <span className="text-[9px] font-mono tracking-[0.2em] animate-pulse" style={{ color: `${glowColor}55` }}>● ACTIVE</span>
              <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, transparent, ${glowColor}25, transparent)` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main app ───
export default function Home() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [info, setInfo] = useState<VideoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [cookiesText, setCookiesText] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("vg_cookies") || "";
    return "";
  });
  const [showCookies, setShowCookies] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const platformCfg = PLATFORMS.find((p) => p.key === platform)!;

  function updateCookies(value: string) {
    setCookiesText(value);
    if (typeof window !== "undefined") localStorage.setItem("vg_cookies", value);
  }

  const handleFetchInfo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setHint("");
      setInfo(null);

      const ve = validateUrl(url, platformCfg.key);
      if (ve) { setError(ve); return; }

      setLoading(true);
      try {
        let res: Response;
        if (cookiesText.trim()) {
          res = await fetch("/api/info", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url.trim(), cookies: cookiesText }),
          });
        } else {
          res = await fetch(`/api/info?url=${encodeURIComponent(url.trim())}`);
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        setInfo(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur";
        setError(msg);
        if (msg.includes("cookie") || msg.includes("Cookie") || msg.includes("bloque") || msg.includes("login") || msg.includes("rate-limit")) {
          setShowCookies(true);
          setHint("Cette plateforme nécessite des cookies. Connectez-vous sur le site, puis exportez avec l'extension.");
        }
      } finally {
        setLoading(false);
      }
    },
    [url, cookiesText, platformCfg.key]
  );

  async function handleDownload(format: Format) {
    setDownloading(format.quality);
    setError("");
    setHint("");

    const totalBytes = format.estimatedBytes || 0;
    const startTime = Date.now();
    setDownloadProgress({ bytesDownloaded: 0, speed: 0, startTime, totalBytes });
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let res: Response;
      if (cookiesText.trim()) {
        res = await fetch("/api/download", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: url.trim(), id: format.id, cookies: cookiesText }),
          signal: controller.signal,
        });
      } else {
        res = await fetch(
          `/api/download?url=${encodeURIComponent(url.trim())}&id=${encodeURIComponent(format.id)}`,
          { signal: controller.signal }
        );
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Échec");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Flux illisible");

      const chunks: any[] = [];
      let downloaded = 0;
      let lastTick = Date.now();
      let lastBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        downloaded += value.length;
        const now = Date.now();
        if (now - lastTick >= 100) {
          const dt = (now - lastTick) / 1000;
          const db = downloaded - lastBytes;
          setDownloadProgress({ bytesDownloaded: downloaded, speed: dt > 0 ? db / dt : 0, startTime, totalBytes });
          lastTick = now;
          lastBytes = downloaded;
        }
      }

      setDownloadProgress({ bytesDownloaded: downloaded, speed: 0, startTime, totalBytes: downloaded });
      await new Promise((r) => setTimeout(r, 300));

      const blob = new Blob(chunks as BlobPart[]);
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `${(info?.title || "video").replace(/[^a-z0-9]/gi, "_").substring(0, 40)}.${format.ext || "mp4"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(u);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Échec");
      }
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
      abortRef.current = null;
    }
  }

  const videoFormats = info?.formats.filter((f) => !f.isAudio) || [];

  return (
    <main className="min-h-screen text-white selection:bg-white/20"
      style={{ background: "linear-gradient(180deg, #080812 0%, #0a0a14 50%, #080812 100%)" }}>

      {/* Global scanlines & grid */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.025]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, #fff 2px, #fff 3px)" }} />
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{ backgroundImage: "linear-gradient(#fff2 1px, transparent 1px), linear-gradient(90deg, #fff2 1px, transparent 1px)", backgroundSize: "48px 48px" }} />

      {/* Overlay */}
      {downloadProgress && (
        <>
          <ProgressOverlay progress={downloadProgress} glowColor={platformCfg.neonColor} />
          <button onClick={() => abortRef.current?.abort()}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-5 py-2 rounded-full text-xs font-mono tracking-[0.2em] uppercase transition-all cursor-pointer backdrop-blur-sm"
            style={{ background: "#ff2d3533", border: "1px solid #ff2d3544", color: "#ff6b6b" }}>
            ✕ CANCEL
          </button>
        </>
      )}

      {/* Header */}
      <header className="relative z-30 border-b backdrop-blur-xl sticky top-0"
        style={{ background: "rgba(8,8,18,0.85)", borderColor: `${platformCfg.neonColor}18` }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base font-bold"
              style={{ background: `linear-gradient(135deg, ${platformCfg.neonColor}33, ${platformCfg.neonColor}11)`, border: `1px solid ${platformCfg.neonColor}44`, boxShadow: `0 0 20px ${platformCfg.bgGlow}` }}>
              <span className="font-mono" style={{ color: platformCfg.neonColor }}>↓</span>
            </div>
            <div>
              <h1 className="font-bold text-sm tracking-wide">VIDEOGRAB</h1>
              <p className="text-[10px] tracking-[0.15em] uppercase font-mono" style={{ color: `${platformCfg.neonColor}88` }}>Downloader</p>
            </div>
          </div>
          <span className="text-[9px] tracking-[0.2em] uppercase font-mono" style={{ color: `${platformCfg.neonColor}55` }}>
            {platformCfg.label}
          </span>
        </div>
      </header>

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 rounded-xl p-1"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
          {PLATFORMS.map((p) => (
            <button key={p.key} onClick={() => { setPlatform(p.key); setInfo(null); setError(""); setHint(""); setUrl(""); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              style={platform === p.key ? {
                background: `linear-gradient(135deg, ${p.neonColor}22, ${p.neonColor}0d)`,
                border: `1px solid ${p.neonColor}55`,
                color: p.neonColor,
                boxShadow: `0 0 25px ${p.bgGlow}`,
              } : {
                color: "#ffffff55",
              }}>
              <span className="text-lg font-mono">{p.icon}</span>
              <span className="hidden sm:inline tracking-wide text-xs">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleFetchInfo} className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={platformCfg.placeholder}
              className="flex-1 px-4 py-3 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition-all duration-200 font-mono"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: `1px solid rgba(255,255,255,0.06)`,
                boxShadow: `inset 0 0 20px rgba(0,0,0,0.3)`,
              }}
              required
            />
            <button type="submit" disabled={loading}
              className="px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer tracking-wider uppercase font-mono text-xs"
              style={{
                background: `linear-gradient(135deg, ${platformCfg.neonColor}88, ${platformCfg.neonColor}44)`,
                border: `1px solid ${platformCfg.neonColor}66`,
                color: "#fff",
                boxShadow: `0 0 30px ${platformCfg.bgGlow}`,
              }}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  SCAN
                </span>
              ) : "ANALYZE"}
            </button>
          </div>

          {/* Cookies toggle */}
          <button type="button" onClick={() => setShowCookies(!showCookies)}
            className="flex items-center gap-1.5 text-[10px] tracking-wider uppercase font-mono transition-colors cursor-pointer"
            style={{ color: cookiesText.trim() ? "#22ffaa" : "#ffffff33" }}>
            <svg className={`w-3 h-3 transition-transform ${showCookies ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            COOKIES {cookiesText.trim() ? "● ACTIVE" : "(REQUIRED)"}
          </button>
          {showCookies && (
            <div className="space-y-1.5">
              <textarea value={cookiesText} onChange={(e) => updateCookies(e.target.value)}
                placeholder="Paste cookies.txt content here..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg text-xs text-white placeholder:text-white/15 focus:outline-none font-mono resize-y"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }} />
              <p className="text-[9px] tracking-wider font-mono leading-relaxed" style={{ color: "#ffffff33" }}>
                1. <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer"
                  className="underline" style={{ color: platformCfg.neonColor }}>Get cookies.txt</a>
                {" "}→ 2. Login to Instagram + Facebook → 3. Export ALL cookies → 4. Paste here
              </p>
            </div>
          )}
        </form>

        {/* Error */}
        {error && (
          <div className="relative rounded-xl p-4 mb-6 flex items-start gap-3"
            style={{ background: "rgba(255,45,53,0.08)", border: "1px solid rgba(255,45,53,0.2)" }}>
            <Corners color="#ff2d35" />
            <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#ff4d55" }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-xs font-mono" style={{ color: "#ff6b6b" }}>{error}</p>
              {hint && <p className="text-[10px] font-mono mt-1" style={{ color: "#ffaa44" }}>{hint}</p>}
            </div>
          </div>
        )}

        {/* Video info */}
        {info && !loading && (
          <div className="relative rounded-2xl overflow-hidden"
            style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${platformCfg.neonColor}22` }}>
            <Corners color={platformCfg.neonColor} />

            {info.thumbnail && (
              <div className="aspect-video relative" style={{ background: "#000" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={info.thumbnail} alt={info.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded text-[10px] font-mono tracking-wider backdrop-blur-md"
                  style={{ background: "rgba(0,0,0,0.8)", border: `1px solid ${platformCfg.neonColor}33`, color: platformCfg.neonColor }}>
                  {info.duration}
                </div>
              </div>
            )}

            <div className="p-5">
              <h2 className="font-semibold text-sm leading-snug line-clamp-2 mb-1 tracking-wide">{info.title}</h2>
              <p className="text-[11px] font-mono tracking-wider mb-5" style={{ color: "#ffffff44" }}>{info.author}</p>

              {videoFormats.length > 0 && (
                <div>
                  <h3 className="text-[9px] tracking-[0.2em] uppercase font-mono mb-3 flex items-center gap-2" style={{ color: "#ffffff33" }}>
                    <span className="w-1 h-1 rounded-full" style={{ backgroundColor: platformCfg.neonColor }} />
                    QUALITY ({videoFormats.length})
                  </h3>
                  <button
                    onClick={() => handleDownload(videoFormats[0])}
                    disabled={downloading !== null}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-mono transition-all duration-200 cursor-pointer disabled:opacity-40"
                    style={{
                      background: `linear-gradient(135deg, ${platformCfg.neonColor}22, ${platformCfg.neonColor}0d)`,
                      border: `1px solid ${platformCfg.neonColor}44`,
                      boxShadow: `0 0 30px ${platformCfg.bgGlow}`,
                      color: platformCfg.neonColor,
                    }}>
                    <div className="text-left">
                      <span className="text-sm font-semibold tracking-wide block">{videoFormats[0].quality}</span>
                      <span className="text-[10px] opacity-60">{videoFormats[0].size}</span>
                    </div>
                    <span className="text-lg">
                      {downloading === videoFormats[0].quality ? (
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      )}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!info && !loading && !error && (
          <div className="text-center py-24 relative">
            <div className="w-20 h-20 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl"
              style={{ background: `linear-gradient(135deg, ${platformCfg.neonColor}22, ${platformCfg.neonColor}08)`, border: `1px solid ${platformCfg.neonColor}33`, boxShadow: `0 0 60px ${platformCfg.bgGlow}` }}>
              <span className="font-mono" style={{ color: platformCfg.neonColor }}>{platformCfg.icon}</span>
            </div>
            <h2 className="text-base font-semibold mb-2 tracking-wide">READY</h2>
            <p className="text-xs tracking-wider font-mono max-w-xs mx-auto" style={{ color: "#ffffff33" }}>
              Paste a {platformCfg.label} link above to download
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
        <div className="max-w-2xl mx-auto px-4 py-4 text-center text-[9px] tracking-[0.2em] uppercase font-mono" style={{ color: "#ffffff18" }}>
          Powered by yt-dlp · Native quality
        </div>
      </footer>
    </main>
  );
}
