import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "duri-budget.heon.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "둘이자산 | 신혼부부 자산형성 플래너",
    description:
      "2026년 세금과 4대보험을 반영해 실수령액, 목표자산, 용돈, 교육비와 투자 가능액을 계산하는 신혼부부 자산관리 도구",
    icons: { icon: "/favicon.svg" },
    openGraph: {
      title: "둘이자산 | 월급에서 자산으로",
      description: "신혼부부 자산형성 플래너",
      images: [{ url: image, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: "둘이자산 | 월급에서 자산으로",
      description: "신혼부부 자산형성 플래너",
      images: [image],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
