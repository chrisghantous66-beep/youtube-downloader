import { spawn, execSync } from "child_process";
import { existsSync, chmodSync, writeFileSync } from "fs";
import path from "path";
import { tmpdir } from "os";

let ytDlpPath: string | null = null;
let ffmpegPath: string | null = null;

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

async function ensureFfmpeg(): Promise<string | null> {
  if (ffmpegPath) return ffmpegPath;

  // Check if ffmpeg is already in PATH (local dev)
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    ffmpegPath = "ffmpeg";
    return ffmpegPath;
  } catch {}

  // Try common paths
  const commonPaths = isWin
    ? ["C:\\ffmpeg\\bin\\ffmpeg.exe"]
    : ["/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"];
  for (const p of commonPaths) {
    if (existsSync(p)) { ffmpegPath = p; return p; }
  }

  // On Vercel/Linux, download static ffmpeg binary
  if (!isWin) {
    try {
      const tmpDir = isVercel ? "/tmp" : tmpdir();
      const dest = path.join(tmpDir, "ffmpeg");

      if (existsSync(dest)) { ffmpegPath = dest; return dest; }

      // Download static ffmpeg from yt-dlp's FFmpeg-Builds
      const archiveUrl = "https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz";
      const res = await fetch(archiveUrl);
      if (!res.ok) return null;

      const archivePath = path.join(tmpDir, "ffmpeg.tar.xz");
      const buf = Buffer.from(await res.arrayBuffer());
      require("fs").writeFileSync(archivePath, buf);

      // Extract ffmpeg binary
      execSync(`tar -xf "${archivePath}" -C "${tmpDir}" --strip-components=2 --wildcards "*/ffmpeg"`, {
        stdio: "ignore",
        timeout: 30000,
      });

      // Clean up archive
      try { require("fs").unlinkSync(archivePath); } catch {}

      if (existsSync(dest)) {
        chmodSync(dest, 0o755);
        ffmpegPath = dest;
        return dest;
      }
    } catch (err) {
      console.error("Failed to setup ffmpeg:", err);
      return null;
    }
  }

  return null;
}

function writeCookiesFile(cookiesContent: string): string {
  const tmpDir = isVercel ? "/tmp" : tmpdir();
  const cookieFile = path.join(tmpDir, `.yt-dlp-cookies-${Date.now()}.txt`);
  writeFileSync(cookieFile, cookiesContent, "utf-8");
  return cookieFile;
}

async function buildArgs(url: string, cookiesContent?: string): Promise<string[]> {
  const args = ["--no-playlist", "--no-warnings"];

  if (cookiesContent && cookiesContent.trim().length > 0) {
    const cookieFile = writeCookiesFile(cookiesContent);
    args.push("--cookies", cookieFile);
  }

  // Use ffmpeg if available (needed for merging video+audio)
  const ffmpeg = await ensureFfmpeg();
  if (ffmpeg) {
    args.push("--ffmpeg-location", ffmpeg);
  }

  // YouTube on Vercel (no cookies): use fallback client chain
  // default (web) = best quality, might be blocked on datacenter IPs
  // android = always works but limited to 360p — acceptable fallback
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (isYouTube && !cookiesContent) {
    args.push("--extractor-args", "youtube:player_client=default,android");
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
    buildArgs(url, cookiesContent).then((baseArgs) => {
      const args = ["--dump-json", ...baseArgs];
      const proc = spawn(bin, args);

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      proc.on("close", (code) => {
        if (code !== 0) {
          const err = stderr.trim();
          if (err.includes("Sign in to confirm") || err.includes("bot")) {
            reject(new Error("YouTube bloque cette requête. Ajoutez vos cookies YouTube pour continuer."));
            return;
          }
          reject(new Error(err || `yt-dlp exited with code ${code}`));
          return;
        }
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error("Failed to parse video info"));
        }
      });
      proc.on("error", reject);
    }).catch(reject);
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
    buildArgs(url, cookiesContent).then((baseArgs) => {
      const tmpBase = isVercel ? "/tmp" : process.cwd();
      const tmpDir = mkdtempSync(path.join(tmpBase, ".tmp-dl-"));
      const outputPath = path.join(tmpDir, "video.%(ext)s");

      const args = [
        "-f", formatId,
        ...baseArgs,
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
          const mp4 = files.find((f: string) => f.endsWith(".mp4"));
          const webm = files.find((f: string) => f.endsWith(".webm"));
          const mkv = files.find((f: string) => f.endsWith(".mkv"));
          const foundFile = path.join(tmpDir, mp4 || webm || mkv || files[0] || "");

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
    }).catch(reject);
  });
}
