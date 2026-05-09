import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import { mkdtempSync, createReadStream, unlinkSync, rmSync, existsSync, readdirSync, statSync } from "fs";
import { Readable } from "stream";

const YT_DLP = path.join(process.cwd(), "yt-dlp.exe");

function ytDlpDownload(url: string, formatId: string, cookies?: string): Promise<{ filePath: string; tmpDir: string }> {
  return new Promise((resolve, reject) => {
    const tmpDir = mkdtempSync(path.join(process.cwd(), ".tmp-dl-"));
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

    const proc = spawn(YT_DLP, args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        reject(new Error(stderr.trim().split("\n").pop() || `yt-dlp exited with code ${code}`));
        return;
      }

      try {
        const files = readdirSync(tmpDir);
        const foundFile = path.join(tmpDir, files.find((f: string) => f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv")) || files[0] || "");

        if (!foundFile || !existsSync(foundFile)) {
          rmSync(tmpDir, { recursive: true, force: true });
          reject(new Error("Fichier téléchargé introuvable"));
          return;
        }

        resolve({ filePath: foundFile, tmpDir });
      } catch (err) {
        try { rmSync(tmpDir, { recursive: true, force: true }); } catch {}
        reject(err instanceof Error ? err : new Error("Erreur inconnue"));
      }
    });

    proc.on("error", reject);
  });
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const formatId = req.nextUrl.searchParams.get("id");
  const cookies = req.nextUrl.searchParams.get("cookies") || undefined;

  if (!url || !formatId) {
    return NextResponse.json(
      { error: "URL ou format manquant" },
      { status: 400 }
    );
  }

  try {
    const { filePath, tmpDir } = await ytDlpDownload(url, formatId, cookies);

    const fileSize = statSync(filePath).size;
    const ext = path.extname(filePath).replace(".", "") || "mp4";
    const nodeStream = createReadStream(filePath);

    function cleanup() {
      try {
        unlinkSync(filePath);
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }

    // Clean up when stream finishes or errors
    nodeStream.on("end", cleanup);
    nodeStream.on("error", cleanup);
    nodeStream.on("close", cleanup);

    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new Response(webStream, {
      headers: {
        "Content-Disposition": `attachment; filename="video.${ext}"`,
        "Content-Type": ext === "webm" ? "video/webm" : "video/mp4",
        "Content-Length": String(fileSize),
      },
    });
  } catch (err) {
    console.error("yt-dlp download error:", err);
    const message =
      err instanceof Error ? err.message : "Erreur lors du téléchargement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
