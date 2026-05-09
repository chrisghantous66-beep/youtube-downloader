import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const YT_DLP = path.join(process.cwd(), "yt-dlp.exe");

function ytDlpJson(url: string, cookies?: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const args = ["--dump-json", "--no-playlist", "--no-warnings"];

    if (cookies) {
      args.push("--cookies-from-browser", cookies);
    }

    args.push(url);

    const proc = spawn(YT_DLP, args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout.trim()));
      } catch {
        reject(new Error("Failed to parse video info"));
      }
    });
    proc.on("error", reject);
  });
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return "Inconnu";
  const mb = bytes / 1048576;
  if (mb >= 1000) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb.toFixed(1)} MB`;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const cookies = req.nextUrl.searchParams.get("cookies") || undefined;

  if (!url) {
    return NextResponse.json({ error: "URL manquante" }, { status: 400 });
  }

  try {
    const info = await ytDlpJson(url, cookies);
    const formats = (info.formats as Array<Record<string, unknown>>) || [];
    const duration = (info.duration as number) || 0;

    // Find best audio format (highest bitrate with vcodec=none)
    let bestAudioSize = 0;
    for (const f of formats) {
      const vcodec = f.vcodec as string;
      const acodec = f.acodec as string;
      if (vcodec === "none" && acodec && acodec !== "none") {
        const size = f.filesize_approx as number || f.filesize as number || 0;
        if (size > bestAudioSize) bestAudioSize = size;
      }
    }

    // Collect unique video heights with their best format size
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

    // If bestAudioSize is 0, estimate from best audio tbr
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

    // Build quality options sorted by height descending
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

    // Add audio-only options
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
          quality: f.abr
            ? `${f.abr}kbps audio`
            : f.asr
              ? `${f.asr}Hz audio`
              : "audio",
          ext: f.ext as string,
          size: formatSize(f.filesize_approx as number | undefined),
          estimatedBytes: size,
          isAudio: true,
        };
      });

    // Deduplicate audio formats
    const seenAudio = new Set<string>();
    const uniqueAudio = audioFormats.filter((f) => {
      const key = `${f.quality}_${f.ext}`;
      if (seenAudio.has(key)) return false;
      seenAudio.add(key);
      return true;
    });

    const allFormats = [...sortedHeights, ...uniqueAudio];

    return NextResponse.json({
      title: (info.title || info.fulltitle || "Sans titre") as string,
      author: (info.uploader || info.channel || info.creator || "Inconnu") as string,
      duration: info.duration_string || `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}`,
      thumbnail: (info.thumbnail as string) || "",
      webpage_url: info.webpage_url as string || "",
      extractor: info.extractor as string || "",
      formats: allFormats,
    });
  } catch (err) {
    console.error("yt-dlp error:", err);
    const message =
      err instanceof Error ? err.message : "Impossible de récupérer les informations";

    let hint: string | undefined;
    if (message.includes("Cookie") || message.includes("logged-in") || message.includes("login")) {
      hint = "Cette plateforme nécessite une authentification. Activez les cookies navigateur.";
    }

    return NextResponse.json({ error: message, hint }, { status: 500 });
  }
}
