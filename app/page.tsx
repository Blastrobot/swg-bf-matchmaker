import Link from "next/link";
import { Montserrat, Anton } from "next/font/google";
import { FloatingSticker } from "./components/FloatingSticker";

const montserrat = Montserrat({
    subsets: ["latin"],
    weight: ["400", "500", "600", "700", "800", "900"],
    variable: "--font-montserrat",
});

const anton = Anton({
    subsets: ["latin"],
    weight: ["400"],
    variable: "--font-anton",
});

export default function Home() {
  return (
    <section className="flex flex-col items-center justify-center gap-8 text-stone-100">
      <FloatingSticker src="/assets/shitters.svg" alt="Shitters" size={200} />
      <div className="flex flex-col items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-stone-500">Star Wars Galaxies</span>
        <h1 className={`text-8xl font-bold uppercase leading-none tracking-tight text-center drop-shadow-2xl ${anton.className}`}>
          BF<br />Matchmaker
        </h1>
      </div>
      <Link
        href="/lobby"
        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-black/60 hover:bg-black/80 border border-white/[0.08] text-stone-100 font-semibold tracking-widest uppercase text-sm backdrop-blur-sm shadow-xl shadow-black/60 drop-shadow-lg transition-all"
      >
        Enter 👺
      </Link>
    </section>
  );
}
