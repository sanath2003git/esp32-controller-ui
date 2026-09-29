import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { BleProvider } from "@/context/BleContext";
import AppShell from "@/components/AppShell";
import UserSync from "@/components/UserSync";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#080b14",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Robo Controller",
  description: "ESP32-S3 BLE Robot Controller",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Robo Controller",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ClerkProvider>
          <UserSync />
          <BleProvider>
            <AppShell>{children}</AppShell>
          </BleProvider>
        </ClerkProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}

