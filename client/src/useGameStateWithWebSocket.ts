import { useState, useRef, useEffect } from "react";
import { GameStateContextType } from "./GameStateContext";
import { GameState, PlayingCard, CardStack, Player, Turn } from "./types.ts";
import { determinePossibleMoves } from "./utils/moveDecider.ts";

interface Message {
    type: string;
    data: object;
}

export interface Move {
    type: MoveType;
    title: string;
    handler: () => void;
}

export enum MoveType {
    Toss,
    Take,
    PlayerStackSum,
    PlayerStackDup,
    TableStackSum,
    TableStackDup
}

const defaultGameState: GameState = {
    deckLen: 0,
    table: [],
    players: [],
    turn: { turnCount: 0, currentPlayerId: "" },
    phase: 0,
};

function normalizePlayer(data: Player): Player {
    return {
        id: data.id ?? 0,
        hand: data.hand ?? [],
        pile: data.pile ?? [],
        points: data.points ?? 0,
    };
}

function normalizeCards(data: Array<PlayingCard>, location: string): void {
    data.forEach((card) => {
        card.location = location;
    });
}

function useGameStateWithWebsocket() {
    const [gameState, setGameState] = useState<GameState>(defaultGameState);
    const [playerId, setPlayerId] = useState<string>();
    const [tableHistory, setTableHistory] = useState<Array<Array<CardStack>>>([]);
    const socketRef = useRef<WebSocket | null>(null);
    const currentPlayer = gameState.players.find((player) => player.id === playerId) || {
        hand: [],
        pile: [],
        points: 0,
        id: "undefined",
    };

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

    // just for readability sake i could decompose the message handlers into something else and make this function shorter, while still communicating its purpose...
    function connectToLobby() {
        const socket = new WebSocket("ws://localhost:8080/game");
        socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.type === "join") {
                const players: Array<Player> = message.data.allPlayers.map((player: Player) =>
                    normalizePlayer(player),
                ) as Array<Player>;
                const myPlayerId: string = message.data.myPlayerId;
                const newGameState: GameState = { ...gameState, players: players, } as GameState;
                setGameState(newGameState);
                setPlayerId(myPlayerId);
            } else if (message.type === "state") {
                const players: Array<Player> = message.data.players.map((player: Player) =>
                    normalizePlayer(player),
                ) as Array<Player>;
                const table: Array<CardStack> = message.data.table as Array<CardStack>;
                const turn: Turn = message.data.turn as Turn;
                const deckLen: number = message.data.deckLen;
                const phase: number = message.data.phase;
                //console.log(message.data);
                players.forEach((player) => { normalizeCards(player.hand, "hand"); normalizeCards(player.pile, "pile");});
                table.forEach((cardStack) => {normalizeCards(cardStack.cards, "table");});
                setTableHistory([table]);
                const newGameState: GameState = { deckLen: deckLen, table: table, turn: turn, players: players, phase: phase, } as GameState;
                setGameState(newGameState);
            }
        };
        socket.addEventListener("error", (event) => {
            console.log(event);
        });
        socketRef.current = socket;
    }

    function sendGameMessage(message: Message): void {
        if (socketRef.current === null) {
            return;
        }
        socketRef.current.send(JSON.stringify(message));
    }

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

    function handleReadyAck() {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "readyAck",
            data: {},
        };
        socketRef.current.send(JSON.stringify(message));
    }

    function tossCard(draggedCard: PlayingCard) {
        sendGameMessage(createTossMessage(draggedCard));
    }

    function createTossMessage(draggedCard: PlayingCard) {
        return {
            type: "playerMove",
            data: {
                moveType: "toss",
                playerId: playerId,
                cards: [draggedCard],
            },
        } as Message;
    }

    function handleTakeCards(draggedCard: PlayingCard, overlappedCardStack: CardStack) {
        sendGameMessage(createTakeMessage([draggedCard, ...overlappedCardStack.cards]));
    }

    function createTakeMessage(cardsToTake: Array<PlayingCard>) {
        return {
            type: "playerMove",
            data: {
                moveType: "take",
                playerId: playerId,
                cards: cardsToTake,
            },
        } as Message;
    }

    function handleTableStack(draggedCardStack: CardStack, overlappedCardStack: CardStack, stackType: string) {
        const targetCardStackCopy = {
            ...overlappedCardStack,
            cards: [...overlappedCardStack.cards, ...draggedCardStack.cards],
            type: stackType,
            rank: deriveNewCardRank(draggedCardStack, overlappedCardStack, stackType),
        };

        const newTable = [...tableHistory[tableHistory.length-1]];
        const cardStackToRemove = newTable.findIndex(tableStack => tableStack === draggedCardStack);
        const targetIndex = newTable.findIndex(stack => stack === overlappedCardStack);

        newTable[targetIndex] = targetCardStackCopy;
        newTable.splice(cardStackToRemove, 1);

        setGameState({...gameState, table: newTable});
        setTableHistory([...tableHistory, newTable]);
    }

    function stackForLater(draggedCard: PlayingCard, overlappedCardStack: CardStack, cardStackType: string) {
        overlappedCardStack.type = cardStackType;
        sendGameMessage(createStackForLaterMessage(draggedCard, overlappedCardStack));
    }

    function createStackForLaterMessage(draggedCard: PlayingCard, overlappedCardStack: CardStack) {
        return {
            type: "playerMove",
            data: {
                moveType: "stackForLater",
                playerId: playerId,
                cards: [draggedCard],
                cardStack: overlappedCardStack,
            },
        } as Message;
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

    function undoTableHistory() {
        // assumption: only called when tableHistory.length > 1. enforced by UI. see TableController in PlayingField.tsx
        const newTableHistory = [...tableHistory];
        newTableHistory.pop();
        
        const newTable = newTableHistory[newTableHistory.length-1];
        const newGameState = { ...gameState, table: newTable };
        setGameState(newGameState);
        setTableHistory(newTableHistory);
    }

    function resetTableHistory() {
        const newTableHistory = [tableHistory[0]];
        const newTable = [...tableHistory[0]];
        const newGameState = { ...gameState, table: newTable };
        setTableHistory(newTableHistory);
        setGameState(newGameState);
    }

    function getPossibleMoves(
        draggedCardStack: CardStack | null,
        overlappedCardStack: CardStack | null,
        isTableOverlapped: boolean,
    ): Array<Move> {
        const moves: Array<Move> = [];
        if (draggedCardStack === null) {
            return moves;
        }
        const moveTypes = determinePossibleMoves(
            currentPlayer.hand,
            draggedCardStack,
            overlappedCardStack,
            isTableOverlapped,
        );

        moveTypes.forEach((moveType) => {
            switch (moveType) {
                case MoveType.Take:
                    moves.push({
                        type: moveType,
                        title: "Take",
                        handler: functionWithNonNullArguments(
                            handleTakeCards,
                            draggedCardStack.cards[0],
                            overlappedCardStack,
                        ),
                    } as Move);
                    break;

                case MoveType.Toss:
                    moves.push({
                        type: moveType,
                        title: "Toss",
                        handler: functionWithNonNullArguments(tossCard, draggedCardStack.cards[0]),
                    });
                    break;

                case MoveType.TableStackSum:
                    moves.push({
                        type: moveType,
                        title: "Create Sum Stack",
                        handler: functionWithNonNullArguments(
                            handleTableStack,
                            draggedCardStack,
                            overlappedCardStack,
                            "sum",
                        ),
                    } as Move);
                    break;

                case MoveType.TableStackDup:
                    moves.push({
                        type: moveType,
                        title: "Stack Duplicate Table Card",
                        handler: functionWithNonNullArguments(
                            handleTableStack,
                            draggedCardStack,
                            overlappedCardStack,
                            "dup",
                        ),
                    } as Move);
                    break;

                case MoveType.PlayerStackSum:
                    moves.push({
                        type: moveType,
                        title: "Stack Sum for Later",
                        handler: functionWithNonNullArguments(
                            stackForLater,
                            draggedCardStack.cards[0],
                            overlappedCardStack,
                            "sum",
                        ),
                    } as Move);
                    break;

                case MoveType.PlayerStackDup:
                    moves.push({
                        type: moveType,
                        title: "Stack Dup for Later",
                        handler: functionWithNonNullArguments(
                            stackForLater,
                            draggedCardStack.cards[0],
                            overlappedCardStack,
                            "dup",
                        ),
                    } as Move);
                    break;
                default:
                    break;
            }
        });
        return moves;
    }

    const data: GameStateContextType = {
        gameState: gameState,
        playerId: playerId,
        connectToLobby: connectToLobby,
        handleJoinGame: handleJoinGame,
        handleStart: handleStart,
        handleReadyAck: handleReadyAck,
        getPossibleMoves: getPossibleMoves,
        skipTurn: skipTurn,
        tableHistory: tableHistory,
        undoTableHistory: undoTableHistory,
        resetTableHistory: resetTableHistory,
    };

    return data;
}

// this might not be good because now the move handlers receive copies of PlayingCard and CardStack... can no longer make equality checks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function functionWithNonNullArguments(f: (...args: any[]) => void,
    ...args: Array<PlayingCard | CardStack | Array<PlayingCard> | string | null>
) {
    for (const arg of args) {
        if (arg === null) {
            return () => {};
        }
    }
    return () => {
        f(...args);
    };
}

/* todo: 
* implement Ace = 1
* guard sums > 10 */
function deriveNewCardRank(source: CardStack, target: CardStack, stackType: string) {
    if (stackType === "sum") {
        const sum = Number(source.rank) + Number(target.rank);
        if (Number.isNaN(sum)) { 
            console.error("ermmmm this shouldn't even happen");
            return "";
        }
        return String(sum);
    }
    if (stackType === "dup") {
        return target.rank;
    }
    return source.rank;
}
export default useGameStateWithWebsocket;
