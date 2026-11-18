import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./client-providers";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import { UI_SCALE_BOOT_SCRIPT } from "@/lib/ui/uiScale";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "be AWARE of your shots",
  description: "by toppjakt.no & coldbarreladjacent",
  appleWebApp: {
    capable: true,
    title: "Aware",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/pwa-icon/180",
  },
};

export const viewport: Viewport = {
  themeColor: "#1f3d2b",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: UI_SCALE_BOOT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ServiceWorkerRegister />
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}

// mock commit for branch sync
