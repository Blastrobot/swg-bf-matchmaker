import { NextResponse } from "next/server";
import { Player } from "@/lib/types";
import { getLobby, updateLobby } from "@/lib/store";

export const POST = async (request: Request, { params }: { params: Promise<{ matchId: string }> }) => {
    const body = await request.json();
    const { name, professions } = body;
    const { matchId } = await params;

    const lobby = getLobby(matchId);
    if (!lobby) return NextResponse.json({ error: "Lobby not found!" }, { status: 404 });

    const player: Player = {
        id: crypto.randomUUID(),
        name,
        professions,
        isAdmin: false,
    };

    updateLobby(matchId, { players: [...lobby.players, player] });

    return NextResponse.json(player, {
        status: 201
    });
};