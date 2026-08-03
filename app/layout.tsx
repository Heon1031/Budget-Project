import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "둘이살림 | 부부 생활비 플래너",
  description: "두 사람의 소득에 맞춰 공동생활비, 분담액, 저축 목표를 계산하는 부부 가계부",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
