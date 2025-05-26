import { createContext, ReactNode } from "react";
import { CardStack, GameState } from "./types.ts";
import useGameStateWithWebsocket, { Move } from "./useGameStateWithWebSocket.ts";

export interface GameStateContextType {
    gameState: GameState;
    playerId: string | undefined;
    connectToLobby: ()=>void;
    handleJoinGame: ()=>void;
    handleStart: ()=>void;
    handleReadyAck: ()=>void;
    getPossibleMoves: (draggedCardStack: CardStack | null, overlappedCardStack: CardStack | null, isTableOverlapped: boolean)=>Array<Move>;
    skipTurn: ()=>void;
}

export const GameStateContext = createContext<GameStateContextType | undefined>(undefined);

export function GameStateContextProvider ({children}: {children: ReactNode}) {
    const data = useGameStateWithWebsocket();
    return <GameStateContext.Provider value={data}>{children}</GameStateContext.Provider>
}
