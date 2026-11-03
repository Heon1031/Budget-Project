import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const base = new URL(`${protocol}://${host}`);
  const image = new URL("/og.png", base).toString();

  return {
    metadataBase: base,
    title: "둘이자산 | 신혼부부 자산형성 플래너",
    description:
      "2026년 세금과 4대보험을 반영해 실수령액, 목표자산, 용돈, 교육비와 투자 가능액을 계산하는 신혼부부 자산관리 도구",
    icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "둘이자산", statusBarStyle: "default" },
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// 홈 화면에 설치한 앱이 인터넷 없이도 열리게 오프라인 저장(sw.js)을 켠다.
const registerServiceWorker = `if("serviceWorker"in navigator&&location.hostname!=="localhost"){addEventListener("load",function(){navigator.serviceWorker.register("/sw.js").catch(function(){})})}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard(OFL): 화면에 나온 글자가 든 조각만 받아 온다. public 파일이라 묶음(bundle)에 넣지 않는다. */}
        {/* eslint-disable-next-line @next/next/no-css-tags */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: registerServiceWorker }} />
      </body>
    </html>
  );
}
