import { useContext } from "react";
import { DragContext, DragContextType } from "./DragContext";

export function useDrag(): DragContextType {
    const context = useContext(DragContext);
    if (context === undefined) {
        throw new Error("useDrag must be used with a provider");
    }
    return context;
}
