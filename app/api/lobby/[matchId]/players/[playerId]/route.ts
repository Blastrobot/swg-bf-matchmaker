import { getLobby, updateLobby } from "@/lib/store";
import type { Profession } from "@/lib/types";
import { NextResponse } from "next/server";

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ matchId: string; playerId: string }> }
) {
    const { matchId, playerId } = await params;

    const lobby = getLobby(matchId);
    if (!lobby) {
        return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    }

    const player = lobby.players.find(p => p.id === playerId);
    if (!player) {
        return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }

    const { professions }: { professions: Profession[] } = await request.json();
    if (!professions || professions.length === 0) {
        return NextResponse.json({ error: "At least one profession required" }, { status: 400 });
    }

    const updatedPlayers = lobby.players.map(p =>
        p.id === playerId ? { ...p, professions } : p
    );

    const updatedTeams = lobby.teams.map(team => ({
        ...team,
        players: team.players.map(p =>
            p?.id === playerId ? { ...p, professions } : p
        ),
    }));

    const updated = updateLobby(matchId, { players: updatedPlayers, teams: updatedTeams });
    if (!updated) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    return NextResponse.json(updated.players.find(p => p.id === playerId));
}
