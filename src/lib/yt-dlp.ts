import { spawn } from "child_process";
import { existsSync, chmodSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import { tmpdir } from "os";

let binaryPath: string | null = null;

const isVercel = !!process.env.VERCEL;

async function ensureBinary(): Promise<string> {
  if (binaryPath) return binaryPath;

  const tmpDir = isVercel ? "/tmp" : process.cwd();
  const ext = process.platform === "win32" ? ".exe" : "";
  const dest = path.join(tmpDir, `yt-dlp${ext}`);

  if (existsSync(dest)) {
    binaryPath = dest;
    return dest;
  }

  const local = path.join(process.cwd(), `yt-dlp${ext}`);
  if (existsSync(local)) {
    binaryPath = local;
    return local;
  }

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

// Write cookies content to a temp file, return the path
function writeCookiesFile(cookiesContent: string): string {
  const tmpDir = isVercel ? "/tmp" : tmpdir();
  const cookieFile = path.join(tmpDir, `.yt-dlp-cookies-${Date.now()}.txt`);
  writeFileSync(cookieFile, cookiesContent, "utf-8");
  return cookieFile;
}

function buildArgs(url: string, cookiesContent?: string): string[] {
  const args = ["--no-playlist", "--no-warnings"];

  if (cookiesContent && cookiesContent.trim().length > 0) {
    const cookieFile = writeCookiesFile(cookiesContent);
    args.push("--cookies", cookieFile);
  }

  args.push(url);
  return args;
}

export async function ytDlpJson(
  url: string,
  cookiesContent?: string
): Promise<Record<string, unknown>> {
  const bin = await ensureBinary();

  return new Promise((resolve, reject) => {
    const args = ["--dump-json", ...buildArgs(url, cookiesContent)];
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
        const err = stderr.trim();
        if (err.includes("Sign in to confirm") || err.includes("bot")) {
          reject(new Error(
            "YouTube bloque cette requête. Ajoutez vos cookies YouTube pour continuer."
          ));
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
  });
}

export async function ytDlpDownload(
  url: string,
  formatId: string,
  cookiesContent?: string
): Promise<string> {
  const bin = await ensureBinary();
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
  });
}
