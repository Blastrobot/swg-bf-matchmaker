import { deleteLobby, getLobby } from "@/lib/store";
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

export async function DELETE(request: Request, { params }: { params: Promise<{ matchId: string }> }) {
    const { matchId } = await params;

    const lobby = getLobby(matchId);
    if (!lobby) {
        return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    }

    const adminToken = request.headers.get("x-admin-token");
    if (!adminToken || adminToken !== lobby.adminToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Guards against the race where the lobby was deleted between the lookup
    // above and here — deleteLobby returns false if the key was already gone.
    const deleted = deleteLobby(matchId);
    if (!deleted) {
        return NextResponse.json({ error: "Lobby not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
}