import type { Lobby, Player, Profession, Team } from "./types";

/*
 * In Next.js dev mode, hot-reloading re-evaluates server modules on every file
 * save, which would reset a plain `new Map()` and wipe all lobbies. Persisting
 * on `globalThis` survives module re-evaluation for the lifetime of the process.
 * In production modules are only evaluated once, so this is a no-op there.
 */
declare global { var __lobbies: Map<string, Lobby> | undefined }
const lobbies = (globalThis.__lobbies ??= new Map<string, Lobby>());

export const createLobby = (teamNames: string[], adminName: string, adminProfessions: Profession[]): { matchId: string, adminToken: string, adminPlayerId: string } => {
    const matchId = crypto.randomUUID();
    const adminToken = crypto.randomUUID();

    const lobbyTeams: Team[] = teamNames.map((teamName, index) => ({
        id: index.toString(),
        name: teamName,
        players: [],
        slots: [],
    }));

    /* 
     * admin player object that will be used to manage the lobby
     */
    const adminPlayer: Player = {
        id: crypto.randomUUID(),
        name: adminName,
        professions: adminProfessions,
        isAdmin: true
    };

    /* 
     * lobby object that is gonna be stored in the map
     */
    const storedLobby: Lobby = {
        id: matchId,
        adminToken,
        players: [adminPlayer],
        teams: lobbyTeams,
        slots: [],
        status: "waiting",
        createdAt: Date.now()
    };

    /* 
     * store the lobby in the map
     */
    lobbies.set(matchId, storedLobby);
    return { matchId, adminToken, adminPlayerId: adminPlayer.id };
}

export const getLobby = (id: string): Lobby | undefined => {
    return lobbies.get(id);
}

export const updateLobby = (id: string, data: Partial<Lobby>): Lobby | undefined => {
    const lobby = lobbies.get(id);
    if (!lobby) return undefined;
    const updated = { ...lobby, ...data };
    lobbies.set(id, updated);
    return updated;
}
