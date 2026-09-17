import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  themeColor: "#7C3AED",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.BASE_URL || "https://app.evandro.watch"),
  title: {
    default: "WatchMap",
    template: "%s | WatchMap",
  },
  applicationName: "WatchMap",
  description: "Hospedagem de vídeo, player configurável e analytics para vídeos de venda.",
  icons: {
    icon: [
      { url: "/brand/watchmap-icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/brand/watchmap-icon.svg",
    apple: "/brand/watchmap-icon.svg",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://app.evandro.watch",
    siteName: "WatchMap",
    title: "WatchMap",
    description: "Hospedagem de vídeo, player configurável e analytics para vídeos de venda.",
  },
  twitter: {
    card: "summary",
    title: "WatchMap",
    description: "Hospedagem de vídeo, player configurável e analytics para vídeos de venda.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

