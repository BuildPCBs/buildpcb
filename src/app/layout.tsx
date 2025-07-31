import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { siteConfig } from "@/lib/site-config";
import { AuthProvider } from "@/hooks/useAuth";
import { AuthOverlayWrapper } from "@/components/auth/AuthOverlayWrapper";
import "./globals.css";

const dm_sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [{ name: `${siteConfig.name} Team` }],
  creator: siteConfig.name,
  publisher: siteConfig.name,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: siteConfig.name,
    title: `${siteConfig.name} - AI-Powered PCB Design IDE`,
    description: siteConfig.description,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: `${siteConfig.name} - AI-Powered PCB Design IDE`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} - AI-Powered PCB Design IDE`,
    description: siteConfig.description,
    images: [siteConfig.twitterImage],
    creator: siteConfig.twitterCreator,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "google-site-verification-code",
    yandex: "yandex-verification-code",
    yahoo: "yahoo-site-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={dm_sans.className}>
        <AuthProvider>
          {children}
          <AuthOverlayWrapper />
        </AuthProvider>
      </body>
    </html>
  );
}
