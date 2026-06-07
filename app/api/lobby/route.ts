import { createLobby } from "@/lib/store";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    const body = await request.json();
    const { teamNames, adminName, adminProfessions } = body;

    const { matchId, adminToken, adminPlayerId } = createLobby(teamNames, adminName, adminProfessions);

    return NextResponse.json({
        matchId,
        adminToken,
        adminPlayerId,
    }, {
        headers: {
            "Content-Type": "application/json"
        },
        status: 201
    });
}
