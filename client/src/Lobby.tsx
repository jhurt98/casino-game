import { useRef } from "react";
import { useGameState } from "./useGameState.ts";
import "./Lobby.css";
function Lobby() {
    const ws = useRef<WebSocket | null>(null);
    const nameInput = useRef<HTMLInputElement | null>(null); 
    const roomIDInput = useRef<HTMLInputElement | null>(null);

    const { createRoom, joinRoom, playerId, roomId, startGame } = useGameState();

    function handleCreateRoom() {
        if (nameInput.current === null) {
            return;
        }
        createRoom(nameInput.current.value);
    }

    function handleJoinRoom() {
        if (roomIDInput.current === null || roomIDInput.current.value === "") {
            return;
        }
        if (nameInput.current === null) {
            return;
        }
        joinRoom(roomIDInput.current.value, nameInput.current.value);
    }

    return (
        <div className="lobby">
            <h3>Create or Join an Existing Room</h3>
            <div className="lobbyForm">
                <input ref={nameInput} name="playerName" placeholder="Name"/>
                <input ref={roomIDInput} name="roomId" placeholder="Room ID"/>
                <button type="button" onClick={handleCreateRoom}>Create Room</button>
                <button type="submit" onClick={handleJoinRoom}>Join Room</button>
                <button type="button" onClick={startGame}>Start Game</button>
            </div>
            <div>
                <strong>Player ID:</strong> <span id="playerIdDisplay">{playerId === "" ? "No Player": playerId}</span><br/>
                <strong>WebSocket:</strong> <span id="wsStatus">{ws? "Disconnected" : "Connected"}</span><br/>
                <strong>GameRoom</strong> <span id="grStatus">{roomId === "" ? "No Game Room" : roomId }</span>
            </div>
        </div>
    );
}

export default Lobby;
