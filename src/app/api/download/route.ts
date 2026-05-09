import { NextRequest, NextResponse } from "next/server";
import { ytDlpDownload } from "@/lib/yt-dlp";
import { createReadStream, unlinkSync, rmSync, statSync } from "fs";
import path from "path";
import { Readable } from "stream";

function streamFile(filePath: string): Response {
  const tmpDir = path.dirname(filePath);
  const fileSize = statSync(filePath).size;
  const ext = path.extname(filePath).replace(".", "") || "mp4";
  const nodeStream = createReadStream(filePath);

  function cleanup() {
    try {
      unlinkSync(filePath);
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }

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
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  const formatId = req.nextUrl.searchParams.get("id");

  if (!url || !formatId) {
    return NextResponse.json({ error: "URL ou format manquant" }, { status: 400 });
  }

  try {
    const filePath = await ytDlpDownload(url, formatId);
    return streamFile(filePath);
  } catch (err) {
    console.error("yt-dlp download error:", err);
    const message = err instanceof Error ? err.message : "Erreur lors du téléchargement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url as string;
    const formatId = body.id as string;
    const opts = {
      username: body.username as string | undefined,
      password: body.password as string | undefined,
      cookiesContent: body.cookies as string | undefined,
    };

    if (!url || !formatId) {
      return NextResponse.json({ error: "URL ou format manquant" }, { status: 400 });
    }

    const filePath = await ytDlpDownload(url, formatId, opts);
    return streamFile(filePath);
  } catch (err) {
    console.error("yt-dlp download error:", err);
    const message = err instanceof Error ? err.message : "Erreur lors du téléchargement";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
