import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";

const dm_sans = DM_Sans({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-dm-sans",
});

export const metadata: Metadata = {
    title: "BuildPCB.ai",
    description: "AI-powered IDE for designing electronic circuits and PCBs.",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
        <body className={dm_sans.className}>{children}</body>
        </html>
    );
}