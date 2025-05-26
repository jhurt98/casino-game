import { useRef, useEffect, useState } from "react";
import "./Lobby.css";

interface Message {
    type: string;
    data: string;
}

function Lobby() {
    const [players, setPlayers] = useState<Array<string>>([]);
    const socketRef = useRef<WebSocket | null>(null);

    function testWS() {
        const socket = new WebSocket("ws://localhost:8080/game");

        socket.onmessage = (event) => {
            console.log("event data", event.data);
            const message = JSON.parse(event.data);
            if (message.type === "join") {
                const newPlayer = message.data[message.data.length - 1];
                const playerName = "Player " + newPlayer.Id;
                setPlayers((players) => [...players, playerName]);
            }
        };

        socket.addEventListener("error", (event) => {
            console.log(event);
        });

        socketRef.current = socket;
    }

    useEffect(() => {
        if (socketRef.current === null) {
            return;
        }

        return () => {
            if (socketRef.current !== null) {
                socketRef.current.close(1000);
            }
        };
    }, []);

    function handleStart() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "start",
            data: "",
        };
        socketRef.current.send(JSON.stringify(message));
    }

    function handleJoinGame() {
        if (socketRef.current === null) {
            return;
        }
        const data = { type: "join", data: {} };
        socketRef.current.send(JSON.stringify(data));
    }

    return (
        <>
            <button onClick={testWS}>open ws</button>
            <button onClick={handleStart}>testStart</button>
            <button onClick={handleJoinGame}>join game</button>
            <div>
                Players
                {players.map((player, i) => (
                    <li key={i}>{player}</li>
                ))}
            </div>
        </>
    );
}

export default Lobby;
