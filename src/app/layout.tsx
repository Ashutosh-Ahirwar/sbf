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

//production URL
const appUrl = "https://search-by-fid.vercel.app";

//Mini App Embed JSON using public images
const embed = {
  version: "1",
  imageUrl: `${appUrl}/hero.png`, // Uses hero image for the share card (3:2 ratio recommended)
  button: {
    title: "Start Searching",
    action: {
      type: "launch_frame",
      name: "Search by fid",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`, 
      splashBackgroundColor: "#F5F8FF",
    },
  },
};

export const metadata: Metadata = {
  title: "Search by FID",
  description: "Search user by their FID",
  other: {
    "fc:frame": JSON.stringify(embed),
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}