import { useState, useRef, useEffect } from "react";
import { useGameState } from "./useGameState.ts";
import RulesModal from "./RulesModal.tsx";
import "./Lobby.css";
function Lobby() {
    const [showRules, setShowRules] = useState<boolean>(false);
    const nameInput = useRef<HTMLInputElement | null>(null); 
    const roomIDInput = useRef<HTMLInputElement | null>(null);
    const { createRoom, joinRoom, roomId, startGame, gameState: { players }, reconnectToGame, leaveRoom, showToast } = useGameState();

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
        return <div style={{"alignSelf": "start"}} key={"list"+player.id}><span id={dotId}>&#9679;</span>{player.name}</div>;
    });

    return (
        <div className="lobby">
        {showToast && (
            <div className={`copy-toast ${showToast ? 'show' : ''}`}>
            Room ID copied to clipboard! ✓
            </div>
        )}
            <div className="lobbyForm">
                <h3>Create or Join an Existing Room</h3>
                <input ref={nameInput} name="playerName" placeholder="Name"/>
                { roomId === "" && <input ref={roomIDInput} name="roomId" placeholder="Room ID"/> }
                { roomId === "" && <button className="lobbyForm-btn" type="submit" onClick={handleJoinRoom}>Join Room</button>}
                <button className="lobbyForm-btn" type="button" onClick={roomId ? leaveRoom : handleCreateRoom}>{ roomId ? "Leave Room" : "Create Room"}</button>
                { roomId !== "" && <button className="lobbyForm-btn" type="button" onClick={startGame}>Start Game</button> }
                { roomId !== "" && <strong style={{"margin": "4px 0px", "alignSelf": "start"}}>GameRoom: {roomId} </strong> }
                { playerList }
                <button className="circular-btn" onClick={()=>{setShowRules(true)}}>&#63;</button>
            </div>
            <RulesModal isOpen={showRules} onClose={()=>{setShowRules(false)}} />
        </div>
    );
}

export default Lobby;
