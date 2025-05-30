import { useRef } from "react";
import { useGameState } from "./useGameState.ts";
import "./Lobby.css";
function Lobby() {
    const ws = useRef<WebSocket | null>(null);

    const { createRoom, handleJoinRoom, playerId, roomId, handleStart } = useGameState();

    return (
        <div className="lobby">
            <h3>Create or Join an Existing Room</h3>
            <form className="lobbyForm" onSubmit={handleJoinRoom}>
            <input name="playerName" placeholder="Name"/>
            <input name="roomId" placeholder="Room ID"/>
            <button type="button" onClick={createRoom}>Create Room</button>
            <button type="submit">Join Room</button>
            <button type="button" onClick={handleStart}>Start Game</button>
            </form>
            <div>
                <strong>Player ID:</strong> <span id="playerIdDisplay">{playerId === "" ? "No Player": playerId}</span><br/>
                <strong>WebSocket:</strong> <span id="wsStatus">{ws? "Disconnected" : "Connected"}</span><br/>
                <strong>GameRoom</strong> <span id="grStatus">{roomId === "" ? "No Game Room" : roomId }</span>
            </div>
        </div>
    );
}

export default Lobby;
