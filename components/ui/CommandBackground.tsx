import type { ReactNode } from "react";

/**
 * Tactical command backdrop: a slow ember nebula, a faint targeting grid,
 * CRT scanlines, a corner-anchored holo glow, grain and a vignette.
 * Purely decorative layers sit behind `children`.
 */
export default function CommandBackground({ children }: { children: ReactNode }) {
    return (
        <div className="relative isolate flex h-full w-full flex-col overflow-hidden bg-[var(--void-0)]">
            {/* ember nebula — warm, drifting, replaces the old blue aurora */}
            <div
                className="animate-nebula pointer-events-none absolute -inset-[30%] -z-30 opacity-70 blur-[60px]"
                style={{
                    backgroundImage: [
                        "radial-gradient(60% 80% at 18% 22%, rgba(244,140,40,0.30), transparent 60%)",
                        "radial-gradient(55% 75% at 82% 30%, rgba(196,40,52,0.28), transparent 62%)",
                        "radial-gradient(70% 60% at 50% 92%, rgba(86,40,120,0.30), transparent 65%)",
                    ].join(","),
                    backgroundSize: "200% 200%, 200% 200%, 200% 200%",
                }}
            />

            {/* deep space tint to keep everything legible */}
            <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(120%_120%_at_50%_-10%,transparent_40%,rgba(5,5,8,0.85)_100%)]" />

            {/* targeting grid */}
            <div className="tactical-grid pointer-events-none absolute inset-0 -z-20 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_85%)]" />

            {/* corner holo bloom */}
            <div className="animate-flicker pointer-events-none absolute -right-40 -top-40 -z-20 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,rgba(244,183,64,0.18),transparent_70%)]" />

            {/* scanlines + grain texture */}
            <div className="scanlines pointer-events-none absolute inset-0 -z-10 opacity-50" />
            <div className="grain pointer-events-none absolute inset-0 -z-10 opacity-[0.07]" />

            {children}
        </div>
    );
}
