import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import Footer from "@/components/footer/Footer";
import AuroraBackground from "@/components/ui/Aurora";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SWG BF Matchmaker",
  description: "Team matchmaking App for Star Wars Galaxies - Hit your buttons please",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} antialiased h-screen w-screen flex flex-col relative`}>
          {/* <div className="absolute inset-0">
          </div> */}
          <AuroraBackground>
            <main className="flex flex-1 items-center justify-center w-full">
              {children}
            </main>
          </AuroraBackground>
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <Footer />
          </div>
      </body>
    </html>
  );
}
