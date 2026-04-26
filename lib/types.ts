export type Profession = "medic" | "officer" | "commando" | "bh" | "smuggler" | "jedi" | "spy";
export const PROFESSIONS: Profession[] = ["medic", "officer", "commando", "bh", "smuggler", "jedi", "spy"];


export type MatchFormat = "6s" | "8s" | "10s" | "12s" | "14s" | "16s";

export interface Player {
    id: string;
    name: string;
    professions: Profession[];
    isAdmin?: boolean;
}

export interface Team {
    id: string;
    name: string;
    players: Player[];
    slots: Profession[];
}

export interface Lobby {
    id: string;
    adminToken: string;
    players: Player[];
    teams: Team[];
    slots: Profession[];
    format: MatchFormat;
    status: "waiting" | "in_progress" | "completed";
    createdAt: number;
}