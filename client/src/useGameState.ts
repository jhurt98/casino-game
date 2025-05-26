import { useContext } from "react";
import { GameStateContext, GameStateContextType } from "./GameStateContext.tsx";

export function useGameState(): GameStateContextType {
    const context = useContext(GameStateContext);
    if (context === undefined) {
        throw new Error("useGameState must be used with a provider");
    }
    return context;
}
