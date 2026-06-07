"use client";

import { dropOrSwap } from "@formkit/drag-and-drop";
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import type { Lobby, Player, Profession, Team } from "@/lib/types";
import { PROFESSIONS } from "@/lib/types";
import { PROFESSION_STYLES, PROFESSION_LABEL } from "@/lib/professions";
import { ProfessionBadge } from "./ProfessionBadge";
import { TeamExportSheet, copyTeamsImage } from "./TeamExportSheet";
import { Copy, Check, Shield, Pencil, X, Settings, Plus, GripVertical, Radio, Camera } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STATUS_STYLES: Record<string, { label: string; color: string; dot: string }> = {
    waiting:     { label: "STANDBY",     color: "text-holo-300 border-holo-400/40 bg-holo-400/[0.08]",       dot: "bg-holo-400" },
    in_progress: { label: "ENGAGED",     color: "text-emerald-300 border-emerald-700/50 bg-emerald-950/40", dot: "bg-emerald-400" },
    completed:   { label: "STAND DOWN",  color: "text-zinc-400 border-zinc-700/50 bg-zinc-900/40",          dot: "bg-zinc-500" },
};

// ── Drag context ────────────────────────────────────────────────────────────
type PlayerDragItem = {
    kind: "player";
    __key: string;
    player: Player;
};

type SlotDragItem = {
    kind: "slot";
    __key: string;
    teamId: string;
    slotIndex: number;
    profession: Profession;
    player: Player | null;
};

type BoardItem = PlayerDragItem | SlotDragItem;
type BoardSnapshot = Record<string, BoardItem[]>;

const QUEUE_COLUMN_ID = "queue";
const DND_GROUP = "match-players";

const teamColumnId = (teamId: string) => `team:${teamId}`;

const isPlayer = (player: Player | null | undefined): player is Player => Boolean(player);

const getBoardItemPlayer = (item: BoardItem): Player | null =>
    item.kind === "player" ? item.player : item.player;

const createPlayerItem = (player: Player): PlayerDragItem => ({
    kind: "player",
    __key: `player:${player.id}`,
    player,
});

const createSlotItem = (teamId: string, slotIndex: number, profession: Profession, player: Player | null): SlotDragItem => ({
    kind: "slot",
    __key: `slot:${teamId}:${slotIndex}`,
    teamId,
    slotIndex,
    profession,
    player,
});

const getTeamPlayers = (team: Team): Player[] => team.players.filter(isPlayer);

const boardItemSignature = (items: BoardItem[]) =>
    items.map(item => {
        const player = getBoardItemPlayer(item);
        const playerKey = player ? `${player.id}:${player.name}:${player.professions.join(",")}` : "empty";
        return item.kind === "slot"
            ? `${item.__key}:${item.profession}:${playerKey}`
            : `${item.__key}:${playerKey}`;
    }).join("|");

const createTeamBoardItems = (team: Team, slots: Profession[]): BoardItem[] => {
    if (slots.length === 0) {
        return getTeamPlayers(team).map(createPlayerItem);
    }

    return slots.map((profession, index) =>
        createSlotItem(team.id, index, profession, team.players[index] ?? null)
    );
};

const createBoardSnapshot = (lobby: Omit<Lobby, "adminToken">): BoardSnapshot => {
    const assignedPlayerIds = new Set(lobby.teams.flatMap(team => getTeamPlayers(team).map(player => player.id)));
    const snapshot: BoardSnapshot = {
        [QUEUE_COLUMN_ID]: lobby.players
            .filter(player => !assignedPlayerIds.has(player.id))
            .map(createPlayerItem),
    };

    for (const team of lobby.teams) {
        snapshot[teamColumnId(team.id)] = createTeamBoardItems(team, lobby.slots ?? []);
    }

    return snapshot;
};

const getDndOptions = (isAdmin: boolean) => ({
    group: DND_GROUP,
    disabled: !isAdmin,
    draggable: (child: HTMLElement) => child.hasAttribute("data-dnd-item"),
    dragHandle: "[data-player-drag-handle]",
    plugins: [dropOrSwap<BoardItem>({ shouldSwap: () => true })],
});

const addUniquePlayer = (players: Player[], player: Player, seen: Set<string>) => {
    if (seen.has(player.id)) return;
    seen.add(player.id);
    players.push(player);
};

