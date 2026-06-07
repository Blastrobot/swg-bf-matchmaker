"use client";

import { PROFESSION_STYLES, PROFESSION_LABEL } from "@/lib/professions";
import { PROFESSIONS, type Profession } from "@/lib/types";
import { ArrowRight, Plus, Trash2, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

// ── shared bits ──────────────────────────────────────────────────────────────
function ProfessionToggle({
    profession,
    active,
    onToggle,
}: {
    profession: Profession;
    active: boolean;
    onToggle: () => void;
}) {
    const s = PROFESSION_STYLES[profession];
    return (
        <button
            type="button"
            onClick={onToggle}
            className={`label flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] transition-all ${
                active
                    ? `${s.bg} ${s.border} ${s.text} ring-1 ${s.ring}`
                    : "border-white/[0.08] bg-white/[0.02] text-stone-500 hover:border-white/20 hover:text-stone-300"
            }`}
        >
            <span className={`size-1.5 rounded-full transition-colors ${active ? s.dot : "bg-stone-700"}`} />
            {profession}
        </button>
    );
}

function ModalShell({
    title,
    eyebrow,
    onClose,
    children,
    wide,
}: {
    title: string;
    eyebrow: string;
    onClose: () => void;
    children: React.ReactNode;
    wide?: boolean;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <div
                className={`brackets flex w-full ${wide ? "max-w-md" : "max-w-sm"} max-h-[90vh] flex-col gap-6 overflow-y-auto rounded-2xl border border-white/[0.1] bg-[var(--void-1)]/90 p-7 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-rise`}
            >
                <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                        <span className="label text-[10px] text-holo-300/80">{eyebrow}</span>
                        <h2 className="font-display text-2xl uppercase tracking-wide text-[var(--ink)]">{title}</h2>
                    </div>
                    <button onClick={onClose} className="text-stone-500 transition-colors hover:text-holo-300">
                        <X className="size-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}

export default function Lobby() {
    const router = useRouter();

    // — join flow state
    const [lobbyCode, setLobbyCode] = useState("");
    const [lobbyCodeError, setLobbyCodeError] = useState("");
    const [joinModalOpen, setJoinModalOpen] = useState(false);
    const [pendingMatchId, setPendingMatchId] = useState("");
    const [joinName, setJoinName] = useState("");
    const [joinProfessions, setJoinProfessions] = useState<Profession[]>([]);
    const [joinLoading, setJoinLoading] = useState(false);

    // — create flow state
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [teamNames, setTeamNames] = useState(["Red", "Blue"]);
    const [adminName, setAdminName] = useState("");
    const [adminProfessions, setAdminProfessions] = useState<Profession[]>([]);
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState("");

    // — join: validate code then open modal
    const handleValidateCode = async () => {
        setLobbyCodeError("");
        if (!lobbyCode.trim()) {
            setLobbyCodeError("Enter a lobby code first.");
            return;
        }
        const res = await fetch(`/api/lobby/${lobbyCode.trim()}`);
        if (!res.ok) {
            setLobbyCodeError("Lobby not found. Check the code and try again.");
            return;
        }
        setPendingMatchId(lobbyCode.trim());
        setJoinModalOpen(true);
    };

    const toggleJoinProfession = (p: Profession) => {
        setJoinProfessions(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
        );
    };

    const handleJoinSubmit = async () => {
        if (!joinName.trim() || joinProfessions.length === 0) return;
        setJoinLoading(true);
        const res = await fetch(`/api/lobby/${pendingMatchId}/join`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: joinName.trim(), professions: joinProfessions }),
        });
        setJoinLoading(false);
        if (!res.ok) {
            setLobbyCodeError("Failed to join lobby.");
            setJoinModalOpen(false);
            return;
        }
        const data = await res.json();
        localStorage.setItem(`swg_player_id_${pendingMatchId}`, data.id);
        router.push(`/match/${pendingMatchId}`);
    };

    // — create lobby
    const addTeam = () => {
        if (teamNames.length < 4) setTeamNames(prev => [...prev, ""]);
    };

    const removeTeam = (index: number) => {
        if (teamNames.length <= 2) return;
        setTeamNames(prev => prev.filter((_, i) => i !== index));
    };

    const updateTeamName = (index: number, value: string) => {
        setTeamNames(prev => prev.map((n, i) => (i === index ? value : n)));
    };

    const toggleAdminProfession = (p: Profession) => {
        setAdminProfessions(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
        );
    };

    const handleCreateSubmit = async () => {
        setCreateError("");
        if (!adminName.trim() || adminProfessions.length === 0 || teamNames.some(n => !n.trim())) {
            setCreateError("Fill in all fields and select at least one profession.");
            return;
        }
        setCreateLoading(true);
        const res = await fetch("/api/lobby", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                teamNames: teamNames.map(n => n.trim()),
                adminName: adminName.trim(),
                adminProfessions,
            }),
        });
        setCreateLoading(false);
        if (!res.ok) {
            setCreateError("Failed to create lobby. Try again.");
            return;
        }
        const { matchId, adminToken, adminPlayerId } = await res.json();
        localStorage.setItem(`swg_admin_token_${matchId}`, adminToken);
        localStorage.setItem(`swg_player_id_${matchId}`, adminPlayerId);
        router.push(`/match/${matchId}`);
    };

    const inputClass =
        "w-full rounded-lg border border-white/[0.1] bg-black/40 px-3.5 py-2.5 text-sm text-[var(--ink)] placeholder:text-stone-600 outline-none transition-all focus:border-holo-400/60 focus:ring-1 focus:ring-holo-400/40";

    return (
        <>
            {/* ── main card ── */}
            <section className="brackets flex w-full max-w-sm flex-col gap-7 rounded-2xl border border-white/[0.1] bg-[var(--void-1)]/80 p-7 shadow-2xl shadow-black/50 backdrop-blur-2xl animate-rise">
                <div className="flex flex-col gap-1 border-b border-white/[0.07] pb-4">
                    <span className="label text-[10px] text-holo-300/80">Access terminal</span>
                    <h1 className="font-display text-3xl uppercase tracking-wide text-[var(--ink)]">Operations</h1>
                </div>

                {/* create section */}
                <div className="flex flex-col gap-2.5">
                    <h2 className="label text-[10px] text-stone-500">New lobby</h2>
                    <button
                        onClick={() => setCreateModalOpen(true)}
                        className="group label flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-holo-400/30 bg-holo-400/[0.06] text-sm text-holo-100 transition-all hover:border-holo-400/60 hover:bg-holo-400/[0.12]"
                    >
                        <Plus className="size-4 text-holo-300 transition-transform group-hover:rotate-90" />
                        Create lobby
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.07]" />
                    <span className="label text-[9px] text-stone-600">or</span>
                    <div className="h-px flex-1 bg-white/[0.07]" />
                </div>

                {/* join section */}
                <div className="flex flex-col gap-2.5">
                    <h2 className="label text-[10px] text-stone-500">Join existing</h2>
                    <div className="flex gap-2">
                        <input
                            placeholder="LOBBY CODE"
                            value={lobbyCode}
                            onChange={e => { setLobbyCode(e.target.value); setLobbyCodeError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleValidateCode()}
                            className={`${inputClass} data h-12 tracking-[0.2em] uppercase placeholder:tracking-[0.2em]`}
                        />
                        <button
                            onClick={handleValidateCode}
                            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-stone-300 transition-all hover:border-holo-400/50 hover:text-holo-300"
                        >
                            <ArrowRight className="size-4" />
                        </button>
                    </div>
                    {lobbyCodeError && (
                        <p className="data text-xs tracking-wide text-red-400">{lobbyCodeError}</p>
                    )}
                </div>
            </section>

            {/* ── create modal ── */}
            {createModalOpen && (
                <ModalShell eyebrow="Configure" title="New Lobby" wide onClose={() => setCreateModalOpen(false)}>
                    {/* admin info */}
                    <div className="flex flex-col gap-2">
                        <label className="label text-[10px] text-stone-400">Username</label>
                        <input
                            placeholder="Trashcan"
                            value={adminName}
                            onChange={e => setAdminName(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    {/* admin professions */}
                    <div className="flex flex-col gap-2">
                        <label className="label text-[10px] text-stone-400">Your professions</label>
                        <div className="flex flex-wrap gap-1.5">
                            {PROFESSIONS.map(p => (
                                <ProfessionToggle
                                    key={p}
                                    profession={p}
                                    active={adminProfessions.includes(p)}
                                    onToggle={() => toggleAdminProfession(p)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* team names */}
                    <div className="flex flex-col gap-2">
                        <label className="label text-[10px] text-stone-400">Factions</label>
                        <div className="flex flex-col gap-2">
                            {teamNames.map((name, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="data w-6 shrink-0 text-center text-[10px] text-stone-600">{String(i + 1).padStart(2, "0")}</span>
                                    <input
                                        placeholder={`Team ${i + 1} name`}
                                        value={name}
                                        onChange={e => updateTeamName(i, e.target.value)}
                                        className={inputClass}
                                    />
                                    {teamNames.length > 2 && (
                                        <button
                                            type="button"
                                            onClick={() => removeTeam(i)}
                                            className="shrink-0 text-stone-600 transition-colors hover:text-red-400"
                                        >
                                            <Trash2 className="size-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                        {teamNames.length < 4 && (
                            <button
                                type="button"
                                onClick={addTeam}
                                className="label mt-1 flex items-center gap-1.5 self-start text-[10px] text-stone-500 transition-colors hover:text-holo-300"
                            >
                                <Plus className="size-3.5" /> Add faction
                            </button>
                        )}
                    </div>

                    {createError && <p className="data text-xs text-red-400">{createError}</p>}

                    <button
                        onClick={handleCreateSubmit}
                        disabled={createLoading}
                        className="label flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-holo-400/40 bg-holo-400/[0.1] text-sm text-holo-100 transition-all hover:bg-holo-400/[0.18] disabled:opacity-40"
                    >
                        {createLoading ? "Deploying…" : <>Create lobby <ArrowRight className="size-4" /></>}
                    </button>
                </ModalShell>
            )}

            {/* ── join modal ── */}
            {joinModalOpen && (
                <ModalShell eyebrow="Enlist" title="Join Lobby" onClose={() => setJoinModalOpen(false)}>
                    <div className="flex flex-col gap-2">
                        <label className="label text-[10px] text-stone-400">Username</label>
                        <input
                            placeholder="Sandbag"
                            value={joinName}
                            onChange={e => setJoinName(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="label text-[10px] text-stone-400">Your professions</label>
                        <div className="flex flex-wrap gap-1.5">
                            {PROFESSIONS.map(p => (
                                <ProfessionToggle
                                    key={p}
                                    profession={p}
                                    active={joinProfessions.includes(p)}
                                    onToggle={() => toggleJoinProfession(p)}
                                />
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={handleJoinSubmit}
                        disabled={joinLoading || !joinName.trim() || joinProfessions.length === 0}
                        className="label flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-holo-400/40 bg-holo-400/[0.1] text-sm text-holo-100 transition-all hover:bg-holo-400/[0.18] disabled:opacity-40"
                    >
                        {joinLoading ? "Joining…" : <>Join <Check className="size-4" /></>}
                    </button>
                </ModalShell>
            )}
        </>
    );
}
