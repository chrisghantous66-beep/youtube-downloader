import { spawn } from "child_process";
import { existsSync, chmodSync } from "fs";
import path from "path";

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

  // Try local binary first (Windows dev)
  const local = path.join(process.cwd(), `yt-dlp${ext}`);
  if (existsSync(local)) {
    binaryPath = local;
    return local;
  }

  // Download yt-dlp standalone binary
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

function buildArgs(url: string, cookies?: string): string[] {
  const args = ["--no-playlist", "--no-warnings"];

  // On Vercel (serverless), --cookies-from-browser can NEVER work (no browser installed).
  // On local machine, use it only if the user explicitly requested it.
  if (cookies && !isVercel) {
    args.push("--cookies-from-browser", cookies);
  }

  // Use mobile client to reduce bot detection on datacenter IPs
  // This helps YouTube work on Vercel without cookies
  const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
  if (isYouTube) {
    args.push("--extractor-args", "youtube:player_client=ios");
  }

  args.push(url);
  return args;
}

export async function ytDlpJson(
  url: string,
  cookies?: string
): Promise<Record<string, unknown>> {
  const bin = await ensureBinary();

  // Reject cookies on Vercel clearly
  if (cookies && isVercel) {
    throw new Error(
      "L'authentification par cookies n'est pas disponible sur Vercel. " +
      "Déployez l'application en local pour utiliser Instagram/Facebook."
    );
  }

  return new Promise((resolve, reject) => {
    const args = ["--dump-json", ...buildArgs(url, cookies)];
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
        // Friendly message for bot detection
        if (err.includes("Sign in to confirm")) {
          reject(new Error(
            "YouTube a détecté une requête automatique (IP datacenter Vercel). " +
            "Essayez de redéployer ou utilisez l'app en local."
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
  cookies?: string
): Promise<string> {
  const bin = await ensureBinary();
  const { mkdtempSync, rmdirSync, readdirSync, existsSync: exists } = require("fs");

  if (cookies && isVercel) {
    throw new Error(
      "L'authentification par cookies n'est pas disponible sur Vercel."
    );
  }

  return new Promise((resolve, reject) => {
    const tmpBase = isVercel ? "/tmp" : process.cwd();
    const tmpDir = mkdtempSync(path.join(tmpBase, ".tmp-dl-"));
    const outputPath = path.join(tmpDir, "video.%(ext)s");

    const args = [
      "-f", formatId,
      ...buildArgs(url, cookies),
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
        if (err.includes("Sign in to confirm")) {
          reject(new Error(
            "YouTube a détecté une requête automatique (IP datacenter Vercel)."
          ));
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
