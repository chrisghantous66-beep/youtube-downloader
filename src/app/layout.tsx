import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VideoGrab - Downloader YouTube, Instagram & Facebook",
  description: "Téléchargez des vidéos YouTube, Instagram et Facebook en qualité native",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="bg-zinc-950 text-white min-h-screen antialiased">{children}</body>
    </html>
  );
}
