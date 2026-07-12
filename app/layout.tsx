import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  return {
    title: "Daymark | Understand your days",
    description: "A private place to notice where your time went, what mattered, and what you want to remember.",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: { title: "Daymark", description: "The days pass quickly. Daymark helps you remember how you lived them.", type: "website", images: [{ url: `${origin}/og.jpg`, width: 1736, height: 907, alt: "Daymark. Your days, held gently." }] },
    twitter: { card: "summary_large_image", title: "Daymark", description: "The days pass quickly. Daymark helps you remember how you lived them.", images: [`${origin}/og.jpg`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
