"use client";

import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import type { Lobby, Player, Profession, Team } from "@/lib/types";
import { PROFESSIONS } from "@/lib/types";
import { Copy, Check, Shield, Pencil, X, Settings, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, createContext, useContext } from "react";

const FORMATS = ["6s", "8s", "10s", "12s", "14s", "16s"] as const;

const PROFESSION_STYLES: Record<Profession, { bg: string; text: string; border: string }> = {
    medic:    { bg: "bg-emerald-950/60",  text: "text-emerald-400",  border: "border-emerald-800/50" },
    officer:  { bg: "bg-blue-950/60",     text: "text-blue-400",     border: "border-blue-800/50" },
    commando: { bg: "bg-red-950/60",      text: "text-red-400",      border: "border-red-800/50" },
    bh:       { bg: "bg-amber-950/60",    text: "text-amber-400",    border: "border-amber-800/50" },
    smuggler: { bg: "bg-purple-950/60",   text: "text-purple-400",   border: "border-purple-800/50" },
    jedi:     { bg: "bg-cyan-950/60",     text: "text-cyan-400",     border: "border-cyan-800/50" },
    spy:      { bg: "bg-zinc-800/60",     text: "text-zinc-400",     border: "border-zinc-600/50" },
};

const STATUS_STYLES: Record<string, { label: string; color: string }> = {
    waiting:     { label: "WAITING",     color: "text-amber-400 border-amber-800/50 bg-amber-950/40" },
    in_progress: { label: "IN PROGRESS", color: "text-emerald-400 border-emerald-800/50 bg-emerald-950/40" },
    completed:   { label: "COMPLETED",   color: "text-zinc-400 border-zinc-700/50 bg-zinc-900/40" },
};

// ── Drag context ────────────────────────────────────────────────────────────
type DragSource =
    | { kind: "queue"; player: Player }
    | { kind: "slot"; player: Player; teamId: string; slotIndex: number };

const DragCtx = createContext<{
    dragging: DragSource | null;
    setDragging: (d: DragSource | null) => void;
}>({ dragging: null, setDragging: () => {} });

// ── Shared components ────────────────────────────────────────────────────────
function ProfessionBadge({ profession }: { profession: Profession }) {
    const s = PROFESSION_STYLES[profession];
    return (
        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest border rounded-md ${s.bg} ${s.text} ${s.border}`}>
            {profession}
        </span>
    );
}

function PlayerCard({
    player,
    source,
    isOwn,
    isAdmin,
    onEdit,
}: {
    player: Player;
    source: DragSource;
    isOwn: boolean;
    isAdmin: boolean;
    onEdit: () => void;
}) {
    const { setDragging } = useContext(DragCtx);
    return (
        <div
            draggable={isAdmin}
            onDragStart={() => setDragging(source)}
            onDragEnd={() => setDragging(null)}
            className={`group flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.06] transition-all select-none ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        >
            <div className="flex items-center gap-2">
                {player.isAdmin && <Shield className="size-3 text-amber-400 shrink-0" />}
                <span className="text-sm font-semibold text-stone-100 tracking-wide truncate flex-1">{player.name}</span>
                {isOwn && (
                    <button
                        type="button"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); onEdit(); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 hover:text-stone-200 shrink-0 cursor-pointer"
                    >
                        <Pencil className="size-3" />
                    </button>
                )}
            </div>
            <div className="flex flex-wrap gap-1">
                {player.professions.map(p => <ProfessionBadge key={p} profession={p} />)}
            </div>
        </div>
    );
}

