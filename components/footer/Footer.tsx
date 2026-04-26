import Link from "next/link";

export default function Footer() {
    return (
        <footer className="flex items-center justify-center text-stone-500 text-sm p-2 bg-black/50 backdrop-blur-xl border border-white/[0.08] rounded-xl w-auto px-4 shadow-xl shadow-black/50 drop-shadow-lg">
            <div className="flex flex-row items-center gap-2">
                <Link href="/">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-house-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                </Link>
                <div className="w-px h-4 bg-stone-400"></div>
                <p className="text-stone-50">넌 쓰레기야</p>
            </div>
        </footer>
    );
}