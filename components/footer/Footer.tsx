import Link from "next/link";

export default function Footer() {
    return (
        <footer className="flex w-auto items-center justify-center rounded-xl border border-white/[0.08] bg-black/50 px-4 p-2 text-sm text-stone-500 shadow-xl shadow-black/50 backdrop-blur-xl">
            <div className="flex flex-row items-center gap-2.5">
                <Link href="/" className="text-stone-400 transition-colors hover:text-holo-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                </Link>
                <div className="h-4 w-px bg-white/15"></div>
                <p className="label text-[10px] text-stone-400">넌 쓰레기야</p>
            </div>
        </footer>
    );
}