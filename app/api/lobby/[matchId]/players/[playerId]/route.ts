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

export async function DELETE(
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

    // A player may be removed by the lobby admin (kick) or by themselves (leave).
    // There is no per-player secret, so self-leave is gated on the requester
    // presenting the same player id they want to remove.
    const adminToken = request.headers.get("x-admin-token");
    const requesterId = request.headers.get("x-player-id");
    const isAdmin = Boolean(adminToken && adminToken === lobby.adminToken);
    const isSelf = Boolean(requesterId && requesterId === playerId);
    if (!isAdmin && !isSelf) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The admin owns the lobby; removing them would orphan it. They disband the
    // whole lobby instead (DELETE /api/lobby/[matchId]).
    if (player.isAdmin) {
        return NextResponse.json({ error: "The lobby admin cannot be removed" }, { status: 400 });
    }

    const updatedPlayers = lobby.players.filter(p => p.id !== playerId);

    // Slot-based teams keep positional nulls so remaining picks stay in their
    // assigned slots; free-list teams (no slots) hold a compact array.
    const updatedTeams = lobby.teams.map(team => ({
        ...team,
        players: lobby.slots.length > 0
            ? team.players.map(p => (p?.id === playerId ? null : p))
            : team.players.filter(p => p?.id !== playerId),
    }));

    const updated = updateLobby(matchId, { players: updatedPlayers, teams: updatedTeams });
    if (!updated) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    const { adminToken: _, ...publicLobby } = updated;
    return NextResponse.json(publicLobby);
}
