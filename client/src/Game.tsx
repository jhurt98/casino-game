import "./Game.css";
import { useState, useRef, useEffect, useCallback } from "react";
import { useGameState } from "./useGameState.ts";
import PlayingField from "./PlayingField.tsx";
import Lobby from "./Lobby.tsx";
import { DragProvider } from "./DragContext.tsx";

function Game() {
    const { gameState, playerId } = useGameState();
    const isPlayersTurn = gameState.turn.currentPlayerId === playerId;
    const currentPlayer = gameState.players.find((player) => player.id === playerId) || {
        hand: [],
        pile: [],
        points: 0,
        id: "undefined",
    };

    function renderGamePhase() {
        switch(gameState.phase){
            case 0: return <Lobby/>;
            case 1: return <DragProvider isPlayersTurn={isPlayersTurn} hand={currentPlayer.hand}><PlayingField/></DragProvider>;
            case 2: return <NextRoundModal/>;
            default: return <Lobby/>;
        }
    }
    return (
        <div className="game">
            <h1>&#127183;</h1>
            <LeftColumn/>
            {renderGamePhase()}
            <Buttons/>
        </div>
    );
}

function PointsTable() {
    const { gameState: {phase, players} } = useGameState();
    return (
        <table>
            <thead>
                <tr>
                    <th scope="col">Player</th>
                    { phase > 0 && <th scope="col">Points</th> }
                </tr>
            </thead>
            <tbody>
                {players.map((player) => (
                    <tr key={player.id}>
                        <th scope="row">{player.name}</th>
                        { phase > 0 && <td>{player.points}</td>}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function LeftColumn() {
    const { gameState: { phase } } = useGameState();
    const infoString =(()=>{
        switch(phase) {
            case 0: return "LOBBY";
            case 1: return "GAME";
            case 2: return "ROUND OVER";
        }
    })();

    return (
            <div className="column">
                    <h3 style={{ alignSelf: "center" }}>
                        {infoString}
                    </h3>
                <PointsTable />
            </div>
    );
}

function Buttons() {
    const { skipTurn } = useGameState();
    return (
            <div className="column">
                <button onClick={skipTurn}>Skip Turn</button>
            </div>
    );
}

function NextRoundModal() {
    const { gameState: {phase}, handleReadyAck } = useGameState();
    const [countDown, setCountDown] = useState<number>(10);
    const timeoutRef = useRef<number | undefined>(undefined);
    const tickRef = useRef<number | undefined>(undefined);
    // make this equal to gamephase.roundOver?
    const show = phase === 2;
    const style = { display: show ? "flex" : "none" };

    const updateTimer = useCallback(()=>{
        setCountDown((prev: number) =>  { return --prev} );
    },[]);

    const handleReadyUp = useCallback(()=>{
        clearTimeout(timeoutRef.current);
        handleReadyAck();
    },[handleReadyAck]);

    useEffect(()=>{
        if(show) {
            if (tickRef.current === undefined) {
                tickRef.current = setInterval(updateTimer, 1000);
            }
            if (timeoutRef.current === undefined) {
                timeoutRef.current = setTimeout(handleReadyUp, 10000);
            }
        }
        return ()=>{ 
            if (timeoutRef.current !== null) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = undefined;
            }
            if (tickRef.current !== null) {
                clearInterval(tickRef.current);
            }
        }
    },[show, updateTimer, handleReadyUp])

    return (
        <div style={style} className="nextRoundModal">
            <h3>ROUND OVER!</h3>
            <PointsTable/>
            <p>Ready up for the next round :)</p>
                { timeoutRef.current !== undefined ? 
                    <button onClick={handleReadyUp}>Ready {countDown}...</button>
                    : <span>Ready! :)</span>
                }
        </div>
    )
}

export default Game;
