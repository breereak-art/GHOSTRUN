import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "GHOSTRUN — Agent reliability laboratory",
  description: "Discover, reproduce and inspect failures in tool-using agents.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
