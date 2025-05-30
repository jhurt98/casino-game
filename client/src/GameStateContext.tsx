import { createContext, ReactNode } from "react";
import { CardStack, GameState } from "./types.ts";
import useGameStateWithWebsocket, { Move } from "./useGameStateWithWebSocket.ts";

export interface GameStateContextType {
    gameState: GameState;
    playerId: string | undefined;
    handleJoinRoom: (e: React.FormEvent)=>void;
    handleStart: ()=>void;
    handleReadyAck: ()=>void;
    getPossibleMoves: (draggedCardStack: CardStack | null, overlappedCardStack: CardStack | null, isTableOverlapped: boolean)=>Array<Move>;
    skipTurn: ()=>void;
    tableHistory: Array<Array<CardStack>>;
    undoTableHistory: ()=>void;
    resetTableHistory: ()=>void;
    createRoom: ()=>void;
    roomId: string;
}

export const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateContextProvider ({children}: {children: ReactNode}) {
    const data = useGameStateWithWebsocket();
    return <GameStateContext.Provider value={data}>{children}</GameStateContext.Provider>
}
