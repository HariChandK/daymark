import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "Daymark — Plan the day. Remember the life.",
    description: "A private daily planner and journal for tasks, timelines, moods, and memories.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Daymark", description: "Plan the day. Remember the life.", type: "website", images: [{ url: `${origin}/og.jpg`, width: 1736, height: 907, alt: "Daymark — Plan the day. Remember the life." }] },
    twitter: { card: "summary_large_image", title: "Daymark", description: "Plan the day. Remember the life.", images: [`${origin}/og.jpg`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
