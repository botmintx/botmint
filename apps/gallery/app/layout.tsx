import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "botmint gallery",
  description: "Dev sample of generated Grok Bot templates. Unofficial community project.",
  icons: { icon: "/brand/favicon.svg" },
};

function href(path: string): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${path}`;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void text-fog">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
            <a href={href("/")} className="text-lg tracking-tight">
              botmint
            </a>
            <nav className="flex gap-5 text-sm text-muted">
              <a href={href("/")}>Gallery</a>
              <a href={href("/stats/")}>Stats</a>
              <a href={href("/provenance/")}>Provenance</a>
              <a href={href("/mint/")}>Mint</a>
              <a href={href("/claim/")}>Claim</a>
            </nav>
          </div>
        </header>
        <div className="border-b border-line bg-carbon">
          <p className="mx-auto max-w-6xl px-6 py-3 text-sm text-mint">
            Dev sample — not Genesis. 25 bots from seed botmint-dev-sample-001
          </p>
        </div>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-line px-6 py-8 text-sm text-muted">
          <p className="mx-auto max-w-6xl">
            botmint is an unofficial community project, not affiliated with xAI or X. MIT licensed.
          </p>
        </footer>
      </body>
    </html>
  );
}
