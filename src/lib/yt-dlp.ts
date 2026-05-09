import { spawn } from "child_process";
import { existsSync, chmodSync, writeFileSync } from "fs";
import path from "path";

let ytDlpPath: string | null = null;

const isVercel = !!process.env.VERCEL;
const isWin = process.platform === "win32";

async function ensureYtDlp(): Promise<string> {
  if (ytDlpPath) return ytDlpPath;

  const tmpDir = isVercel ? "/tmp" : process.cwd();
  const ext = isWin ? ".exe" : "";
  const dest = path.join(tmpDir, `yt-dlp${ext}`);

  if (existsSync(dest)) { ytDlpPath = dest; return dest; }

  const local = path.join(process.cwd(), `yt-dlp${ext}`);
  if (existsSync(local)) { ytDlpPath = local; return local; }

  const url = isWin
    ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
    : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download yt-dlp: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  require("fs").writeFileSync(dest, buf);
  chmodSync(dest, 0o755);

  ytDlpPath = dest;
  return dest;
}

function writeCookiesFile(cookiesContent: string): string {
  const tmpDir = isVercel ? "/tmp" : require("os").tmpdir();
  const cookieFile = path.join(tmpDir, `.cookies-${Date.now()}.txt`);
  writeFileSync(cookieFile, cookiesContent, "utf-8");
  return cookieFile;
}

function buildArgs(url: string, cookiesContent?: string): string[] {
  const args = ["--no-playlist", "--no-warnings"];

  if (cookiesContent && cookiesContent.trim().length > 0) {
    args.push("--cookies", writeCookiesFile(cookiesContent));
  } else {
    // Without cookies on Vercel: use Android client to avoid bot detection.
    // Android gives 360p with audio (pre-muxed, no ffmpeg needed).
    // Locally: use default client for full quality.
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
    if (isYouTube && isVercel) {
      args.push("--extractor-args", "youtube:player_client=android");
    }
  }

  args.push(url);
  return args;
}

export async function ytDlpJson(
  url: string,
  cookiesContent?: string
): Promise<Record<string, unknown>> {
  const bin = await ensureYtDlp();

  return new Promise((resolve, reject) => {
    const args = ["--dump-json", ...buildArgs(url, cookiesContent)];
    const proc = spawn(bin, args);

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => {
      if (code !== 0) {
        const err = stderr.trim();
        if (err.includes("Sign in to confirm") || err.includes("bot")) {
          reject(new Error("YouTube bloque cette requête. Ajoutez vos cookies YouTube (section Cookies)."));
          return;
        }
        reject(new Error(err.split("\n").pop() || `yt-dlp exited with code ${code}`));
        return;
      }
      try { resolve(JSON.parse(stdout.trim())); }
      catch { reject(new Error("Failed to parse video info")); }
    });
    proc.on("error", reject);
  });
}

export async function ytDlpDownload(
  url: string,
  formatId: string,
  cookiesContent?: string
): Promise<string> {
  const bin = await ensureYtDlp();
  const { mkdtempSync, rmdirSync, readdirSync, existsSync: exists } = require("fs");

  return new Promise((resolve, reject) => {
    const tmpBase = isVercel ? "/tmp" : process.cwd();
    const tmpDir = mkdtempSync(path.join(tmpBase, ".tmp-dl-"));
    const outputPath = path.join(tmpDir, "video.%(ext)s");

    const args = [
      "-f", formatId,
      ...buildArgs(url, cookiesContent),
      "--merge-output-format", "mp4",
      "-o", outputPath,
    ];

    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      if (code !== 0) {
        try { rmdirSync(tmpDir, { recursive: true }); } catch {}
        const err = stderr.trim();
        if (err.includes("Sign in to confirm") || err.includes("bot")) {
          reject(new Error("YouTube bloque cette requête. Ajoutez vos cookies YouTube."));
          return;
        }
        reject(new Error(err.split("\n").pop() || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        const files = readdirSync(tmpDir);
        const found = files.find((f: string) => f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv"));
        const foundFile = path.join(tmpDir, found || files[0] || "");

        if (!foundFile || !exists(foundFile)) {
          rmdirSync(tmpDir, { recursive: true });
          reject(new Error("Fichier téléchargé introuvable"));
          return;
        }
        resolve(foundFile);
      } catch (err) {
        try { rmdirSync(tmpDir, { recursive: true }); } catch {}
        reject(err instanceof Error ? err : new Error("Erreur inconnue"));
      }
    });

    proc.on("error", reject);
  });
}
