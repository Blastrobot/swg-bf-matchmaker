import { forwardRef } from "react";
import { toBlob } from "html-to-image";
import type { Player, Profession, Team } from "@/lib/types";
import { PROFESSION_STYLES, PROFESSION_LABEL } from "@/lib/professions";
import { ProfessionBadge } from "./ProfessionBadge";

const SHEET_BG = "#0b0b10"; // var(--void-1)

// One filled slot: required-role chip + the player's name and profession set.
function ExportSlot({ profession, player }: { profession: Profession; player: Player }) {
    const s = PROFESSION_STYLES[profession];
    return (
        <div className="flex flex-col gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-medium capitalize tracking-tight ${s.chip} ${s.text}`}>
                <span className={`size-1.5 rounded-full ${s.dot}`} />
                {PROFESSION_LABEL[profession]}
            </span>
            <div className="flex flex-col gap-2 px-0.5">
                <span className="text-sm font-medium text-stone-100">{player.name}</span>
                <div className="flex flex-wrap gap-1.5">
                    {player.professions.map(p => <ProfessionBadge key={p} profession={p} />)}
                </div>
            </div>
        </div>
    );
}

function ExportTeam({ team, slots }: { team: Team; slots: Profession[] }) {
    // Pack filled slots only — no empty gaps. Falls back to free-form players
    // (using each player's first profession as the label) when no slots defined.
    const rows: Array<{ profession: Profession; player: Player }> = slots.length > 0
        ? slots
            .map((profession, i) => ({ profession, player: team.players[i] ?? null }))
            .filter((r): r is { profession: Profession; player: Player } => r.player !== null)
        : team.players
            .filter((p): p is Player => p !== null)
            .map(player => ({ profession: player.professions[0], player }));

    return (
        <div className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-xl border border-white/[0.1] bg-[var(--void-1)]">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <span className="font-display flex items-center gap-2 text-lg uppercase tracking-wide text-stone-100">
                    <span className="h-3.5 w-0.5 bg-holo-400/70" />
                    {team.name}
                </span>
                <span className="font-mono rounded border border-holo-400/40 bg-holo-400/10 px-1.5 py-0.5 text-[11px] text-holo-300">
                    {rows.length}{slots.length > 0 ? `/${slots.length}` : ""}
                </span>
            </div>
            <div className="flex flex-col gap-2 p-2.5">
                {rows.map((r, i) => (
                    <ExportSlot key={`${team.id}:${i}`} profession={r.profession} player={r.player} />
                ))}
            </div>
        </div>
    );
}

/**
 * Off-screen, opaque, static render of every team — purpose-built for snapshotting
 * to a PNG. No backdrop-blur / grain / scroll so html-to-image captures cleanly.
 */
export const TeamExportSheet = forwardRef<HTMLDivElement, { teams: Team[]; slots: Profession[] }>(
    function TeamExportSheet({ teams, slots }, ref) {
        // Off-screen positioning lives on the WRAPPER. The captured node (`ref`)
        // must be statically positioned — html-to-image clones it with its own
        // styles, so any offset on it would push the clone out of the snapshot
        // box and yield an almost-black image.
        return (
            <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
                <div
                    ref={ref}
                    style={{ background: SHEET_BG }}
                    className="flex w-max max-w-[760px] flex-wrap items-start gap-4 p-6"
                >
                    {teams.map(team => (
                        <ExportTeam key={team.id} team={team} slots={slots} />
                    ))}
                </div>
            </div>
        );
    }
);

/**
 * Snapshot `node` to a PNG and put it on the clipboard. Falls back to a file
 * download when the browser can't write images to the clipboard.
 */
export async function copyTeamsImage(
    node: HTMLElement,
    filename: string,
): Promise<"copied" | "downloaded" | "failed"> {
    const makeBlob = async () => {
        await document.fonts.ready; // ensure Anton / Chakra Petch / JetBrains Mono are loaded
        const blob = await toBlob(node, { pixelRatio: 2, backgroundColor: SHEET_BG, cacheBust: true });
        if (!blob) throw new Error("snapshot failed");
        return blob;
    };

    // Preferred: hand ClipboardItem a Promise<Blob> so the user gesture stays valid.
    try {
        if (navigator.clipboard && "write" in navigator.clipboard && "ClipboardItem" in window) {
            await navigator.clipboard.write([new ClipboardItem({ "image/png": makeBlob() })]);
            return "copied";
        }
    } catch {
        /* fall through to download */
    }

    try {
        const blob = await makeBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        return "downloaded";
    } catch {
        return "failed";
    }
}
