"use client";

import { dropOrSwap } from "@formkit/drag-and-drop";
import { useDragAndDrop } from "@formkit/drag-and-drop/react";
import type { Lobby, Player, Profession, Team } from "@/lib/types";
import { PROFESSIONS } from "@/lib/types";
import { Copy, Check, Shield, Pencil, X, Settings, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
            className={`group flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.16] hover:bg-white/[0.06] transition-all select-none ${isAdmin ? "cursor-grab active:cursor-grabbing" : "cursor-default"}`}
        >
            <div data-player-drag-handle={isAdmin ? "true" : undefined} className="flex flex-col gap-1.5">
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

    return (
        <div className="flex flex-col w-56 shrink-0 rounded-xl border overflow-hidden transition-colors bg-white/[0.03] border-white/[0.08]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">Player queue</span>
                <span className="text-[11px] font-mono text-stone-600 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md">{items.filter(item => getBoardItemPlayer(item)).length}</span>
            </div>
            <div ref={listRef} className="flex flex-col gap-2 p-2 overflow-y-auto flex-1 min-h-[60px]">
                {items.filter(item => getBoardItemPlayer(item)).length === 0 && (
                    <div className="flex items-center justify-center h-16 text-[11px] text-stone-700 uppercase tracking-widest pointer-events-none">
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
            ? `${s.border} ${s.bg}`
            : "border-red-500/50 bg-red-950/20"
        : "border-dashed border-white/[0.15] bg-white/[0.02]";

    return (
        <div data-dnd-item="true" className={`flex flex-col gap-2 px-3 py-2.5 rounded-lg border transition-all ${borderClass}`}>
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

    return (
        <div className="flex flex-col flex-1 min-w-[220px] rounded-xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] bg-white/[0.03]">
                <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-stone-400">{team.name}</span>
                <span className="text-[11px] font-mono text-stone-600 bg-white/[0.05] border border-white/[0.08] px-1.5 py-0.5 rounded-md">
                    {occupiedCount}{slots.length > 0 ? `/${slots.length}` : ""}
                </span>
            </div>
            <div ref={listRef} className="flex flex-col gap-2 p-2 overflow-y-auto flex-1 min-h-[84px]">
                {slots.length === 0 ? (
                    occupiedCount === 0 ? (
                        <div className="flex items-center justify-center h-16 text-[11px] text-stone-700 uppercase tracking-widest">
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
    const boardSnapshot = renderedBoardSnapshot ?? createBoardSnapshot(lobby);
    const matchSizeLabel = `${(lobby.slots?.length ?? 0) * lobby.teams.length}s`;

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
                            {matchSizeLabel}
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
                <div className="flex flex-1 overflow-hidden gap-3 p-4">
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
