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

type Platform = "youtube" | "instagram" | "facebook";

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
  gradient: string;
  glowColor: string;
  urlPattern: RegExp;
}[] = [
  {
    key: "youtube",
    label: "YouTube",
    icon: "▶",
    placeholder: "https://www.youtube.com/watch?v=...",
    gradient: "from-red-600 to-rose-600",
    glowColor: "rgba(239,68,68,0.6)",
    urlPattern: /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|shorts\/|embed\/|v\/)|youtu\.be\/)/,
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: "📷",
    placeholder: "https://www.instagram.com/reel/...",
    gradient: "from-pink-500 to-purple-500",
    glowColor: "rgba(236,72,153,0.6)",
    urlPattern: /^(https?:\/\/)?(www\.)?instagram\.com\/(reel\/|p\/|tv\/|stories\/)/,
  },
  {
    key: "facebook",
    label: "Facebook",
    icon: "📘",
    placeholder: "https://www.facebook.com/watch/?v=...",
    gradient: "from-blue-600 to-sky-500",
    glowColor: "rgba(37,99,235,0.6)",
    urlPattern: /^(https?:\/\/)?(www\.|web\.|m\.)?(facebook\.com\/(watch\/?\?v=|reel\/|share\/|video\/|plugins\/video|photo\/\?fbid=)|fb\.watch\/)/,
  },
];

