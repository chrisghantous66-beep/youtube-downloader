import { spawn } from "child_process";
import { existsSync, chmodSync } from "fs";
import path from "path";

let binaryPath: string | null = null;

async function ensureBinary(): Promise<string> {
  if (binaryPath) return binaryPath;

  // Vercel/Linux path
  const tmpDir = process.env.VERCEL ? "/tmp" : process.cwd();
  const ext = process.platform === "win32" ? ".exe" : "";
  const dest = path.join(tmpDir, `yt-dlp${ext}`);

  if (existsSync(dest)) {
    binaryPath = dest;
    return dest;
  }

  // Try local binary first (Windows dev)
  const local = path.join(process.cwd(), `yt-dlp${ext}`);
  if (existsSync(local)) {
    binaryPath = local;
    return local;
  }

  // Download yt-dlp binary
  // On Linux: yt-dlp_linux is the standalone binary (Python bundled, no system deps)
  // On Windows: yt-dlp.exe is the standalone .exe
  const url =
    process.platform === "win32"
      ? "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe"
      : "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download yt-dlp: ${res.status}`);

  const buf = Buffer.from(await res.arrayBuffer());
  require("fs").writeFileSync(dest, buf);
  chmodSync(dest, 0o755);

  binaryPath = dest;
  return dest;
}

export async function ytDlpJson(
  url: string,
  cookies?: string
): Promise<Record<string, unknown>> {
  const bin = await ensureBinary();

  return new Promise((resolve, reject) => {
    const args = ["--dump-json", "--no-playlist", "--no-warnings"];

    if (cookies) {
      args.push("--cookies-from-browser", cookies);
    }

    args.push(url);

    const proc = spawn(bin, args);

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

export async function ytDlpDownload(
  url: string,
  formatId: string,
  cookies?: string
): Promise<string> {
  const bin = await ensureBinary();
  const { mkdtempSync, rmdirSync, readdirSync, existsSync: exists } = require("fs");

  return new Promise((resolve, reject) => {
    const tmpBase = process.env.VERCEL ? "/tmp" : process.cwd();
    const tmpDir = mkdtempSync(path.join(tmpBase, ".tmp-dl-"));
    const outputPath = path.join(tmpDir, "video.%(ext)s");

    const args = [
      "-f", formatId,
      "--no-playlist",
      "--no-warnings",
      "--merge-output-format", "mp4",
      "-o", outputPath,
    ];

    if (cookies) {
      args.splice(0, 0, "--cookies-from-browser", cookies);
    }

    args.push(url);

    const proc = spawn(bin, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        try { rmdirSync(tmpDir, { recursive: true }); } catch {}
        reject(new Error(stderr.trim().split("\n").pop() || `yt-dlp exited with code ${code}`));
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
  });
}
