import type { Metadata } from "next";
import { Anton, Chakra_Petch, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Footer from "@/components/footer/Footer";
import CommandBackground from "@/components/ui/CommandBackground";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
});

const chakra = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-chakra-petch",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  title: "SWG BF Matchmaker",
  description: "Team matchmaking console for Star Wars Galaxies — hit your buttons please.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${anton.variable} ${chakra.variable} ${jetbrains.variable}`}>
      <body className="font-chakra antialiased h-screen w-screen flex flex-col relative overflow-hidden">
        <CommandBackground>
          <main className="flex flex-1 items-center justify-center w-full overflow-hidden">
            {children}
          </main>
        </CommandBackground>
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <Footer />
        </div>
      </body>
    </html>
  );
}
