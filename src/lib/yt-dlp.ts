import { spawn } from "child_process";
import { existsSync, chmodSync } from "fs";
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

function cookiesToHeader(cookiesContent: string): string | null {
  // Parse Netscape cookie format and extract key=value pairs for YouTube/Google
  const lines = cookiesContent.trim().split(/\r?\n/);
  const pairs: string[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || line.trim() === "") continue;
    const parts = line.split("\t");
    if (parts.length < 7) continue;

    const domain = parts[0].trim();
    const name = parts[5].trim();
    const value = parts[6].trim();

    // Only include YouTube and Google auth cookies
    if (
      domain.includes("youtube.com") ||
      domain.includes(".youtube.com") ||
      domain.includes("google.com") ||
      domain.includes(".google.com")
    ) {
      pairs.push(`${name}=${value}`);
    }
  }

  return pairs.length > 0 ? pairs.join("; ") : null;
}

function buildArgs(url: string, cookiesContent?: string): string[] {
  const args = ["--no-playlist", "--no-warnings"];

  if (cookiesContent && cookiesContent.trim().length > 0) {
    const cookieHeader = cookiesToHeader(cookiesContent);
    if (cookieHeader) {
      // Write cookies to temp file AND add header (belt and suspenders)
      const tmpDir = isVercel ? "/tmp" : require("os").tmpdir();
      const cookieFile = path.join(tmpDir, `.cookies-${Date.now()}.txt`);
      require("fs").writeFileSync(cookieFile, cookiesContent.trim(), "utf-8");
      args.push("--cookies", cookieFile);
      args.push("--add-header", `Cookie: ${cookieHeader}`);
      // Force web client with cookies
      const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
      if (isYouTube) {
        args.push("--extractor-args", "youtube:player_client=web");
      }
    }
  } else {
    // Without cookies on Vercel: use tv_embed client to avoid bot detection.
    // tv_embed has more formats than android, better chance of working.
    // Locally: use default client for full quality (residential IP).
    const isYouTube = url.includes("youtube.com") || url.includes("youtu.be");
    if (isYouTube && isVercel) {
      args.push("--extractor-args", "youtube:player_client=tv_embed");
    }
  }

  args.push(url);
  return args;
}

function runYtDlp(bin: string, args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    proc.on("close", (code) => { resolve({ stdout, stderr, code: code || 0 }); });
    proc.on("error", reject);
  });
}

export async function ytDlpJson(
  url: string,
  cookiesContent?: string
): Promise<Record<string, unknown>> {
  const bin = await ensureYtDlp();

  // Try with cookies first
  if (cookiesContent && cookiesContent.trim().length > 0) {
    const args = ["--dump-json", ...buildArgs(url, cookiesContent)];
    const result = await runYtDlp(bin, args);

    if (result.code === 0) {
      try { return JSON.parse(result.stdout.trim()); }
      catch { /* fall through */ }
    }

    // Cookies failed — on Vercel, inform clearly. Locally, retry without.
    const err = result.stderr.trim();
    console.log("yt-dlp with cookies failed:", err.substring(0, 200));

    if (isVercel) {
      throw new Error(
        "Les cookies n'ont pas fonctionné. Vérifiez que le fichier exporté contient des lignes .youtube.com " +
        "(ouvrez le .txt pour vérifier). Si le problème persiste, utilisez l'app en local: npm run dev"
      );
    }

    // Local: retry without cookies (works on residential IP)
    const retryArgs = ["--dump-json", ...buildArgs(url, undefined)];
    const retryResult = await runYtDlp(bin, retryArgs);

    if (retryResult.code !== 0) {
      const retryErr = retryResult.stderr.trim();
      if (retryErr.includes("Sign in to confirm") || retryErr.includes("bot")) {
        throw new Error("YouTube bloque cette requête. Ajoutez vos cookies YouTube.");
      }
      throw new Error(retryErr.split("\n").pop() || `yt-dlp exited with code ${retryResult.code}`);
    }

    try { return JSON.parse(retryResult.stdout.trim()); }
    catch { throw new Error("Failed to parse video info"); }
  }

  // No cookies path
  const args = ["--dump-json", ...buildArgs(url, undefined)];
  const result = await runYtDlp(bin, args);

  if (result.code !== 0) {
    const err = result.stderr.trim();
    if (err.includes("Sign in to confirm") || err.includes("bot")) {
      throw new Error("YouTube bloque cette requête. Ajoutez vos cookies YouTube (section Cookies).");
    }
    throw new Error(err.split("\n").pop() || `yt-dlp exited with code ${result.code}`);
  }

  try { return JSON.parse(result.stdout.trim()); }
  catch { throw new Error("Failed to parse video info"); }
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