// ── Queue column (formkit free-list) ─────────────────────────────────────────
function QueueColumn({
    players,
    isAdmin,
    myPlayerId,
    isPersistingRef,
    onItemsChange,
    onEditPlayer,
    onDropFromSlot,
}: {
    players: Player[];
    isAdmin: boolean;
    myPlayerId: string;
    isPersistingRef: React.RefObject<boolean>;
    onItemsChange: (items: Player[]) => void;
    onEditPlayer: (player: Player) => void;
    onDropFromSlot: (src: DragSource & { kind: "slot" }) => void;
}) {
    const { dragging, setDragging } = useContext(DragCtx);
    const [over, setOver] = useState(false);
    const [listRef, items, setItems] = useDragAndDrop<HTMLDivElement, Player>(players, {
        group: "match-players",
        disabled: !isAdmin,
    });

    useEffect(() => {
        if (!isPersistingRef.current) setItems(players);
    }, [players]);

    useEffect(() => {
        onItemsChange(items);
    }, [items]);

    const handleDragOver = (e: React.DragEvent) => {
        if (dragging?.kind === "slot") { e.preventDefault(); setOver(true); }
    };
    const handleDragLeave = () => setOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (dragging?.kind === "slot") {
            onDropFromSlot(dragging);
            setDragging(null);
        }
    };

    return (
        <div
            className={`flex flex-col w-56 shrink-0 rounded-xl border overflow-hidden transition-colors ${over ? "border-white/[0.25] bg-white/[0.06]" : "bg-white/[0.03] border-white/[0.08]"}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">Player queue</span>
                <span className="text-[11px] font-mono text-stone-600 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md">{items.length}</span>
            </div>
            <div ref={listRef} className="flex flex-col gap-2 p-2 overflow-y-auto flex-1 min-h-[60px]">
                {items.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-[11px] text-stone-700 uppercase tracking-widest pointer-events-none">
                        {isAdmin ? "Drop here" : "Empty"}
                    </div>
                )}
                {items.map(p => (
                    <PlayerCard
                        key={p.id}
                        player={p}
                        source={{ kind: "queue", player: p }}
                        isOwn={p.id === myPlayerId}
                        isAdmin={isAdmin}
                        onEdit={() => onEditPlayer(p)}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Team slot column ──────────────────────────────────────────────────────────
function SlotDropZone({
    slotIndex,
    requiredProfession,
    occupant,
    teamId,
    isAdmin,
    myPlayerId,
    onDrop,
    onEditPlayer,
}: {
    slotIndex: number;
    requiredProfession: Profession;
    occupant: Player | null;
    teamId: string;
    isAdmin: boolean;
    myPlayerId: string;
    onDrop: (slotIndex: number, src: DragSource) => void;
    onEditPlayer: (player: Player) => void;
}) {
    const { dragging, setDragging } = useContext(DragCtx);
    const [over, setOver] = useState(false);
    const s = PROFESSION_STYLES[requiredProfession];

    const canAccept = dragging
        ? dragging.player.professions.includes(requiredProfession)
        : false;

    const handleDragOver = (e: React.DragEvent) => {
        if (!dragging || !isAdmin) return;
        if (canAccept) { e.preventDefault(); setOver(true); }
    };
    const handleDragLeave = () => setOver(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (dragging && canAccept) {
            onDrop(slotIndex, dragging);
            setDragging(null);
        }
    };

    const borderClass = over
        ? canAccept ? "border-emerald-500/70 bg-emerald-950/30" : "border-red-500/50 bg-red-950/20"
        : dragging && !canAccept && dragging !== null
            ? "border-dashed border-white/[0.1] bg-white/[0.01]"
            : occupant
                ? `${s.border} ${s.bg}`
                : "border-dashed border-white/[0.15] bg-white/[0.02]";

    return (
        <div
            className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border transition-all ${borderClass}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${occupant ? s.text : "text-stone-600"}`}>
                    {requiredProfession}
                </span>
                {!occupant && (
                    <span className="ml-auto text-[9px] text-stone-700 uppercase tracking-widest">empty</span>
                )}
            </div>
            {occupant && (
                <PlayerCard
                    player={occupant}
                    source={{ kind: "slot", player: occupant, teamId, slotIndex }}
                    isOwn={occupant.id === myPlayerId}
                    isAdmin={isAdmin}
                    onEdit={() => onEditPlayer(occupant)}
                />
            )}
        </div>
    );
}

