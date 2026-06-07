export type Profession = "medic" | "officer" | "commando" | "bh" | "smuggler" | "jedi" | "spy";
export const PROFESSIONS: Profession[] = ["medic", "officer", "commando", "bh", "smuggler", "jedi", "spy"];

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
    status: "waiting" | "in_progress" | "completed";
    createdAt: number;
}
