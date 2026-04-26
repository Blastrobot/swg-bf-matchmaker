"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROFESSIONS, type MatchFormat, type Profession } from "@/lib/types";
import { ArrowRight, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const FORMATS: MatchFormat[] = ["6s", "8s", "10s", "12s", "14s", "16s"];

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
    const [teamNames, setTeamNames] = useState(["", ""]);
    const [format, setFormat] = useState<MatchFormat>("8s");
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
                format,
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

    return (
        <>
            {/* ── main card ── */}
            <section className="w-full max-w-sm rounded-2xl p-7 bg-black/50 backdrop-blur-2xl border border-white/[0.1] shadow-2xl text-stone-100 flex flex-col gap-7">

                {/* create section */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase text-stone-500">New lobby</h2>
                    <Button
                        className="w-full bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-stone-100 rounded-xl h-11 font-semibold tracking-wide transition-all"
                        onClick={() => setCreateModalOpen(true)}
                    >
                        Create lobby
                    </Button>
                </div>

                <div className="h-px bg-white/[0.08]" />

                {/* join section */}
                <div className="flex flex-col gap-3">
                    <h2 className="text-[11px] font-bold tracking-[0.18em] uppercase text-stone-500">Join existing</h2>
                    <div className="flex gap-2">
                        <Input
                            placeholder="Lobby code"
                            value={lobbyCode}
                            onChange={e => { setLobbyCode(e.target.value); setLobbyCodeError(""); }}
                            onKeyDown={e => e.key === "Enter" && handleValidateCode()}
                            className="bg-white/[0.05] border-white/[0.1] text-stone-100 placeholder:text-stone-600 rounded-xl h-11 font-mono text-sm"
                        />
                        <Button
                            onClick={handleValidateCode}
                            className="bg-white/[0.08] hover:bg-white/[0.14] border border-white/[0.1] text-stone-100 rounded-xl h-11 px-4 shrink-0"
                        >
                            <ArrowRight className="size-4" />
                        </Button>
                    </div>
                    {lobbyCodeError && (
                        <p className="text-red-400 text-xs font-mono tracking-wide">{lobbyCodeError}</p>
                    )}
                </div>
            </section>

            {/* ── create modal ── */}
            {createModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="w-full max-w-md rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.1] shadow-2xl text-stone-100 flex flex-col gap-6 p-7 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold tracking-tight">Configure lobby</h2>
                            <button onClick={() => setCreateModalOpen(false)} className="text-stone-400 hover:text-stone-100 transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>

                        {/* admin info */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Your name</label>
                            <Input
                                placeholder="Name"
                                value={adminName}
                                onChange={e => setAdminName(e.target.value)}
                                className="bg-white/[0.05] border-white/[0.1] text-stone-100 placeholder:text-stone-600 rounded-xl"
                            />
                        </div>

                        {/* admin professions */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Your professions</label>
                            <div className="flex flex-wrap gap-2">
                                {PROFESSIONS.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => toggleAdminProfession(p)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                                            adminProfessions.includes(p)
                                                ? "bg-white/[0.2] border-white/[0.4] text-white"
                                                : "bg-white/[0.05] border-white/[0.1] text-stone-400 hover:border-white/[0.2] hover:text-stone-200"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* format */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Match format</label>
                            <div className="flex flex-wrap gap-2">
                                {FORMATS.map(f => (
                                    <button
                                        key={f}
                                        type="button"
                                        onClick={() => setFormat(f)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                                            format === f
                                                ? "bg-white/[0.2] border-white/[0.4] text-white"
                                                : "bg-white/[0.05] border-white/[0.1] text-stone-400 hover:border-white/[0.2] hover:text-stone-200"
                                        }`}
                                    >
                                        {f}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* team names */}
                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Teams</label>
                            <div className="flex flex-col gap-2">
                                {teamNames.map((name, i) => (
                                    <div key={i} className="flex gap-2 items-center">
                                        <Input
                                            placeholder={`Team ${i + 1} name`}
                                            value={name}
                                            onChange={e => updateTeamName(i, e.target.value)}
                                            className="bg-white/[0.05] border-white/[0.1] text-stone-100 placeholder:text-stone-600 rounded-xl"
                                        />
                                        {teamNames.length > 2 && (
                                            <button
                                                type="button"
                                                onClick={() => removeTeam(i)}
                                                className="text-stone-500 hover:text-red-400 transition-colors"
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
                                    className="flex items-center gap-1.5 text-xs text-stone-400 hover:text-stone-200 transition-colors mt-1 self-start"
                                >
                                    <Plus className="size-3.5" /> Add team
                                </button>
                            )}
                        </div>

                        {createError && <p className="text-red-400 text-sm">{createError}</p>}

                        <Button
                            onClick={handleCreateSubmit}
                            disabled={createLoading}
                            className="w-full bg-white/[0.15] hover:bg-white/[0.25] border border-white/[0.1] text-stone-100 rounded-xl h-11 font-semibold"
                        >
                            {createLoading ? "Creating…" : "Create lobby"}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── join modal ── */}
            {joinModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                    <div className="w-full max-w-sm rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.1] shadow-2xl text-stone-100 flex flex-col gap-6 p-7">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold tracking-tight">Join lobby</h2>
                            <button onClick={() => setJoinModalOpen(false)} className="text-stone-400 hover:text-stone-100 transition-colors">
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Your name</label>
                            <Input
                                placeholder="Name"
                                value={joinName}
                                onChange={e => setJoinName(e.target.value)}
                                className="bg-white/5 border-white/10 text-stone-100 placeholder:text-stone-500 rounded-xl"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Your professions</label>
                            <div className="flex flex-wrap gap-2">
                                {PROFESSIONS.map(p => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => toggleJoinProfession(p)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                                            joinProfessions.includes(p)
                                                ? "bg-white/20 border-white/40 text-white"
                                                : "bg-white/5 border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200"
                                        }`}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <Button
                            onClick={handleJoinSubmit}
                            disabled={joinLoading || !joinName.trim() || joinProfessions.length === 0}
                            className="w-full bg-white/15 hover:bg-white/25 border border-white/10 text-stone-100 rounded-xl h-11 font-semibold disabled:opacity-40"
                        >
                            {joinLoading ? "Joining…" : "Join"}
                        </Button>
                    </div>
                </div>
            )}
        </>
    );
}