function validateUrl(url: string, platform: Platform): string | null {
  const cfg = PLATFORMS.find((p) => p.key === platform)!;
  if (!cfg.urlPattern.test(url.trim())) {
    const labels: Record<Platform, string> = {
      youtube: "YouTube (youtube.com, youtu.be)",
      instagram: "Instagram (instagram.com/reel/, /p/, /tv/)",
      facebook: "Facebook (facebook.com, fb.watch)",
    };
    return `Ce lien ne correspond pas à ${labels[platform]}. Utilisez l'onglet approprié.`;
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
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function RetroProgressBar({
  progress,
  _formatLabel,
  glowColor,
}: {
  progress: DownloadProgress;
  _formatLabel: string;
  glowColor: string;
}) {
  const elapsed = Date.now() - progress.startTime;

  const percentage = progress.totalBytes > 0
    ? Math.min(99, Math.round((progress.bytesDownloaded / progress.totalBytes) * 100))
    : 0;

  const blocks = 40;
  const filled = Math.floor((percentage / 100) * blocks);

  let eta = "";
  if (progress.speed > 0 && progress.totalBytes > 0) {
    const remaining = progress.totalBytes - progress.bytesDownloaded;
    const etaSec = Math.ceil(remaining / progress.speed);
    if (etaSec > 3600) eta = `~${Math.floor(etaSec / 3600)}h`;
    else if (etaSec > 60) eta = `~${Math.floor(etaSec / 60)}m`;
    else eta = `~${etaSec}s`;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        <div
          className="relative rounded-2xl border-2 p-6"
          style={{
            backgroundColor: "#0a0a0f",
            borderColor: "rgba(0,255,255,0.15)",
            boxShadow: `0 0 40px ${glowColor.replace("0.6", "0.15")}, 0 0 80px ${glowColor.replace("0.6", "0.08")}, inset 0 0 60px rgba(0,255,255,0.02)`,
          }}
        >
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none opacity-[0.03]"
            style={{
              backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,255,0.5) 2px, rgba(0,255,255,0.5) 3px)",
            }}
          />
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-cyan-500/40 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-cyan-500/40 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-cyan-500/40 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-cyan-500/40 rounded-br-lg" />

          <div className="relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00ffff]" />
                <span className="text-cyan-400/80 text-xs tracking-[0.2em] uppercase font-mono">
                  Téléchargement
                </span>
              </div>
              <span className="text-cyan-500/50 text-[10px] font-mono tracking-wider">
                {percentage}%
              </span>
            </div>

            <div
              className="h-8 rounded-lg relative overflow-hidden mb-3"
              style={{
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "1px solid rgba(0,255,255,0.1)",
                boxShadow: "inset 0 0 20px rgba(0,0,0,0.5)",
              }}
            >
              <div
                className="absolute inset-y-0 left-0 transition-all duration-200 rounded-lg"
                style={{
                  width: `${percentage}%`,
                  background: `linear-gradient(90deg, rgba(0,255,255,0.15), rgba(0,255,255,0.35))`,
                  boxShadow: `inset 0 0 15px rgba(0,255,255,0.1)`,
                }}
              />
              <div className="absolute inset-0 flex gap-[2px] p-[2px]">
                {Array.from({ length: blocks }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm transition-all duration-200"
                    style={{
                      backgroundColor: i < filled
                        ? `rgba(0,255,255,${0.3 + (i / blocks) * 0.5})`
                        : "rgba(255,255,255,0.03)",
                      boxShadow: i < filled
                        ? `0 0 ${i === filled - 1 ? "10px" : "3px"} ${glowColor.replace("0.6", i === filled - 1 ? "0.9" : "0.3")}`
                        : "none",
                    }}
                  />
                ))}
              </div>
              {percentage > 0 && (
                <div
                  className="absolute top-0 bottom-0 w-[2px]"
                  style={{
                    left: `${percentage}%`,
                    backgroundColor: "rgba(0,255,255,0.9)",
                    boxShadow: `0 0 20px ${glowColor}, 0 0 40px rgba(0,255,255,0.8)`,
                  }}
                />
              )}
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <div className="text-[9px] text-cyan-500/50 tracking-widest uppercase font-mono mb-0.5">Progrès</div>
                <div className="text-sm font-mono text-cyan-300 font-semibold">{percentage}%</div>
              </div>
              <div>
                <div className="text-[9px] text-cyan-500/50 tracking-widest uppercase font-mono mb-0.5">Téléchargé</div>
                <div className="text-sm font-mono text-cyan-300 font-semibold">{formatBytes(progress.bytesDownloaded)}</div>
              </div>
              <div>
                <div className="text-[9px] text-cyan-500/50 tracking-widest uppercase font-mono mb-0.5">Vitesse</div>
                <div className="text-sm font-mono text-cyan-300 font-semibold">{formatSpeed(progress.speed)}</div>
              </div>
              <div>
                <div className="text-[9px] text-cyan-500/50 tracking-widest uppercase font-mono mb-0.5">{eta ? "ETA" : "Temps"}</div>
                <div className="text-sm font-mono text-cyan-300 font-semibold">{eta || formatTime(elapsed)}</div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
              <span className="text-[9px] font-mono text-cyan-500/40 tracking-widest animate-pulse">● EN COURS</span>
              <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("youtube");
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

  function updateCookies(value: string) {
    setCookiesText(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("vg_cookies", value);
    }
  }
  const abortRef = useRef<AbortController | null>(null);

  const currentPlatform = PLATFORMS.find((p) => p.key === platform)!;

  const handleFetchInfo = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError("");
      setHint("");
      setInfo(null);

      const validationError = validateUrl(url, currentPlatform.key);
      if (validationError) {
        setError(validationError);
        setLoading(false);
        return;
      }

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
        if (!res.ok) throw new Error(data.error || "Une erreur est survenue");
        setInfo(data);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Une erreur est survenue";
        setError(msg);
        if (msg.includes("cookie") || msg.includes("Cookie") || msg.includes("bloque")) {
          setShowCookies(true);
          setHint("YouTube bloque les IPs datacenter. Ajoutez vos cookies YouTube ci-dessous (1 seule fois, ils sont sauvegardés).");
        }
      } finally {
        setLoading(false);
      }
    },
    [url, cookiesText, currentPlatform]
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
        throw new Error(data.error || "Échec du téléchargement");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Impossible de lire le flux de données");

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
          const deltaTime = (now - lastTick) / 1000;
          const deltaBytes = downloaded - lastBytes;
          const speed = deltaTime > 0 ? deltaBytes / deltaTime : 0;
          setDownloadProgress({ bytesDownloaded: downloaded, speed, startTime, totalBytes });
          lastTick = now;
          lastBytes = downloaded;
        }
      }

      const totalTime = (Date.now() - startTime) / 1000;
      const avgSpeed = totalTime > 0 ? downloaded / totalTime : 0;
      setDownloadProgress({ bytesDownloaded: downloaded, speed: avgSpeed, startTime, totalBytes: downloaded });
      await new Promise((r) => setTimeout(r, 400));

      const blob = new Blob(chunks as BlobPart[]);
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      const ext = format.ext || (format.isAudio ? "mp3" : "mp4");
      const safe = (info?.title || "video").replace(/[^a-z0-9]/gi, "_").substring(0, 50);
      a.download = `${safe}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : "Échec du téléchargement");
      }
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
      abortRef.current = null;
    }
  }

  function cancelDownload() {
    abortRef.current?.abort();
  }

  const videoFormats = info?.formats.filter((f) => !f.isAudio) || [];
  const audioFormats = info?.formats.filter((f) => f.isAudio) || [];

  return (
    <main className="min-h-screen bg-zinc-950 text-white selection:bg-white/20">
      {downloadProgress && (
        <>
          <RetroProgressBar progress={downloadProgress} _formatLabel={downloading || ""} glowColor={currentPlatform.glowColor} />
          <button
            onClick={cancelDownload}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] px-6 py-2 rounded-full bg-red-900/60 border border-red-500/30 text-red-300 text-xs font-mono tracking-widest uppercase hover:bg-red-800/60 transition-colors cursor-pointer backdrop-blur-sm"
          >
            ✕ Annuler
          </button>
        </>
      )}

      <header className="border-b border-zinc-800/30 bg-zinc-950/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${currentPlatform.gradient} flex items-center justify-center text-white font-bold shadow-lg shadow-current/20`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-base text-white leading-tight">VideoGrab</h1>
              <p className="text-[11px] text-zinc-500 leading-tight">Downloader universel</p>
            </div>
          </div>
          <div className="text-[11px] text-zinc-600">Qualité native</div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Platform tabs */}
        <div className="flex gap-1 mb-6 bg-zinc-900/40 rounded-xl p-1 border border-zinc-800/30">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => { setPlatform(p.key); setInfo(null); setError(""); setHint(""); setUrl(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                platform === p.key
                  ? `bg-gradient-to-r ${p.gradient} text-white shadow-lg shadow-current/10`
                  : "text-zinc-400 hover:text-white hover:bg-zinc-800/40"
              }`}
            >
              <span className="text-base">{p.icon}</span>
              <span className="hidden sm:inline">{p.label}</span>
            </button>
          ))}
        </div>

        {/* URL input */}
        <form onSubmit={handleFetchInfo} className="mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="flex-1 relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={currentPlatform.placeholder}
                className="w-full px-4 py-3 rounded-xl bg-zinc-900/60 border border-zinc-700/40 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500/70 transition-all duration-200 text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-3 rounded-xl bg-gradient-to-r ${currentPlatform.gradient} disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-lg whitespace-nowrap flex items-center justify-center gap-2`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="hidden sm:inline">Analyse...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="hidden sm:inline">Analyser</span>
                </>
              )}
            </button>
          </div>

          {/* Cookies section */}
          <div>
            <button
              type="button"
              onClick={() => setShowCookies(!showCookies)}
              className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <svg className={`w-3 h-3 transition-transform ${showCookies ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <span>Cookies {cookiesText.trim() ? "✓ (actif)" : "(optionnel)"}</span>
              <span className="text-zinc-600">— {cookiesText.trim() ? "activé pour toutes les plateformes" : "recommandé pour YouTube, obligatoire pour Instagram/Facebook"}</span>
            </button>
            {showCookies && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={cookiesText}
                  onChange={(e) => updateCookies(e.target.value)}
                  placeholder="Collez ici le contenu de votre fichier cookies.txt (format Netscape)..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg bg-zinc-900/60 border border-zinc-700/40 text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500/70 text-xs font-mono resize-y"
                />
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-500">
                    <span className="text-amber-400/80 font-medium">YouTube bloqué ?</span> Installez l'extension{" "}
                    <a href="https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="text-cyan-500/60 hover:text-cyan-400 underline">
                      Get cookies.txt
                    </a>
                    {" "}→ allez sur youtube.com → exportez → copiez-collez le contenu ici.
                  </p>
                  {cookiesText.trim() && (
                    <p className="text-[10px] text-emerald-400/70">
                      Cookies sauvegardés — vous n'aurez plus à les remettre.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-800/30 text-red-300 mb-6 flex items-start gap-3">
            <svg className="w-5 h-5 shrink-0 mt-0.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm">{error}</p>
              {hint && <p className="text-xs text-amber-400/80 mt-1.5">{hint}</p>}
            </div>
          </div>
        )}

        {/* Video info card */}
        {info && !loading && (
          <div className="rounded-2xl bg-zinc-900/40 border border-zinc-800/30 overflow-hidden backdrop-blur-sm">
            <div className="aspect-video bg-zinc-800/30 relative">
              {info.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.thumbnail} alt={info.title} className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700">
                  <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              )}
              {info.duration && (
                <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-lg text-xs font-medium text-white">
                  {info.duration}
                </div>
              )}
            </div>

            <div className="p-5">
              <h2 className="text-lg font-semibold mb-1 leading-snug line-clamp-2">{info.title}</h2>
              <p className="text-zinc-400 text-sm mb-6">{info.author}</p>

              {videoFormats.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Qualité vidéo ({videoFormats.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {videoFormats.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleDownload(f)}
                        disabled={downloading !== null}
                        className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer group border border-zinc-700/20 hover:border-zinc-600/40"
                      >
                        <div className="text-left min-w-0">
                          <span className="font-semibold text-sm block">{f.quality}</span>
                          <span className="text-[10px] text-zinc-500">{f.size}</span>
                        </div>
                        <span className="text-zinc-500 group-hover:text-white transition-colors shrink-0">
                          {downloading === f.quality ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <DownloadIcon />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {audioFormats.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                    </svg>
                    Audio seul ({audioFormats.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {audioFormats.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => handleDownload(f)}
                        disabled={downloading !== null}
                        className="flex items-center justify-between gap-2 px-3.5 py-3 rounded-xl bg-zinc-800/40 hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer group border border-zinc-700/20 hover:border-zinc-600/40"
                      >
                        <div className="text-left min-w-0">
                          <span className="font-semibold text-sm block">{f.quality}</span>
                          {f.size !== "Inconnu" && <span className="text-[10px] text-zinc-500">{f.size}</span>}
                        </div>
                        <span className="text-zinc-500 group-hover:text-white transition-colors shrink-0">
                          {downloading === f.quality ? (
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <DownloadIcon />
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {videoFormats.length === 0 && audioFormats.length === 0 && (
                <p className="text-center text-zinc-500 py-4 text-sm">Aucun format trouvé pour cette vidéo.</p>
              )}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!info && !loading && !error && (
          <div className="text-center py-20">
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${currentPlatform.gradient} mx-auto mb-6 flex items-center justify-center text-white text-3xl shadow-2xl opacity-90`}>
              {currentPlatform.icon}
            </div>
            <h2 className="text-xl font-semibold mb-2">Prêt à télécharger</h2>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto leading-relaxed">
              Collez un lien {currentPlatform.label} ci-dessus pour analyser et télécharger la vidéo en qualité native.
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-zinc-800/20 mt-12">
        <div className="max-w-3xl mx-auto px-4 py-5 text-center text-[11px] text-zinc-600">
          Propulsé par yt-dlp &middot; Téléchargements en qualité maximale
        </div>
      </footer>
    </main>
  );
}
