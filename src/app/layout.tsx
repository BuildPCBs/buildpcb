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
        <body className={`${dm_sans.className} bg-zinc-100`}>
        {/* The main app - only visible on large screens */}
        <main className="hidden lg:block bg-white">{children}</main>

        {/* A message for users on screens that are too small */}
        <div className="lg:hidden flex h-screen flex-col items-center justify-center bg-white p-4 text-center">
            <h1 className="text-2xl font-bold text-zinc-900">Screen Too Small</h1>
            <p className="mt-2 text-zinc-500">
                Please use a larger screen (at least 1024px wide) to use BuildPCB.ai.
            </p>
        </div>
        </body>
        </html>
    );
}