const assignPlayerToSlot = (
    assignments: Array<Player | null>,
    slots: Profession[],
    player: Player,
    preferredIndex: number,
    seenAssigned: Set<string>,
    rejectedPlayers: Player[],
) => {
    if (seenAssigned.has(player.id)) return;

    const targetIndexes = [
        preferredIndex,
        ...slots.map((_, index) => index),
    ].filter((index, position, indexes) =>
        index >= 0 && index < slots.length && indexes.indexOf(index) === position
    );

    for (const index of targetIndexes) {
        if (!assignments[index] && player.professions.includes(slots[index])) {
            assignments[index] = player;
            seenAssigned.add(player.id);
            return;
        }
    }

    rejectedPlayers.push(player);
};

const normalizeBoardSnapshot = (
    lobby: Omit<Lobby, "adminToken">,
    snapshot: BoardSnapshot,
): { teams: Team[]; players: Player[] } => {
    const slots = lobby.slots ?? [];
    const assignedIds = new Set<string>();
    const rejectedPlayers: Player[] = [];

    const teams = lobby.teams.map(team => {
        const columnItems = snapshot[teamColumnId(team.id)] ?? createTeamBoardItems(team, slots);

        if (slots.length === 0) {
            const players: Player[] = [];
            for (const item of columnItems) {
                const player = getBoardItemPlayer(item);
                if (player && !assignedIds.has(player.id)) {
                    assignedIds.add(player.id);
                    players.push(player);
                }
            }
            return { ...team, players };
        }

        const assignments: Array<Player | null> = Array(slots.length).fill(null);
        const preservesSlotIndexes = columnItems.length !== slots.length;

        columnItems.forEach((item, index) => {
            const player = getBoardItemPlayer(item);
            if (!player) return;
            const preferredIndex = preservesSlotIndexes && item.kind === "slot" && item.teamId === team.id
                ? item.slotIndex
                : index;
            assignPlayerToSlot(assignments, slots, player, preferredIndex, assignedIds, rejectedPlayers);
        });

        return { ...team, players: assignments, slots };
    });

    const queuePlayers: Player[] = [];
    const queuedIds = new Set<string>();

    for (const player of rejectedPlayers) {
        if (!assignedIds.has(player.id)) {
            addUniquePlayer(queuePlayers, player, queuedIds);
        }
    }

    for (const item of snapshot[QUEUE_COLUMN_ID] ?? []) {
        const player = getBoardItemPlayer(item);
        if (player && !assignedIds.has(player.id)) {
            addUniquePlayer(queuePlayers, player, queuedIds);
        }
    }

    for (const player of lobby.players) {
        if (!assignedIds.has(player.id)) {
            addUniquePlayer(queuePlayers, player, queuedIds);
        }
    }

    return {
        teams,
        players: [
            ...queuePlayers,
            ...teams.flatMap(team => getTeamPlayers(team)),
        ],
    };
};

