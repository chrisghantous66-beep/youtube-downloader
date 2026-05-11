import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "./theme";

export const metadata: Metadata = {
  title: "VideoGrab - Instagram & Facebook Downloader",
  description: "Téléchargez des vidéos Instagram et Facebook en qualité native",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="dark">
      <body className="bg-zinc-950 text-white min-h-screen antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
