import "./Game.css";
import { useState, useRef, useEffect, useCallback } from "react";
import Card from "./Card.tsx";
import PlayingField from "./PlayingField.tsx";

export interface PlayingCard {
    suit: string;
    rank: string;
    value: number;
}

export interface GameState {
    table: Array<PlayingCard>;
    players: Array<Player>;
    turn: Turn;
    deckLen: number;
    phase: number;
}

interface Turn {
    turnCount: number;
    currentPlayerId: string;
}

interface Player {
    id: string;
    hand: Array<PlayingCard>;
    pile: Array<PlayingCard>;
    points: number;
}

//interface UIState {
//}

interface Message {
    type: string;
    data: object;
}

function normalizePlayer(data: Player): Player {
    return {
        id: data.id ?? 0,
        hand: data.hand ?? [],
        pile: data.pile ?? [],
        points: data.points ?? 0,
    };
}

const defaultGameState: GameState = {
    table: [],
    players: [],
    turn: { turnCount: 0, currentPlayerId: "" },
    deckLen: 0,
};
//const MAX_POINTS = 25;

function Game() {
    const socketRef = useRef<WebSocket | null>(null);
    const [gameState, setGameState] = useState<GameState>(defaultGameState);
    const [playerId, setPlayerId] = useState<string>();
    const [selectedCards, setSelectedCards] = useState<Array<PlayingCard>>([]);
    const [selectingTakeCards, setSelectingPileCards] =
        useState<boolean>(false);
    const [selectingTossCards, setSelectingTossCards] =
        useState<boolean>(false);

    function testWS() {
        const socket = new WebSocket("ws://localhost:8080/game");
        socket.onmessage = (event) => {
            //console.log("event data", event.data);
            const message = JSON.parse(event.data);
            //console.log("message", message);
            if (message.type === "join") {
                const players: Array<Player> = message.data.allPlayers.map(
                    (player: Player) => normalizePlayer(player),
                ) as Array<Player>;
                const myPlayerId: string = message.data.myPlayerId;
                const newGameState: GameState = {
                    ...gameState,
                    players: players,
                } as GameState;
                setGameState(newGameState);
                setPlayerId(myPlayerId);
            } else if (message.type === "state") {
                const players: Array<Player> = message.data.players.map(
                    (player: Player) => normalizePlayer(player),
                ) as Array<Player>;
                const table: Array<PlayingCard> = message.data.table as Array<PlayingCard>;
                const turn: Turn = message.data.turn as Turn;
                const deckLen: number = message.data.deckLen;
                const phase: number = message.data.phase;
                const newGameState: GameState = {
                    table: table,
                    turn: turn,
                    players: players,
                    deckLen: deckLen,
                    phase: phase,
                } as GameState;
                setGameState(newGameState);
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

    useEffect(()=>{
        console.log("game componenent rerendered");
    })

    function handleJoinGame() {
        if (socketRef.current === null) {
            return;
        }
        const data = { type: "join", data: {} };
        socketRef.current.send(JSON.stringify(data));
    }

    function handleStart() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "start",
            data: {},
        };
        socketRef.current.send(JSON.stringify(message));
    }

    function handleTossCards() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "playerMove",
            data: {
                moveType: "toss",
                playerId: playerId,
                cards: selectedCards,
            },
        };
        socketRef.current.send(JSON.stringify(message));
        setSelectedCards([]);
        setSelectingTossCards(!selectingTossCards);
    }

    function handleTakeCards() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "playerMove",
            data: {
                moveType: "take",
                playerId: playerId,
                cards: selectedCards,
            },
        };
        socketRef.current.send(JSON.stringify(message));
        setSelectedCards([]);
        setSelectingPileCards(!selectingTakeCards);
    }

    function skipTurn() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "playerMove",
            data: {
                moveType: "skip",
                playerId: playerId,
                cards: [],
            },
        };
        socketRef.current.send(JSON.stringify(message));
    }

    function handleNextRound() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "playerMove",
            data: {
                moveType: "nextRound",
                playerId: playerId,
                cards: [],
            },
        };
        socketRef.current.send(JSON.stringify(message));
    }

    function createCardComponents(cards: Array<PlayingCard>, selectable: boolean) {
        return cards.map((card) => {
            const style = selectable
                ? { cursor: "pointer", margin: "2px", position: "relative" }
                : { margin: "4px", position: "relative" };
            const handleSelect = () => {
                if (selectedCards.includes(card)) {
                    const i = selectedCards.findIndex((c) => card === c);
                    if (i !== -1) {
                        selectedCards.splice(i, 1);
                    }
                    setSelectedCards([...selectedCards]);
                    return null;
                }
                setSelectedCards([...selectedCards, card]);
            };
            return (
                <div
                    style={style}
                    key={card.suit + card.rank}
                    onClick={selectable ? handleSelect : undefined}
                >
                    {createCardComponent(card)}
                </div>
            );
        });
    }

    function createCardComponent(card: PlayingCard) {
        return (
            <Card
                card={card}
                draggable={true}
                handleDragStart={handleDragStart}
                handleDragEnd={handleDragEnd}
                handleHoverOver={handleHoverOver}
            />
        );
    }

    function getCardId(card: PlayingCard) {
        return `${card.suit}-${card.rank}`;
    }

    const currentPlayer = gameState.players.find(
        (player) => player.id == playerId,
    ) || {
        hand: [],
        pile: [],
        points: 0,
        id: "undefined",
    };
    const { hand: currentHand, pile: currentPile } = currentPlayer;
    const selectingCards = selectingTakeCards || selectingTossCards;
    const selectedCardsContainer = (
        <div style={{ display: "flex" }}>
            {createCardComponents(selectedCards, true)}
        </div>
    );

    const isMyTurn = gameState.turn.currentPlayerId === currentPlayer.id;
    function PlayerActionButtons() {
        if (!isMyTurn) return null;
        if (currentHand.length === 0) {
            return <button onClick={skipTurn}>Skip Turn</button>;
        }
        return (
            <>
                <button
                    onClick={() => {
                        setSelectingPileCards(!selectingTakeCards);
                    }}
                >
                    {selectingTakeCards ? "Cancel" : "Select Cards to Pile"}
                </button>
                <button
                    onClick={() => {
                        setSelectingTossCards(!selectingTossCards);
                    }}
                >
                    {selectingTossCards ? "Cancel" : "Select Cards to Toss"}
                </button>
            </>
        );
    }

    function PlayerActionConfirmButtons() {
        if (!isMyTurn || !selectingCards || selectedCards.length === 0)
            return null;
        return (
            <button
                onClick={selectingTossCards ? handleTossCards : handleTakeCards}
            >
                {selectingTossCards ? "Toss to Table" : "Add to pile"}
            </button>
        );
    }

    function NextRoundAcknowledgeModal() {
        return <button>Ready For Next Round</button>;
    }

    function getGamePhaseInfoString() {
        if (gameState.phase === 2) {
            return `ROUND OVER.`;
        }
        return `Turn: ${gameState.turn.turnCount}`;
    }

    return (
        <div className="game">
            <h1>CASINO</h1>
            <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ alignSelf: "center", minHeight: "30px" }}>
                    <h4
                        style={{ color: "pink" }}
                    >{`Deck Count: ${gameState.deckLen}`}</h4>
                </div>
                <PointsTable players={gameState.players} />
            </div>
            <div className="board">
                <div style={{ alignSelf: "center", minHeight: "30px" }}>
                    <h4 style={{ color: "pink" }}>
                        {getGamePhaseInfoString()}
                    </h4>
                </div>
                <PlayingField gameState={gameState} playerId={playerId}/>
                <div style={{ minHeight: "97.6px" }}>
                    {selectingCards ? <div> Selecting </div> : null}
                    {selectingCards ? selectedCardsContainer : null}
                </div>
            </div>
            <div>
                <button onClick={testWS}>Connect to Lobby</button>
                <button onClick={handleJoinGame}>Join Game</button>
                <button onClick={handleStart}>Start Game</button>
                <button onClick={handleNextRound}>Next Round</button>
            </div>
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignSelf: "center",
                }}
            >
                <PlayerActionButtons />
                <PlayerActionConfirmButtons />
            </div>
        </div>
    );
}

function PointsTable({ players }: { players: Array<Player> }) {
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

export default Game;