// ── Shared components ────────────────────────────────────────────────────────
function PlayerCard({
    player,
    isOwn,
    isAdmin,
    onEdit,
}: {
    player: Player;
    isOwn: boolean;
    isAdmin: boolean;
    onEdit: () => void;
}) {
    return (
        <div
            data-dnd-item="true"
            className={`group relative flex flex-col gap-2 rounded-xl border bg-white/[0.02] px-3 py-2.5 transition-all duration-200 select-none hover:-translate-y-px hover:bg-white/[0.055] hover:shadow-lg hover:shadow-black/30 ${isOwn ? "border-holo-400/30 ring-1 ring-holo-400/15" : "border-white/[0.07] hover:border-white/[0.13]"} ${isAdmin ? "cursor-grab active:cursor-grabbing active:scale-[0.99]" : "cursor-default"}`}
        >
            <div data-player-drag-handle={isAdmin ? "true" : undefined} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                    {isAdmin && (
                        <GripVertical className="-ml-1 size-3.5 shrink-0 text-stone-700 transition-colors group-hover:text-stone-500" />
                    )}
                    {player.isAdmin && <Shield className="size-3 shrink-0 text-holo-400" />}
                    <span className="flex-1 truncate text-sm font-medium text-stone-100">{player.name}</span>
                    {isOwn && (
                        <button
                            type="button"
                            onMouseDown={e => e.stopPropagation()}
                            onClick={e => { e.stopPropagation(); onEdit(); }}
                            className="shrink-0 cursor-pointer rounded-md p-1 text-stone-500 transition-all hover:bg-white/10 hover:text-holo-200 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                            <Pencil className="size-3" />
                        </button>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {player.professions.map(p => <ProfessionBadge key={p} profession={p} />)}
                </div>
            </div>
        </div>
    );
}

// ── Synced drag list ──────────────────────────────────────────────────────────
// Keeps formkit's internal list in sync with the externally-controlled snapshot
// without feeding stale items back up. The crux: emit to the parent ONLY when the
// internal list diverges from the snapshot we last adopted from props. If `items`
// still matches that snapshot, a difference from the *current* props means a fresh
// inbound snapshot (e.g. a profession edit) — not a local drag — so we must stay
// quiet, otherwise we echo stale items back and trigger an infinite commit loop.
// The emit effect is declared before the adopt effect on purpose: it must read the
// ref before the adopt effect advances it in the same commit.
function useSyncedDragList(
    initialItems: BoardItem[],
    isAdmin: boolean,
    onItemsChange: (items: BoardItem[]) => void,
) {
    const initialSignature = useMemo(() => boardItemSignature(initialItems), [initialItems]);
    const dndOptions = useMemo(() => getDndOptions(isAdmin), [isAdmin]);
    const [listRef, items, setItems] = useDragAndDrop<HTMLDivElement, BoardItem>(initialItems, dndOptions);
    const itemSignature = useMemo(() => boardItemSignature(items), [items]);
    const adoptedSignatureRef = useRef(initialSignature);

    // state -> parent: only genuine local mutations
    useEffect(() => {
        if (itemSignature === initialSignature) return;
        if (itemSignature === adoptedSignatureRef.current) return;
        onItemsChange(items);
    }, [itemSignature, initialSignature, items, onItemsChange]);

    // parent -> state: adopt the incoming snapshot
    useEffect(() => {
        setItems(initialItems);
        adoptedSignatureRef.current = initialSignature;
    }, [initialItems, initialSignature, setItems]);

    return { listRef, items };
}

// ── Queue column (formkit free-list) ─────────────────────────────────────────
function QueueColumn({
    items: initialItems,
    isAdmin,
    myPlayerId,
    onItemsChange,
    onEditPlayer,
}: {
    items: BoardItem[];
    isAdmin: boolean;
    myPlayerId: string;
    onItemsChange: (items: BoardItem[]) => void;
    onEditPlayer: (player: Player) => void;
}) {
    const { listRef, items } = useSyncedDragList(initialItems, isAdmin, onItemsChange);

    const queueCount = items.filter(item => getBoardItemPlayer(item)).length;

    return (
        <div className="flex w-56 shrink-0 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--void-1)]/40">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <span className="label flex items-center gap-1.5 text-[10px] text-stone-400">
                    <Radio className="size-3 text-holo-300/70" /> Queue
                </span>
                <span className="data rounded border border-white/[0.08] bg-black/40 px-1.5 py-0.5 text-[11px] text-stone-400">{String(queueCount).padStart(2, "0")}</span>
            </div>
            <div ref={listRef} className="flex min-h-[60px] flex-1 flex-col gap-2 overflow-y-auto p-2">
                {queueCount === 0 && (
                    <div className="label pointer-events-none flex h-16 items-center justify-center text-[10px] text-stone-700">
                        {isAdmin ? "Drop here" : "Empty"}
                    </div>
                )}
                {items.map(item => {
                    const player = getBoardItemPlayer(item);
                    if (!player) return <div key={item.__key} data-dnd-item="true" className="hidden" />;
                    return (
                        <PlayerCard
                            key={item.__key}
                            player={player}
                            isOwn={player.id === myPlayerId}
                            isAdmin={isAdmin}
                            onEdit={() => onEditPlayer(player)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

// ── Team slot column ──────────────────────────────────────────────────────────
function SlotDropZone({
    requiredProfession,
    occupant,
    isAdmin,
    myPlayerId,
    onEditPlayer,
}: {
    requiredProfession: Profession;
    occupant: Player | null;
    isAdmin: boolean;
    myPlayerId: string;
    onEditPlayer: (player: Player) => void;
}) {
    const s = PROFESSION_STYLES[requiredProfession];
    const isCompatible = occupant ? occupant.professions.includes(requiredProfession) : true;
    const borderClass = occupant
        ? isCompatible
            ? "border-white/[0.07] bg-white/[0.02]"
            : "border-red-500/40 bg-red-500/[0.05]"
        : "border-dashed border-white/[0.1] bg-white/[0.015]";

    return (
        <div data-dnd-item="true" className={`flex flex-col gap-2 rounded-xl border p-2 transition-all ${borderClass}`}>
            <div className="flex items-center gap-2 px-0.5">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[11px] font-medium capitalize tracking-tight ${s.chip} ${s.text} ${occupant ? "" : "opacity-70"}`}>
                    <span className={`size-1.5 rounded-full ${s.dot}`} />
                    {PROFESSION_LABEL[requiredProfession]}
                </span>
                {occupant && !isCompatible && (
                    <span className="ml-auto inline-flex items-center rounded-full bg-red-400/10 px-2 py-[2px] text-[10px] font-medium text-red-300">mismatch</span>
                )}
            </div>
            {occupant ? (
                <PlayerCard
                    player={occupant}
                    isOwn={occupant.id === myPlayerId}
                    isAdmin={isAdmin}
                    onEdit={() => onEditPlayer(occupant)}
                />
            ) : (
                <div className="label flex h-9 items-center justify-center text-[9px] text-stone-700">
                    {isAdmin ? "drop operative" : "open slot"}
                </div>
            )}
        </div>
    );
}

function TeamColumn({
    team,
    slots,
    items: initialItems,
    isAdmin,
    myPlayerId,
    onItemsChange,
    onEditPlayer,
}: {
    team: Team;
    slots: Profession[];
    items: BoardItem[];
    isAdmin: boolean;
    myPlayerId: string;
    onItemsChange: (items: BoardItem[]) => void;
    onEditPlayer: (player: Player) => void;
}) {
    const { listRef, items } = useSyncedDragList(initialItems, isAdmin, onItemsChange);
    const occupiedCount = items.filter(item => getBoardItemPlayer(item)).length;

    const full = slots.length > 0 && occupiedCount >= slots.length;

    return (
        <div className="flex min-w-[220px] flex-1 flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[var(--void-1)]/40">
            <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <span className="font-display flex items-center gap-2 text-lg uppercase tracking-wide text-stone-200">
                    <span className="h-3.5 w-0.5 bg-holo-400/60" />
                    {team.name}
                </span>
                <span className={`data rounded border px-1.5 py-0.5 text-[11px] ${full ? "border-holo-400/40 bg-holo-400/10 text-holo-300" : "border-white/[0.08] bg-black/40 text-stone-400"}`}>
                    {occupiedCount}{slots.length > 0 ? `/${slots.length}` : ""}
                </span>
            </div>
            <div ref={listRef} className="flex min-h-[84px] flex-1 flex-col gap-2 overflow-y-auto p-2">
                {slots.length === 0 ? (
                    occupiedCount === 0 ? (
                        <div className="label flex h-16 items-center justify-center text-[10px] text-stone-700">
                            {isAdmin ? "Drop here" : "No players assigned"}
                        </div>
                    ) : (
                        items.map(item => {
                            const player = getBoardItemPlayer(item);
                            if (!player) return <div key={item.__key} data-dnd-item="true" className="hidden" />;
                            return (
                                <PlayerCard
                                    key={item.__key}
                                    player={player}
                                    isOwn={player.id === myPlayerId}
                                    isAdmin={isAdmin}
                                    onEdit={() => onEditPlayer(player)}
                                />
                            );
                        })
                    )
                ) : (
                    items.map((item, index) => {
                        const profession = slots[index] ?? (item.kind === "slot" ? item.profession : slots[slots.length - 1]);
                        return (
                            <SlotDropZone
                                key={item.__key}
                                requiredProfession={profession}
                                occupant={getBoardItemPlayer(item)}
                                isAdmin={isAdmin}
                                myPlayerId={myPlayerId}
                                onEditPlayer={onEditPlayer}
                            />
                        );
                    })
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
    // teams-image export
    const exportRef = useRef<HTMLDivElement>(null);
    const [exportState, setExportState] = useState<"idle" | "copied" | "downloaded" | "failed">("idle");
    // edit modal state
    const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
    const [editProfessions, setEditProfessions] = useState<Profession[]>([]);
    const [editLoading, setEditLoading] = useState(false);

    // config modal state
    const [configOpen, setConfigOpen] = useState(false);
    const [configSlots, setConfigSlots] = useState<Profession[]>([]);
    const [configLoading, setConfigLoading] = useState(false);

    const isPersistingRef = useRef(false);
    const lobbyRef = useRef<Omit<Lobby, "adminToken"> | null>(null);
    const boardSnapshotRef = useRef<BoardSnapshot>({});
    const boardCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const renderedBoardSnapshot = useMemo(() => lobby ? createBoardSnapshot(lobby) : null, [lobby]);

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
        isPersistingRef.current = true;
        fetch(`/api/lobby/${matchId}/teams`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-admin-token": token },
            body: JSON.stringify({ teams: newTeams }),
        }).finally(() => { isPersistingRef.current = false; });
    }, [matchId]);

    const commitBoardSnapshot = useCallback(() => {
        const prev = lobbyRef.current;
        if (!prev) return;
        const normalized = normalizeBoardSnapshot(prev, boardSnapshotRef.current);
        // Persist OUTSIDE the state updater. A fetch inside setLobby's updater is an
        // impure side effect that React's StrictMode double-invokes in dev, firing the
        // PATCH twice per commit (the source of the duplicate /teams requests).
        setLobby({ ...prev, players: normalized.players, teams: normalized.teams });
        persistLobbyState(normalized.teams, normalized.players);
    }, [persistLobbyState]);

    const scheduleBoardCommit = useCallback((columnId: string, items: BoardItem[]) => {
        boardSnapshotRef.current = {
            ...boardSnapshotRef.current,
            [columnId]: items,
        };

        if (boardCommitTimerRef.current) {
            clearTimeout(boardCommitTimerRef.current);
        }

        boardCommitTimerRef.current = setTimeout(() => {
            boardCommitTimerRef.current = null;
            commitBoardSnapshot();
        }, 0);
    }, [commitBoardSnapshot]);

    const openConfigModal = useCallback(() => {
        if (!lobby) return;
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
            body: JSON.stringify({ slots: configSlots }),
        });
        setConfigLoading(false);
        if (res.ok) {
            const updated = await res.json();
            setLobby(updated);
            setConfigOpen(false);
        }
    }, [matchId, lobby, configSlots]);

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
                        players: t.players.map(p => p?.id === editingPlayer.id ? { ...p, professions: editProfessions } : p),
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
        return () => {
            clearInterval(intervalId);
            if (boardCommitTimerRef.current) {
                clearTimeout(boardCommitTimerRef.current);
            }
        };
    }, [matchId, fetchLobby]);

    useEffect(() => {
        lobbyRef.current = lobby;
    }, [lobby]);

    useEffect(() => {
        if (!renderedBoardSnapshot || boardCommitTimerRef.current) return;
        boardSnapshotRef.current = renderedBoardSnapshot;
    }, [renderedBoardSnapshot]);

    const handleCopyCode = () => {
        navigator.clipboard.writeText(matchId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleExportTeams = async () => {
        if (!exportRef.current) return;
        const result = await copyTeamsImage(exportRef.current, `teams-${matchId}.png`);
        setExportState(result);
        setTimeout(() => setExportState("idle"), 2200);
    };

    if (error) {
        return (
            <div className="brackets flex flex-col items-center justify-center gap-3 rounded-2xl border border-red-800/40 bg-black/50 px-10 py-8 backdrop-blur-xl">
                <span className="label text-[10px] text-red-400/70">Signal lost</span>
                <span className="data text-xs uppercase tracking-widest text-stone-400">{error}</span>
            </div>
        );
    }

    if (!lobby) {
        return (
            <div className="flex h-full items-center justify-center">
                <span className="label animate-pulse text-[11px] tracking-[0.3em] text-holo-300/60">Establishing uplink…</span>
            </div>
        );
    }

    const status = STATUS_STYLES[lobby.status] ?? STATUS_STYLES.waiting;
    const boardSnapshot = renderedBoardSnapshot ?? createBoardSnapshot(lobby);
    const matchSizeLabel = `${(lobby.slots?.length ?? 0)}s`;
    const slots = lobby.slots ?? [];
    const allTeamsReady = slots.length > 0 && lobby.teams.every(t => t.players.filter(Boolean).length >= slots.length);

    return (
        <div className="fixed inset-0 z-10 flex items-center justify-center p-4 sm:p-6 pb-20">
            <div className="brackets flex h-full max-h-full w-full flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-black/55 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur-2xl">
                {/* ── header ── */}
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.08] bg-white/[0.02] px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-3">
                        <span className="font-display hidden text-base uppercase tracking-wide text-holo-300 sm:inline">SWG·BF</span>
                        <span className="hidden h-4 w-px bg-white/15 sm:inline" />
                        <span className="data rounded border border-holo-400/30 bg-holo-400/[0.08] px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-holo-200">
                            {matchSizeLabel}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={handleCopyCode}
                        className="group flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 transition-all hover:border-holo-400/40 hover:bg-white/[0.06]"
                    >
                        <span className="label text-[8px] text-stone-600 group-hover:text-holo-300/70">Id</span>
                        <span className="data max-w-[160px] truncate text-[11px] text-stone-300 transition-colors group-hover:text-stone-100">
                            {matchId}
                        </span>
                        {copied
                            ? <Check className="size-3 shrink-0 text-emerald-400" />
                            : <Copy className="size-3 shrink-0 text-stone-600 transition-colors group-hover:text-holo-300" />
                        }
                    </button>

                    <div className="flex items-center gap-2">
                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    onClick={openConfigModal}
                                    className="label flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] text-stone-400 transition-all hover:border-holo-400/40 hover:text-holo-200"
                                >
                                    <Settings className="size-3" /> <span className="hidden sm:inline">Configure</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportTeams}
                                    disabled={!allTeamsReady}
                                    title={allTeamsReady ? "Copy both teams as an image" : "Fill every slot on both teams to copy"}
                                    className={`label flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                                        exportState === "failed"
                                            ? "border-red-500/50 bg-red-500/10 text-red-300"
                                            : exportState !== "idle"
                                                ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                                                : "border-white/[0.08] bg-white/[0.03] text-stone-400 hover:border-holo-400/40 hover:text-holo-200"
                                    }`}
                                >
                                    {exportState === "idle" && <><Camera className="size-3" /> <span className="hidden sm:inline">Copy teams</span></>}
                                    {exportState === "copied" && <><Check className="size-3" /> Copied!</>}
                                    {exportState === "downloaded" && <><Check className="size-3" /> Saved PNG</>}
                                    {exportState === "failed" && <><X className="size-3" /> Failed</>}
                                </button>
                                <span className="label flex items-center gap-1.5 rounded-md border border-holo-400/40 bg-holo-400/[0.08] px-2 py-1 text-[10px] text-holo-300">
                                    <Shield className="size-3" /> Admin
                                </span>
                            </>
                        )}
                        <span className={`label flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] ${status.color}`}>
                            <span className={`size-1.5 rounded-full ${status.dot} animate-holo-pulse`} />
                            {status.label}
                        </span>
                    </div>
                </header>

                {/* ── columns ── */}
                <div className="tactical-grid flex flex-1 gap-3 overflow-x-auto overflow-y-hidden p-4">
                    <QueueColumn
                        items={boardSnapshot[QUEUE_COLUMN_ID] ?? []}
                        isAdmin={isAdmin}
                        myPlayerId={myPlayerId}
                        onItemsChange={items => scheduleBoardCommit(QUEUE_COLUMN_ID, items)}
                        onEditPlayer={openEditModal}
                    />
                    {lobby.teams.map((team) => (
                        <TeamColumn
                            key={team.id}
                            team={team}
                            slots={lobby.slots ?? []}
                            items={boardSnapshot[teamColumnId(team.id)] ?? []}
                            isAdmin={isAdmin}
                            myPlayerId={myPlayerId}
                            onItemsChange={items => scheduleBoardCommit(teamColumnId(team.id), items)}
                            onEditPlayer={openEditModal}
                        />
                    ))}
                </div>

                {/* ── config modal ── */}
                {configOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
                        <div className="brackets flex max-h-[90vh] w-full max-w-md flex-col gap-6 overflow-y-auto rounded-2xl border border-white/[0.1] bg-[var(--void-1)]/90 p-7 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-rise">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-1">
                                    <span className="label text-[10px] text-holo-300/80">Match settings</span>
                                    <span className="font-display text-2xl uppercase tracking-wide">Loadout</span>
                                </div>
                                <button type="button" onClick={() => setConfigOpen(false)} className="text-stone-500 transition-colors hover:text-holo-300">
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-3">
                                <label className="label text-[10px] text-stone-400">Team slots</label>
                                <p className="text-[11px] leading-relaxed text-stone-500">Define the required profession for each slot. Applies symmetrically to all factions.</p>

                                {configSlots.length > 0 && (
                                    <div className="flex flex-col gap-1.5">
                                        {configSlots.map((s, i) => {
                                            const st = PROFESSION_STYLES[s];
                                            return (
                                                <div key={i} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${st.bg} ${st.border}`}>
                                                    <span className="data text-[10px] text-stone-500">{String(i + 1).padStart(2, "0")}</span>
                                                    <span className={`size-1.5 rounded-full ${st.dot}`} />
                                                    <span className={`label flex-1 text-[10px] ${st.text}`}>
                                                        {PROFESSION_LABEL[s]}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeConfigSlot(i)}
                                                        className="text-stone-500 transition-colors hover:text-red-400"
                                                    >
                                                        <X className="size-3.5" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <div className="flex flex-col gap-1.5">
                                    <span className="label text-[9px] text-stone-600">Add slot</span>
                                    <div className="flex flex-wrap gap-1.5">
                                        {PROFESSIONS.map(p => {
                                            const st = PROFESSION_STYLES[p];
                                            return (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => addConfigSlot(p)}
                                                    className="label group flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5 text-[10px] text-stone-400 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-stone-200"
                                                >
                                                    <span className={`size-1.5 rounded-full ${st.dot} opacity-60 transition-opacity group-hover:opacity-100`} />
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleConfigSubmit}
                                disabled={configLoading}
                                className="label flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-holo-400/40 bg-holo-400/[0.1] text-sm text-holo-100 transition-all hover:bg-holo-400/[0.18] disabled:opacity-40"
                            >
                                {configLoading ? "Saving…" : <>Apply loadout <Check className="size-4" /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── edit profile modal ── */}
                {editingPlayer && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
                        <div className="brackets flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-white/[0.1] bg-[var(--void-1)]/90 p-7 text-stone-100 shadow-2xl shadow-black/60 backdrop-blur-2xl animate-rise">
                            <div className="flex items-start justify-between">
                                <div className="flex flex-col gap-1">
                                    <span className="label text-[10px] text-holo-300/80">Operative dossier</span>
                                    <span className="font-display text-2xl uppercase tracking-wide">{editingPlayer.name}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setEditingPlayer(null)}
                                    className="text-stone-500 transition-colors hover:text-holo-300"
                                >
                                    <X className="size-5" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label text-[10px] text-stone-400">Professions</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {PROFESSIONS.map(p => {
                                        const st = PROFESSION_STYLES[p];
                                        const active = editProfessions.includes(p);
                                        return (
                                            <button
                                                key={p}
                                                type="button"
                                                onClick={() => toggleEditProfession(p)}
                                                className={`label flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[10px] transition-all ${
                                                    active
                                                        ? `${st.bg} ${st.border} ${st.text} ring-1 ${st.ring}`
                                                        : "border-white/[0.08] bg-white/[0.02] text-stone-500 hover:border-white/20 hover:text-stone-300"
                                                }`}
                                            >
                                                <span className={`size-1.5 rounded-full transition-colors ${active ? st.dot : "bg-stone-700"}`} />
                                                {p}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={handleEditSubmit}
                                disabled={editLoading || editProfessions.length === 0}
                                className="label flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-holo-400/40 bg-holo-400/[0.1] text-sm text-holo-100 transition-all hover:bg-holo-400/[0.18] disabled:opacity-40"
                            >
                                {editLoading ? "Saving…" : <>Save dossier <Check className="size-4" /></>}
                            </button>
                        </div>
                    </div>
                )}

                {/* ── footer bar ── */}
                <div className="flex shrink-0 items-center justify-between border-t border-white/[0.08] bg-white/[0.02] px-5 py-2">
                    <span className="data flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-stone-500">
                        <span className="size-1 rounded-full bg-holo-400/70" />
                        {lobby.players.length} player{lobby.players.length !== 1 ? "s" : ""} joined
                    </span>
                    <span className="data text-[10px] text-stone-600">
                        {new Date(lobby.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                </div>
            </div>

            {/* off-screen snapshot source for the Copy-teams button */}
            {isAdmin && allTeamsReady && (
                <TeamExportSheet ref={exportRef} teams={lobby.teams} slots={slots} />
            )}
        </div>
    );
}
