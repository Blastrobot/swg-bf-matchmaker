import { getLobby } from "@/lib/store";
import { NextResponse } from "next/server";

export async function GET(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;
    const lobby = getLobby(matchId);
    if (!lobby) {
        return NextResponse.json({
            error: "Lobby not found"
        }, {
            status: 404
        });
    }

    const { adminToken, ...publicLobbyData } = lobby;
    return NextResponse.json(publicLobbyData);
}