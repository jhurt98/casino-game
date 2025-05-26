import "./Game.css";
import { useState, useRef } from "react";
import { useGameState } from "./useGameState.ts";
import { GameStateContextProvider } from "./GameStateContext.tsx";
import PlayingField from "./PlayingField.tsx";

function Game() {
    return (
        <GameStateContextProvider>
        <div className="game">
            <h1>&#127183;</h1>
            <LeftColumn/>
            <div className="board">
                <NextRoundModal/>
                <PlayingField />
            </div>
            <Buttons/>
        </div>
        </GameStateContextProvider>
    );
}

function PointsTable() {
    const { gameState: {players} } = useGameState();
    return (
        <table>
            <thead>
                <tr>
                    <th scope="col">Player</th>
                    <th scope="col">Points</th>
                </tr>
            </thead>
            <tbody>
                {players.map((player, i) => (
                    <tr key={player.id}>
                        <th scope="row">{`Player ${i + 1}`}</th>
                        <td>{player.points}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function LeftColumn() {
    const { gameState: { deckLen, phase, turn } } = useGameState();
    const infoString =(()=>{
        if (phase === 2) {
            return `ROUND OVER.`;
        }
        return `TURN: ${turn.turnCount}`;
    })();

    return (
            <div className="column">
                    <h3 style={{ alignSelf: "center" }}>
                        {infoString}
                    </h3>
                    <h3 style={{ alignSelf: "center" }}>
                        {`DECK: ${deckLen} CARDS`}
                    </h3>
                <PointsTable />
            </div>
    );
}

function Buttons() {
    const { connectToLobby, handleJoinGame,handleStart,skipTurn } = useGameState();
    return (
            <div className="column">
                <button onClick={connectToLobby}>Connect to Lobby</button>
                <button onClick={handleJoinGame}>Join Game</button>
                <button onClick={handleStart}>Start Game</button>
                <button onClick={skipTurn}>Skip Turn</button>
            </div>
    );
}

function NextRoundModal() {
    const { gameState: {phase}, handleReadyAck } = useGameState();
    const [countDown, setCountDown] = useState<number>(5);
    const timeOutRef = useRef<number | undefined>(undefined);
    const tickRef = useRef<number | undefined>(undefined);
    // make this equal to gamephase.roundOver?
    const show = phase === 2;
    const style = { display: show ? "flex" : "none" };

    function updateTimer() {
        setCountDown((prev: number) =>  { return --prev} )
    }

    if(show) {
        if (timeOutRef.current === undefined) {
            timeOutRef.current = setTimeout(handleReadyUp, 5000);
        }
        if (tickRef.current === undefined) {
            tickRef.current = setInterval(updateTimer, 1000);
        }
    }

    function handleReadyUp() {
        clearTimeout(timeOutRef.current);
        handleReadyAck();
    }

    return (
        <div style={style} className="nextRoundModal">
            <h3>ROUND OVER!</h3>
            <PointsTable/>
            <p>Ready up for the next round :)</p>
            <button onClick={handleReadyUp}>
            Ready {countDown}...
            </button>
        </div>
    )
}

export default Game;
