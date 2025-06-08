import { createContext, ReactNode } from "react";
import { CardStack, GameState } from "./types.ts";
import useGameStateWithWebsocket, { Move } from "./useGameStateWithWebSocket.ts";

export interface GameStateContextType {
    gameState: GameState;
    playerId: string | undefined;
    joinRoom: (roomID: string, playerName: string)=>void;
    startGame: ()=>void;
    handleReadyAck: ()=>void;
    getPossibleMoves: (draggedCardStack: CardStack | null, overlappedCardStack: CardStack | null, isTableOverlapped: boolean)=>Array<Move>;
    skipTurn: ()=>void;
    tableHistory: Array<Array<CardStack>>;
    undoTableHistory: ()=>void;
    resetTableHistory: ()=>void;
    createRoom: (playerName:string)=>void;
    roomId: string;
    reconnectToGame: (roomID:string, playerID:string)=>void;
    leaveRoom: ()=>void;
    showToast: boolean;
}

export const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateContextProvider ({children}: {children: ReactNode}) {
    const data = useGameStateWithWebsocket();
    return <GameStateContext.Provider value={data}>{children}</GameStateContext.Provider>
}
