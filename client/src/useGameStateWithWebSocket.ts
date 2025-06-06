import { useState, useRef, useEffect, useCallback } from "react";
import { GameStateContextType } from "./GameStateContext";
import { GameState, PlayingCard, CardStack, Player, Turn } from "./types.ts";
import { determinePossibleMoves, getRankValue } from "./utils/moveDecider.ts";

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
        name: data.name ?? "Player",
        connected: data.connected ?? true,
    };
}

function normalizeCards(data: Array<PlayingCard>, location: string): void {
    data.forEach((card) => {
        card.location = location;
    });
}

const host = import.meta.env.VITE_API_HOST;
const port = import.meta.env.VITE_API_PORT;
const apiprotocol = import.meta.env.VITE_API_PROTOCOL;
const wsprotocol = import.meta.env.VITE_WS_PROTOCOL;

const apiUrl = `${apiprotocol}://${host}:${port}`;
const wsUrl = `${wsprotocol}://${host}:${port}`;

function useGameStateWithWebsocket() {
    const [gameState, setGameState] = useState<GameState>(defaultGameState);
    const [playerId, setPlayerId] = useState<string>("");
    const [tableHistory, setTableHistory] = useState<Array<Array<CardStack>>>([]);
    const [roomId, setRoomId] = useState<string>("");
    const gameStateRef = useRef<GameState>(gameState);
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

    useEffect(()=> {
        gameStateRef.current = gameState;
    }, [gameState]);

    function wsOnMessage(event: MessageEvent) {
        const message = JSON.parse(event.data);
        if (message.type === "join") {
            const players: Array<Player> = message.data.allPlayers.map((player: Player) =>
                normalizePlayer(player),
            ) as Array<Player>;
            const myPlayerId: string = message.data.myPlayerId;
            const newGameState: GameState = { ...gameStateRef.current, players: players, } as GameState;
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
            players.forEach((player) => { normalizeCards(player.hand, "hand"); normalizeCards(player.pile, "pile");});
            table.forEach((cardStack) => { normalizeCards(cardStack.cards, "table"); });
            const newGameState: GameState = { deckLen: deckLen, table: table, turn: turn, players: players, phase: phase, } as GameState;
            setTableHistory([table]);
            setGameState(newGameState);
        } else if (message.type === "disconnect") {
            const disconnectedPlayerId = message.data.playerId;
            const newPlayers = [ ...gameStateRef.current.players ];
            const disconnectedPlayer = newPlayers.find(player => player.id === disconnectedPlayerId);
            if (disconnectedPlayer !== undefined) {
                disconnectedPlayer.connected = false;
            }
            const newGameState: GameState = { ...gameStateRef.current, players: newPlayers, } as GameState;
            setGameState(newGameState);
        } else if (message.type === "connect") {
            const disconnectedPlayerId = message.data.playerId;
            const newPlayers = [ ...gameStateRef.current.players ];
            const disconnectedPlayer = newPlayers.find(player => player.id === disconnectedPlayerId);
            if (disconnectedPlayer !== undefined) {
                disconnectedPlayer.connected = true;
            }
            const newGameState: GameState = { ...gameStateRef.current, players: newPlayers, } as GameState;
            setGameState(newGameState);
        }
    }

    function sendGameMessage(message: Message): void {
        if (socketRef.current === null) {
            return;
        }
        socketRef.current.send(JSON.stringify(message));
    }

    async function joinRoom(roomID: string, playerName: string) {
        try {
            const response = await fetch(`${apiUrl}/joinRoom/${roomID}?playerName=${playerName}`, {method: "POST"});
            const playerID = await response.text();
            console.log("joined room", playerID);
            const socket = new WebSocket(`${wsUrl}/gameconnect/${roomID}/${playerID}`);
            setPlayerId(playerID);
            socket.onmessage = wsOnMessage; 
            socket.onopen = ()=>{
                sessionStorage.setItem("playerID", playerID);
                sessionStorage.setItem("roomID", roomID);
                setRoomId(roomID)
            };
            socket.addEventListener("error", (event) => {
                console.log(event);
            });
            socketRef.current = socket;
        } catch (e) {
            if (e instanceof Error) {
                console.log('❌ Join room failed: ' + e.message);
            }
        }
    }

    async function createRoom(playerName: string) {
        try {
            const response = await fetch(`${apiUrl}/createRoom`, {method: "POST"});
            const roomID = await response.text();
            const joinResponse = await fetch(`${apiUrl}/joinRoom/${roomID}?playerName=${playerName}`, {method: "POST"});
            const playerID = await joinResponse.text();
            const socket = new WebSocket(`${wsUrl}/gameconnect/${roomID}/${playerID}`);
            socket.onmessage = wsOnMessage; 
            socket.addEventListener("error", (event) => {
                console.log(event);
            });
            socket.onopen = ()=>{
                sessionStorage.setItem("playerID", playerID);
                sessionStorage.setItem("roomID", roomID);
                setRoomId(roomID)
            };
            socketRef.current = socket;
            setRoomId(roomId);
            setPlayerId(playerId);
        } catch (e) {
            if (e instanceof Error) {
                console.log('❌ Create room failed: ' + e.message);
            }
        }
    }

     const reconnectToGame = useCallback((roomID:string, playerID:string) => {
         const socket = new WebSocket(`${wsUrl}/gameConnect/${roomID}/${playerID}`);
         socket.onmessage = wsOnMessage; 
         socket.addEventListener("error", (event) => {
             console.log(event);
         });
         socketRef.current = socket;
         setPlayerId(playerID);
         setRoomId(roomID)
     },[]);

     function leaveRoom() {
         if (socketRef.current === null) {
             return;
         }
         socketRef.current.close(1000);
         sessionStorage.clear();
         setGameState(defaultGameState);
         setRoomId("");
         setPlayerId("");
     }

     function startGame() {
         if (socketRef.current === null) {
             return;
         }
         const message: Message = {
             type: "start",
             data: {},
         };
         socketRef.current.send(JSON.stringify(message));
     }

    const handleReadyAck = useCallback(() => {
        if (socketRef.current === null) {
            return;
        }
        const message: Message = {
            type: "readyAck",
            data: {},
        };
        socketRef.current.send(JSON.stringify(message));
    }, []);

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

    const value: GameStateContextType = {
        gameState: gameState,
        playerId: playerId,
        joinRoom: joinRoom,
        startGame: startGame,
        handleReadyAck: handleReadyAck,
        getPossibleMoves: getPossibleMoves,
        skipTurn: skipTurn,
        tableHistory: tableHistory,
        undoTableHistory: undoTableHistory,
        resetTableHistory: resetTableHistory,
        createRoom: createRoom,
        roomId: roomId,
        reconnectToGame: reconnectToGame,
        leaveRoom: leaveRoom,
    };
    return value;
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
        const sum = getRankValue(source.rank) + getRankValue(target.rank);
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
