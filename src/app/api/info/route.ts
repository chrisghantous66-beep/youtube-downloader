import { NextRequest, NextResponse } from "next/server";
import { ytDlpJson } from "@/lib/yt-dlp";

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "Inconnu";
  const mb = bytes / 1048576;
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

async function getInfo(url: string, cookies?: string) {
  const info = await ytDlpJson(url, cookies);
  const formats = (info.formats as Array<Record<string, unknown>>) || [];
  const duration = (info.duration as number) || 0;
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");

  // For Instagram/Facebook: use simple "best" format (pre-muxed, audio+video)
  // No ffmpeg needed, always includes audio
  if (!isYouTube) {
    // Find the best available format (usually a single mp4 with audio)
    const videoFormat = formats.find((f) => {
      const v = f.vcodec as string;
      const a = f.acodec as string;
      return v && v !== "none" && a && a !== "none";
    });

    const size = videoFormat?.filesize_approx as number || videoFormat?.filesize as number || 0;

    return {
      title: (info.title || info.fulltitle || "Sans titre") as string,
      author: (info.uploader || info.channel || info.creator || "Inconnu") as string,
      duration: info.duration_string || `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
      thumbnail: (info.thumbnail as string) || "",
      formats: [{
        id: "best",
        quality: "Meilleure qualité",
        ext: "mp4",
        size: size > 0 ? formatSize(size) : "Taille estimée",
        estimatedBytes: size > 0 ? size : 0,
        isAudio: false,
      }],
    };
  }

  // YouTube: full quality selection with height-based options
  let bestAudioSize = 0;
  for (const f of formats) {
    const vcodec = f.vcodec as string;
    const acodec = f.acodec as string;
    if (vcodec === "none" && acodec && acodec !== "none") {
      const size = f.filesize_approx as number || f.filesize as number || 0;
      if (size > bestAudioSize) bestAudioSize = size;
    }
  }

  if (bestAudioSize === 0) {
    for (const f of formats) {
      const vcodec = f.vcodec as string;
      const acodec = f.acodec as string;
      const tbr = f.tbr as number;
      if (vcodec === "none" && acodec && acodec !== "none") {
        const est = tbr && duration ? tbr * duration * 125 : 0;
        if (est > bestAudioSize) bestAudioSize = est;
      }
    }
  }

  const heightData = new Map<number, { label: string; videoSize: number }>();
  for (const f of formats) {
    const vcodec = f.vcodec as string;
    const height = f.height as number;
    const tbr = f.tbr as number;
    if (vcodec && vcodec !== "none" && height && height > 0) {
      const existing = heightData.get(height);
      const size = (f.filesize_approx as number) || (f.filesize as number) || (tbr && duration ? tbr * duration * 125 : 0);
      if (!existing || size > existing.videoSize) {
        heightData.set(height, {
          label: (f.format_note || f.resolution || `${height}p`) as string,
          videoSize: size,
        });
      }
    }
  }

  const sortedHeights = Array.from(heightData.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([height, data]) => {
      const totalSize = data.videoSize + bestAudioSize;
      return {
        id: `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]`,
        quality: data.label,
        ext: "mp4",
        size: totalSize > 0 ? formatSize(totalSize) : "Taille estimée",
        estimatedBytes: totalSize > 0 ? totalSize : 0,
        isAudio: false,
      };
    });

  const audioFormats = formats
    .filter((f) => {
      const vcodec = f.vcodec as string;
      const acodec = f.acodec as string;
      return vcodec === "none" && acodec && acodec !== "none";
    })
    .map((f) => {
      const size = f.filesize_approx as number || f.filesize as number || 0;
      return {
        id: f.format_id as string,
        quality: f.abr ? `${f.abr}kbps audio` : f.asr ? `${f.asr}Hz audio` : "audio",
        ext: f.ext as string,
        size: formatSize(f.filesize_approx as number | undefined),
        estimatedBytes: size,
        isAudio: true,
      };
    });

  const seenAudio = new Set<string>();
  const uniqueAudio = audioFormats.filter((f) => {
    const key = `${f.quality}_${f.ext}`;
    if (seenAudio.has(key)) return false;
    seenAudio.add(key);
    return true;
  });

  return {
    title: (info.title || info.fulltitle || "Sans titre") as string,
    author: (info.uploader || info.channel || info.creator || "Inconnu") as string,
    duration: info.duration_string || `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
    thumbnail: (info.thumbnail as string) || "",
    formats: [...sortedHeights, ...uniqueAudio],
  };
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  try {
    const data = await getInfo(url);
    return NextResponse.json(data);
  } catch (err) {
    console.error("yt-dlp error:", err);
    const message = err instanceof Error ? err.message : "Impossible de récupérer les informations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url as string;
    const cookies = body.cookies as string | undefined;

    if (!url) {
      return NextResponse.json({ error: "URL manquante" }, { status: 400 });
    }

    const data = await getInfo(url, cookies);
    return NextResponse.json(data);
  } catch (err) {
    console.error("yt-dlp error:", err);
    const message = err instanceof Error ? err.message : "Impossible de récupérer les informations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
