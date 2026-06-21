import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CareAI Health — AI Front Desk",
  description: "AI-powered voice agent for healthcare appointment management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0a0f1a] text-white">
        {children}
      </body>
    </html>
  );
}
