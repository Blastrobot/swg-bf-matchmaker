import { getLobby, updateLobby } from "@/lib/store";
import { Profession, Team } from "@/lib/types";
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
    const { format, teamNames, slots } = body;

    const newSlots: Profession[] = Array.isArray(slots) ? slots : lobby.slots;

    const updatedTeams: Team[] = lobby.teams.map((team, index) => ({
        ...team,
        name: teamNames?.[index] ?? team.name,
        slots: newSlots,
    }));

    const updatedLobby = updateLobby(matchId, {
        format: format ?? lobby.format,
        slots: newSlots,
        teams: updatedTeams,
    });

    const { adminToken: _, ...publicLobby } = updatedLobby!;
    return NextResponse.json(publicLobby, { status: 200 });
}