import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "漫想 · AI 漫画工作台",
  description: "从一个故事念头开始，创作剧本、设计角色、拆解分镜，生成属于你的漫画。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
