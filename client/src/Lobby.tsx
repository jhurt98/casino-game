import { useRef, useEffect } from "react";
import { useGameState } from "./useGameState.ts";
import "./Lobby.css";
function Lobby() {
    const nameInput = useRef<HTMLInputElement | null>(null); 
    const roomIDInput = useRef<HTMLInputElement | null>(null);

    const { createRoom, joinRoom, roomId, startGame, gameState: { players }, reconnectToGame } = useGameState();

    useEffect(()=>{
        const sessionPlayerId = sessionStorage.getItem("playerID");
        const sessionRoomId = sessionStorage.getItem("roomID");
        if (sessionRoomId && sessionPlayerId) {
            reconnectToGame(sessionRoomId,sessionPlayerId);
        }
    },[reconnectToGame]);

    function handleCreateRoom() {
        if (nameInput.current === null) {
            return;
        }
        createRoom(nameInput.current.value);
    }

    function leaveRoom() {
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


    const playerList = players.map(player => {
        const dotId = player.connected ? "greenDot" : "redDot";
        return <div key={"list"+player.id}><span id={dotId}>&#9679;</span>{player.name}</div>;
    });

    console.log(players);

    return (
        <div className="lobby">
            <div className="lobbyForm">
                <input ref={nameInput} name="playerName" placeholder="Name"/>
                { roomId === "" && <input ref={roomIDInput} name="roomId" placeholder="Room ID"/> }
                { roomId === "" && <button type="submit" onClick={handleJoinRoom}>Join Room</button>}
                <button type="button" onClick={roomId ? leaveRoom : handleCreateRoom}>{ roomId ? "Leave Room" : "Create Room"}</button>
                <button type="button" onClick={startGame}>Start Game</button>
            </div>
            <div>
            <h3>Create or Join an Existing Room</h3>
                <strong>GameRoom</strong> <span id="grStatus">{roomId === "" ? "No Game Room" : roomId }</span>
                { playerList }
            </div>
        </div>
    );
}

export default Lobby;