function TeamColumn({
    team,
    slots,
    isAdmin,
    myPlayerId,
    onSlotDrop,
    onEditPlayer,
}: {
    team: Team;
    slots: Profession[];
    isAdmin: boolean;
    myPlayerId: string;
    onSlotDrop: (teamId: string, slotIndex: number, src: DragSource) => void;
    onEditPlayer: (player: Player) => void;
}) {
    return (
        <div className="flex flex-col flex-1 min-w-[220px] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">{team.name}</span>
                <span className="text-[11px] font-mono text-stone-600 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md">
                    {team.players.length}{slots.length > 0 ? `/${slots.length}` : ""}
                </span>
            </div>
            <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
                {slots.length === 0 ? (
                    // No slots configured — free list using useDragAndDrop is not available here;
                    // show players as draggable cards without slot enforcement
                    team.players.length === 0 ? (
                        <div className="flex items-center justify-center h-16 text-[11px] text-stone-700 uppercase tracking-widest">
                            No slots configured
                        </div>
                    ) : (
                        team.players.map((p, i) => (
                            <PlayerCard
                                key={p.id}
                                player={p}
                                source={{ kind: "slot", player: p, teamId: team.id, slotIndex: i }}
                                isOwn={p.id === myPlayerId}
                                isAdmin={isAdmin}
                                onEdit={() => onEditPlayer(p)}
                            />
                        ))
                    )
                ) : (
                    slots.map((prof, i) => (
                        <SlotDropZone
                            key={i}
                            slotIndex={i}
                            requiredProfession={prof}
                            occupant={team.players[i] ?? null}
                            teamId={team.id}
                            isAdmin={isAdmin}
                            myPlayerId={myPlayerId}
                            onDrop={(si, src) => onSlotDrop(team.id, si, src)}
                            onEditPlayer={onEditPlayer}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default function MatchPage() {
    const { matchId } = useParams<{ matchId: string }>();
    const [lobby, setLobby] = useState<Omit<Lobby, "adminToken"> | null>(null);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [myPlayerId, setMyPlayerId] = useState("");
    const adminTokenRef = useRef<string | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // edit modal state
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [editProfessions, setEditProfessions] = useState<Profession[]>([]);
    const [editLoading, setEditLoading] = useState(false);

    // config modal state
    const [configOpen, setConfigOpen] = useState(false);
    const [configFormat, setConfigFormat] = useState<typeof FORMATS[number]>("8s");
    const [configSlots, setConfigSlots] = useState<Profession[]>([]);
    const [configLoading, setConfigLoading] = useState(false);

    // drag context state
    const [dragging, setDragging] = useState<DragSource | null>(null);

    const isPersistingRef = useRef(false);
    const queueSnapshotRef = useRef<Player[]>([]);

    const fetchLobby = useCallback(async () => {
        if (isPersistingRef.current) return;
        const res = await fetch(`/api/lobby/${matchId}`);
        if (!res.ok) { setError("Lobby not found or has expired."); return; }
        const data = await res.json();
        setLobby(data);
    }, [matchId]);

    const persistLobbyState = useCallback((newTeams: Team[], allLobbyPlayers: Player[]) => {
        const token = adminTokenRef.current;
        if (!token) return;
        setLobby(prev => prev ? { ...prev, players: allLobbyPlayers, teams: newTeams } : prev);
        isPersistingRef.current = true;
        fetch(`/api/lobby/${matchId}/teams`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-admin-token": token },
            body: JSON.stringify({ teams: newTeams }),
        }).finally(() => { isPersistingRef.current = false; });
    }, [matchId]);

    const handleQueueChange = useCallback((items: Player[]) => {
        queueSnapshotRef.current = items;
    }, []);

    const handleSlotDrop = useCallback((teamId: string, slotIndex: number, src: DragSource) => {
        setLobby(prev => {
            if (!prev) return prev;
            const incomingPlayer = src.player;
            const targetTeam = prev.teams.find(t => t.id === teamId);
            if (!targetTeam) return prev;
            const currentOccupant = targetTeam.players[slotIndex] ?? null;

            let newTeams = prev.teams.map(team => {
                let players = [...team.players];

                if (src.kind === "slot") {
                    if (team.id === src.teamId) {
                        // same team: clear source slot
                        players[src.slotIndex] = undefined as unknown as Player;
                    }
                }

                if (team.id === teamId) {
                    // handle swap: put displaced occupant into source slot if same team
                    if (currentOccupant && src.kind === "slot" && src.teamId === teamId) {
                        players[src.slotIndex] = currentOccupant;
                    }
                    players[slotIndex] = incomingPlayer;
                }

                return { ...team, players: players.filter(Boolean) as Player[] };
            });

            // cross-team swap: put old occupant into source team source slot
            if (currentOccupant && src.kind === "slot" && src.teamId !== teamId) {
                const srcTeamSlots = prev.slots ?? [];
                const srcRequiredProf = srcTeamSlots[src.slotIndex];
                if (srcRequiredProf && currentOccupant.professions.includes(srcRequiredProf)) {
                    newTeams = newTeams.map(team => {
                        if (team.id !== src.teamId) return team;
                        const players = [...team.players];
                        players[src.slotIndex] = currentOccupant;
                        return { ...team, players: players.filter(Boolean) as Player[] };
                    });
                }
                // else occupant goes to queue (handled below)
            }

            // Build updated queue: remove incoming player, add displaced occupant if no swap
            const allAssigned = new Set(newTeams.flatMap(t => t.players.map(p => p.id)));
            const queueBase = queueSnapshotRef.current.length > 0
                ? queueSnapshotRef.current
                : prev.players.filter(p => !prev.teams.some(t => t.players.some(tp => tp.id === p.id)));

            let newQueue = queueBase.filter(p => p.id !== incomingPlayer.id && !allAssigned.has(p.id));

            // If occupant was displaced and not placed in swap slot, return to queue
            if (currentOccupant && !allAssigned.has(currentOccupant.id)) {
                newQueue = [currentOccupant, ...newQueue];
            }

            queueSnapshotRef.current = newQueue;
            const allPlayers = [...newQueue, ...newTeams.flatMap(t => t.players)];
            const seen = new Set<string>();
            const dedupedPlayers = allPlayers.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

            setTimeout(() => persistLobbyState(newTeams, dedupedPlayers), 0);
            return { ...prev, players: dedupedPlayers, teams: newTeams };
        });
    }, [persistLobbyState]);

    const handleDropToQueue = useCallback((src: DragSource & { kind: "slot" }) => {
        setLobby(prev => {
            if (!prev) return prev;
            const newTeams = prev.teams.map(team => {
                if (team.id !== src.teamId) return team;
                const players = team.players.filter((_, i) => i !== src.slotIndex);
                return { ...team, players };
            });
            const allAssigned = new Set(newTeams.flatMap(t => t.players.map(p => p.id)));
            const queueBase = queueSnapshotRef.current.length > 0
                ? queueSnapshotRef.current
                : prev.players.filter(p => !prev.teams.some(t => t.players.some(tp => tp.id === p.id)));
            const newQueue = allAssigned.has(src.player.id)
                ? queueBase.filter(p => !allAssigned.has(p.id))
                : [...queueBase.filter(p => p.id !== src.player.id && !allAssigned.has(p.id)), src.player];
            queueSnapshotRef.current = newQueue;
            const allPlayers = [...newQueue, ...newTeams.flatMap(t => t.players)];
            const seen = new Set<string>();
            const dedupedPlayers = allPlayers.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
            setTimeout(() => persistLobbyState(newTeams, dedupedPlayers), 0);
            return { ...prev, players: dedupedPlayers, teams: newTeams };
        });
    }, [persistLobbyState]);

    const openConfigModal = useCallback(() => {
        if (!lobby) return;
        setConfigFormat(lobby.format as typeof FORMATS[number]);
        setConfigSlots([...(lobby.slots ?? [])]);
        setConfigOpen(true);
    }, [lobby]);

    const handleConfigSubmit = useCallback(async () => {
        const token = adminTokenRef.current;
        if (!token || !lobby) return;
        setConfigLoading(true);
        const res = await fetch(`/api/lobby/${matchId}/config`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-admin-token": token },
            body: JSON.stringify({ format: configFormat, slots: configSlots }),
        });
        setConfigLoading(false);
        if (res.ok) {
            const updated = await res.json();
            setLobby(updated);
            setConfigOpen(false);
        }
    }, [matchId, lobby, configFormat, configSlots]);

    const addConfigSlot = (p: Profession) => setConfigSlots(prev => [...prev, p]);
    const removeConfigSlot = (index: number) => setConfigSlots(prev => prev.filter((_, i) => i !== index));

    const openEditModal = useCallback((player: Player) => {
        setEditingPlayer(player);
        setEditProfessions([...player.professions]);
    }, []);

    const toggleEditProfession = (p: Profession) => {
        setEditProfessions(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
    };

    const handleEditSubmit = async () => {
        if (!editingPlayer || editProfessions.length === 0) return;
        setEditLoading(true);
        const res = await fetch(`/api/lobby/${matchId}/players/${editingPlayer.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ professions: editProfessions }),
        });
        setEditLoading(false);
        if (res.ok) {
            setLobby(prev => {
                if (!prev) return prev;
                return {
                    ...prev,
                    players: prev.players.map(p => p.id === editingPlayer.id ? { ...p, professions: editProfessions } : p),
                    teams: prev.teams.map(t => ({
                        ...t,
                        players: t.players.map(p => p.id === editingPlayer.id ? { ...p, professions: editProfessions } : p),
                    })),
                };
            });
            setEditingPlayer(null);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem(`swg_admin_token_${matchId}`);
        adminTokenRef.current = token;
        setIsAdmin(!!token);
        const pid = localStorage.getItem(`swg_player_id_${matchId}`);
        setMyPlayerId(pid ?? "");
        fetchLobby();
        const intervalId = setInterval(fetchLobby, 5000);
        intervalRef.current = intervalId;
        return () => clearInterval(intervalId);
    }, [matchId, fetchLobby]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(matchId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center gap-3 text-stone-500">
                <span className="text-xs font-mono uppercase tracking-widest">{error}</span>
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-stone-600 animate-pulse">Connecting…</span>
            </div>
        );
    }

    const status = STATUS_STYLES[lobby.status] ?? STATUS_STYLES.waiting;
    const unassignedPlayers = lobby.players.filter(
        p => !lobby.teams.some(t => t.players.some(tp => tp.id === p.id))
    );

    return (
        <div className="fixed inset-0 flex items-center justify-center p-6 z-10">
            <div
                className="flex flex-col w-full h-full max-h-full text-stone-100 rounded-2xl border border-white/[0.1] bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden"
            >
                {/* ── header ── */}
                <header className="flex items-center justify-between px-5 py-3 border-b border-white/[0.08] shrink-0 bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-500">
                            SWG BF
                        </span>
                        <span className="text-white/20">|</span>
                        <span className="text-xs font-mono font-bold tracking-widest text-stone-300 uppercase bg-white/[0.05] border border-white/[0.08] px-2 py-0.5 rounded-md">
                            {lobby.format}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyCode}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.18] bg-white/[0.03] hover:bg-white/[0.06] transition-all group"
                    >
                        <span className="font-mono text-[11px] text-stone-400 group-hover:text-stone-200 transition-colors tracking-widest truncate max-w-[180px]">
                            {matchId}
                        </span>
                        {copied
                            ? <Check className="size-3 text-emerald-400 shrink-0" />
                            : <Copy className="size-3 text-stone-600 group-hover:text-stone-400 shrink-0 transition-colors" />
                        }
                    </button>

                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={openConfigModal}
                                    className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-stone-400 hover:text-stone-200 border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.03] hover:bg-white/[0.07] px-2 py-1 rounded-md transition-all"
                                >
                                    <Settings className="size-3" /> Configure
                                </button>
                                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400 border border-amber-800/50 bg-amber-950/30 px-2 py-1 rounded-md">
                                    <Shield className="size-3" /> Admin
                                </span>
                            </>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest border px-2 py-1 rounded-md ${status.color}`}>
                            {status.label}
                        </span>
                    </div>
                </header>

                {/* ── columns ── */}
                <DragCtx.Provider value={{ dragging, setDragging }}>
                <div className="flex flex-1 overflow-hidden gap-3 p-4">
                    <QueueColumn
                        players={unassignedPlayers}
                        isAdmin={isAdmin}
                        myPlayerId={myPlayerId}
                        isPersistingRef={isPersistingRef}
                        onItemsChange={handleQueueChange}
                        onEditPlayer={openEditModal}
                        onDropFromSlot={handleDropToQueue}
                    />
                    {lobby.teams.map((team) => (
                        <TeamColumn
                            key={team.id}
                            team={team}
                            slots={lobby.slots ?? []}
                            isAdmin={isAdmin}
                            myPlayerId={myPlayerId}
                            onSlotDrop={handleSlotDrop}
                            onEditPlayer={openEditModal}
                        />
                    ))}
                </div>
                </DragCtx.Provider>

                {/* ── config modal ── */}
                {configOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                        <div className="w-full max-w-md rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.1] shadow-2xl text-stone-100 flex flex-col gap-6 p-7 max-h-[90vh] overflow-y-auto">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Match settings</span>
                                    <span className="text-base font-semibold text-stone-100">Configure lobby</span>
                                </div>
                                <button type="button" onClick={() => setConfigOpen(false)} className="text-stone-400 hover:text-stone-100 transition-colors">
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Match format</label>
                                <div className="flex flex-wrap gap-2">
                                    {FORMATS.map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setConfigFormat(f)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                                                configFormat === f
                                                    ? "bg-white/[0.2] border-white/[0.4] text-white"
                                                    : "bg-white/[0.05] border-white/[0.1] text-stone-400 hover:border-white/[0.2] hover:text-stone-200"
                                            }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Team slots</label>
                                <p className="text-[11px] text-stone-500">Define the required profession for each slot. Applies symmetrically to all teams.</p>

                                {configSlots.length > 0 && (
                                    <div className="flex flex-col gap-1">
                                        {configSlots.map((s, i) => {
                                            const st = PROFESSION_STYLES[s];
                                            return (
                                                <div key={i} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${st.bg} ${st.border}`}>
                                                    <span className={`text-[10px] font-bold uppercase tracking-widest flex-1 ${st.text}`}>
                                                        Slot {i + 1} — {s}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeConfigSlot(i)}
                                                        className="text-stone-500 hover:text-red-400 transition-colors"
                                                    >
                                                        <X className="size-3" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <span className="text-[10px] uppercase tracking-widest text-stone-600">Add slot</span>
                                    <div className="flex flex-wrap gap-2">
                                        {PROFESSIONS.map(p => (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => addConfigSlot(p)}
                                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border bg-white/[0.05] border-white/[0.1] text-stone-400 hover:border-white/[0.2] hover:text-stone-200 transition-all"
                                            >
                                                <Plus className="size-3" />{p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleConfigSubmit}
                                disabled={configLoading}
                                className="w-full bg-white/[0.1] hover:bg-white/[0.18] border border-white/[0.1] text-stone-100 rounded-xl h-10 text-sm font-semibold tracking-wide transition-all disabled:opacity-40"
                            >
                                {configLoading ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── edit profile modal ── */}
                {editingPlayer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
                        <div className="w-full max-w-sm rounded-2xl bg-black/60 backdrop-blur-2xl border border-white/[0.1] shadow-2xl text-stone-100 flex flex-col gap-6 p-7">
                            <div className="flex items-center justify-between">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-500">Edit profile</span>
                                    <span className="text-base font-semibold text-stone-100">{editingPlayer.name}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingPlayer(null)}
                                    className="text-stone-400 hover:text-stone-100 transition-colors"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="text-xs font-semibold tracking-widest uppercase text-stone-400">Professions</label>
                                <div className="flex flex-wrap gap-2">
                                    {PROFESSIONS.map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => toggleEditProfession(p)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider border transition-all ${
                                                editProfessions.includes(p)
                                                    ? "bg-white/[0.2] border-white/[0.4] text-white"
                                                    : "bg-white/[0.05] border-white/[0.1] text-stone-400 hover:border-white/[0.2] hover:text-stone-200"
                                            }`}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleEditSubmit}
                                disabled={editLoading || editProfessions.length === 0}
                                className="w-full bg-white/[0.1] hover:bg-white/[0.18] border border-white/[0.1] text-stone-100 rounded-xl h-10 text-sm font-semibold tracking-wide transition-all disabled:opacity-40"
                            >
                                {editLoading ? "Saving…" : "Save"}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── footer bar ── */}
                <div className="flex items-center justify-between px-5 py-2 border-t border-white/[0.08] shrink-0 bg-white/[0.02]">
                    <span className="text-[10px] font-mono text-stone-600 uppercase tracking-widest">
                        {lobby.players.length} player{lobby.players.length !== 1 ? "s" : ""} joined
                    </span>
                    <span className="text-[10px] font-mono text-stone-500">
                        {new Date(lobby.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </div>
        </div>
    );
}