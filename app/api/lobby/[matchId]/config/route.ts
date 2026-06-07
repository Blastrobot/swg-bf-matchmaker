import { getLobby, updateLobby } from "@/lib/store";
import type { Player, Profession, Team } from "@/lib/types";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;

    // x-admin-token is a custom header (x- prefix = non-standard/custom).
    // We avoid "Authorization" because that header conventionally carries
    // "Bearer <jwt>" tokens used in standard auth flows (OAuth2, JWTs).
    // Using a custom header makes intent explicit and avoids confusion.
    const adminToken = request.headers.get("x-admin-token");
    if (!adminToken) return NextResponse.json({ error: "Unauthorized, missing authorization token" }, { status: 401 });

    const lobby = getLobby(matchId);
    if (!lobby) return NextResponse.json({ error: "Lobby not found" }, { status: 404 });

    if (adminToken !== lobby.adminToken) {
        return NextResponse.json({ error: "Forbidden, invalid authorization token" }, { status: 403 });
    }

    const body = await request.json();
    const { teamNames, slots } = body;

    const newSlots: Profession[] = Array.isArray(slots) ? slots : lobby.slots;

    const updatedTeams: Team[] = lobby.teams.map((team, index) => ({
        ...team,
        name: teamNames?.[index] ?? team.name,
        players: newSlots.length > 0
            ? newSlots.map((slot, slotIndex) => {
                const player = team.players[slotIndex] ?? null;
                return player?.professions.includes(slot) ? player : null;
            })
            : team.players.filter((player): player is Player => Boolean(player)),
        slots: newSlots,
    }));

    const updatedLobby = updateLobby(matchId, {
        slots: newSlots,
        teams: updatedTeams,
    });

    if (!updatedLobby) {
        return NextResponse.json({ error: "Failed to update lobby" }, { status: 500 });
    }

    const { adminToken: _, ...publicLobby } = updatedLobby;
    return NextResponse.json(publicLobby, { status: 200 });
}
