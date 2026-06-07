import { getLobby, updateLobby } from "@/lib/store";
import type { Team } from "@/lib/types";
import { NextResponse } from "next/server";

export async function PATCH(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;

    const adminToken = request.headers.get("x-admin-token");
    const lobby = getLobby(matchId);

    if (!lobby) {
        return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    }
    if (!adminToken || adminToken !== lobby.adminToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teams }: { teams: Team[] } = await request.json();

    if (lobby.slots.length > 0) {
        for (const team of teams) {
            for (let i = 0; i < team.players.length; i++) {
                const requiredProfession = lobby.slots[i];
                const player = team.players[i];
                if (requiredProfession && player && !player.professions.includes(requiredProfession)) {
                    return NextResponse.json(
                        { error: `Slot mismatch: player "${player.name}" does not have required profession "${requiredProfession}"` },
                        { status: 400 }
                    );
                }
            }
        }
    }

    const updated = updateLobby(matchId, { teams });
    if (!updated) {
        return NextResponse.json({ error: "Failed to update" }, { status: 500 });
    }

    const { adminToken: _, ...publicLobby } = updated;
    return NextResponse.json(publicLobby);
}
