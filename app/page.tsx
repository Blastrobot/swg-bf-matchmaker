import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { FloatingSticker } from "./components/FloatingSticker";

export default function Home() {
    return (
        <section className="relative flex flex-col items-center justify-center gap-9 px-6 text-[var(--ink)]">
            <FloatingSticker src="/assets/shitters.svg" alt="Shitters" size={200} />

            {/* title block */}
            <div className="flex flex-col items-center gap-3">
                <span className="label flex items-center gap-2.5 text-[11px] text-holo-300/80 animate-rise">
                    <span className="h-px w-8 bg-holo-400/50" />
                    Star Wars Galaxies
                    <span className="h-px w-8 bg-holo-400/50" />
                </span>

                <h1
                    className="font-display text-7xl sm:text-8xl uppercase leading-[0.82] tracking-tight text-center animate-rise"
                    style={{ animationDelay: "60ms" }}
                >
                    <span className="block text-[var(--ink)] drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)]">
                        Battlefield
                    </span>
                    <span className="block holo-text">Matchmaker</span>
                </h1>

                <p
                    className="label max-w-xs text-center text-[10px] leading-relaxed text-stone-500 animate-rise"
                    style={{ animationDelay: "120ms" }}
                >
                    Draft · Hit your keys · Win
                </p>
            </div>

            {/* CTA */}
            <Link
                href="/lobby"
                className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-holo-400/30 bg-black/50 px-7 py-3.5 backdrop-blur-md transition-all hover:border-holo-400/70 hover:bg-black/70 animate-rise glow-amber"
                style={{ animationDelay: "180ms" }}
            >
                {/* sheen sweep */}
                <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:animate-sweep group-hover:opacity-100" />
                <span className="label text-sm text-holo-100">Enter 👺</span>
                <ArrowUpRight className="size-4 text-holo-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
        </section>
    );
}
