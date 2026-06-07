import type { Profession } from "./types";

/**
 * Shared profession visual system. Each profession owns a hue used across
 * badges, slot zones and pick toggles so the rainbow reads consistently
 * against the amber-on-void chrome.
 */
export const PROFESSION_STYLES: Record<
    Profession,
    { bg: string; chip: string; text: string; border: string; dot: string; ring: string }
> = {
    medic:    { bg: "bg-emerald-950/50", chip: "bg-emerald-400/10", text: "text-emerald-300", border: "border-emerald-700/40", dot: "bg-emerald-400", ring: "ring-emerald-400/60" },
    officer:  { bg: "bg-sky-950/50",     chip: "bg-sky-400/10",     text: "text-sky-300",     border: "border-sky-700/40",     dot: "bg-sky-400",     ring: "ring-sky-400/60" },
    commando: { bg: "bg-red-950/50",     chip: "bg-red-400/10",     text: "text-red-300",     border: "border-red-700/40",     dot: "bg-red-400",     ring: "ring-red-400/60" },
    bh:       { bg: "bg-amber-950/50",   chip: "bg-amber-400/10",   text: "text-amber-300",   border: "border-amber-700/40",   dot: "bg-amber-400",   ring: "ring-amber-400/60" },
    smuggler: { bg: "bg-fuchsia-950/50", chip: "bg-fuchsia-400/10", text: "text-fuchsia-300", border: "border-fuchsia-700/40", dot: "bg-fuchsia-400", ring: "ring-fuchsia-400/60" },
    jedi:     { bg: "bg-cyan-950/50",    chip: "bg-cyan-400/10",    text: "text-cyan-300",    border: "border-cyan-700/40",    dot: "bg-cyan-400",    ring: "ring-cyan-400/60" },
    spy:      { bg: "bg-zinc-800/60",    chip: "bg-zinc-400/10",    text: "text-zinc-300",    border: "border-zinc-600/40",    dot: "bg-zinc-400",    ring: "ring-zinc-400/60" },
};

export const PROFESSION_LABEL: Record<Profession, string> = {
    medic: "medic",
    officer: "officer",
    commando: "commando",
    bh: "bounty hunter",
    smuggler: "smuggler",
    jedi: "jedi",
    spy: "spy",
};
