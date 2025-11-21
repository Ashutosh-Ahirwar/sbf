import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// URL Configuration
// TIP: When testing locally with ngrok, update this to your ngrok URL temporarily 
// so the embed works in the preview tool.
const appUrl = process.env.NEXT_PUBLIC_URL || "https://search-by-fid.vercel.app";

// Mini App Embed JSON
const embed = {
  version: "1",
  imageUrl: `${appUrl}/hero.png`, // Must be 3:2 aspect ratio (e.g. 1200x800)
  button: {
    title: "Start Searching",
    action: {
      type: "launch_frame",
      name: "Search by FID",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`, // Must be 200x200px
      splashBackgroundColor: "#F5F8FF",
    },
  },
};

export const metadata: Metadata = {
  title: "Search by FID",
  description: "Search user by their FID",
  openGraph: {
    title: "Search by FID",
    description: "Search user by their FID",
  },
  other: {
    // "fc:frame" is used for backward compatibility
    "fc:frame": JSON.stringify(embed),
    // "fc:miniapp" is the modern standard
    "fc:miniapp": JSON.stringify(embed),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-neutral-950`}
      >
        {children}
      </body>
    </html>
  );
}