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

export const metadata: Metadata = {
  title: "Booming Bookkeeping Performance Reports",
  description: "Bill's decision questions, complete July revenue, and paid-click cohort performance.",
  openGraph: {
    title: "Booming Bookkeeping Performance Reports",
    description: "Three focused views of registration, revenue, and paid-ad performance.",
    images: [{ url: "/og-dashboard.png", width: 1536, height: 1024 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Booming Bookkeeping Performance Reports",
    description: "Three focused views of registration, revenue, and paid-ad performance.",
    images: ["/og-dashboard.png"],
  },
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
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
