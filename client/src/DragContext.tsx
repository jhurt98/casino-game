import React, { useState, useEffect, useRef, useCallback, createContext, ReactNode } from "react";
import type { CardStack, PlayingCard } from "./types.ts";
import { detectOverlappedCardStack, detectTable } from "./utils/collisionUtils.ts";
import { determinePossibleMoves } from "./utils/moveDecider.ts";

export interface DragContextType {
    dragEnabled: boolean;
    draggedCardStack: CardStack | null;
    overlappedCardStack: CardStack | null;
    isTableOverlapped: boolean;
    showModalPrompt: boolean;

    handleMouseDown: (e: React.MouseEvent<HTMLDivElement>,cardRef: HTMLDivElement | null,card: CardStack) =>  void;
    registerCardStackRef: (card: CardStack, element: HTMLDivElement | null) => void;
    registerTableRef: (element: HTMLDivElement | null) => void;
    closeModal: () => void;
}

export const DragContext = createContext<DragContextType | undefined>(undefined);


export function DragProvider({children, isPlayersTurn, hand}: {children: ReactNode, isPlayersTurn: boolean, hand: Array<PlayingCard>}) {

    const pos = useRef<{ top: number; left: number }>({
        top: 0,
        left: 0,
    });
    const dragEnabled = useRef<boolean>(true);
    const dragStart = useRef<{ x: number; y: number } | null>(null);
    const draggedElement = useRef<HTMLDivElement | null>(null);
    const draggedCardStackObj = useRef<CardStack | null>(null);
    const time = useRef<number>(0);
    const allCardStackRefs = useRef<Map<CardStack, HTMLDivElement>>(new Map());
    const tableRef = useRef<HTMLDivElement | null>(null);
    const overlappedCardStackRef = useRef<CardStack | null>(null);
    const isTableOverlappedRef = useRef<boolean>(false);
    const rAF = useRef<number | null>(null);

    const [isTableOverlapped, setIsTableOverlapped] = useState<boolean>(false);
    const [overlappedCardStack, setOverlappedCardStack] = useState<CardStack | null>(null);
    const [showModalPrompt, setShowModalPrompt] = useState<boolean>(false);

    function handleMouseDown(
        e: React.MouseEvent<HTMLDivElement>,
        cardRef: HTMLDivElement | null,
        card: CardStack,
    ): void {
        if (!dragEnabled.current) {
            return;
        }
        e.preventDefault();
        dragStart.current = { x: e.clientX, y: e.clientY };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        if (cardRef) {
            draggedElement.current = cardRef;
            cardRef.style.zIndex = "100";
            draggedCardStackObj.current = card;
        } 
    }

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragStart.current || !draggedElement.current || !dragEnabled.current) {
            return;
        }
        e.preventDefault();
        if (Date.now() - time.current < 16) return;
        time.current = Date.now();
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        pos.current.left = pos.current.left + dx;
        pos.current.top = pos.current.top + dy;
        dragStart.current = { x: e.clientX, y: e.clientY };

        if (rAF.current === null) {
            rAF.current = requestAnimationFrame(()=>{
                if (draggedElement.current) {
                    draggedElement.current.style.transform = `translate(${pos.current.left}px, ${pos.current.top}px)`;
                }
                rAF.current = null;
            });
        }
        const overlappedCardStack = detectOverlappedCardStack(draggedElement.current, allCardStackRefs.current);
        setOverlappedCardStack(makeOverlappedCardStackUpdater(overlappedCardStack));
        if (tableRef.current === null) return;
        const isOverlappingTable = detectTable(draggedElement.current, tableRef.current);
        setIsTableOverlapped(isOverlappingTable);
        isTableOverlappedRef.current = isOverlappingTable;
    },[]);

    const handleMouseUp = useCallback(() => {
        if (draggedElement.current === null || draggedCardStackObj.current === null) {
            return;
        }
        window.removeEventListener("mouseup", handleMouseUp);
        window.removeEventListener("mousemove", handleMouseMove);

        if ((overlappedCardStackRef.current === null && !isTableOverlappedRef.current)|| !isPlayersTurn) {
            resetDraggedCard();
            resetOverlappedCard();
            setIsTableOverlapped(false);
            return;
        }
        dragEnabled.current = false;
        // should i use the refs or the state? ima use refs... 
        const possibleMoves = determinePossibleMoves(hand, draggedCardStackObj.current, overlappedCardStackRef.current, isTableOverlappedRef.current);
        if (possibleMoves.length > 0) {
            setShowModalPrompt(possibleMoves.length > 0);
        } else {
            dragEnabled.current = true;
            overlappedCardStackRef.current = null;
            resetDraggedCard();
            setOverlappedCardStack(null);
            setIsTableOverlapped(false);
        }
    },[isPlayersTurn, handleMouseMove, hand]);

    function resetDraggedCard() {
        dragStart.current = null;
        pos.current.left = 0;
        pos.current.top = 0;
        if (draggedElement.current === null || draggedCardStackObj.current === null) {
            return;
        }
        draggedElement.current.style.transform = `translate(${pos.current.left}px, ${pos.current.top}px)`;
        draggedElement.current.style.zIndex = "0";
        draggedElement.current = null;
        draggedCardStackObj.current = null;
    }

    function resetOverlappedCard() {
        overlappedCardStackRef.current = null;
        setOverlappedCardStack(null);
    }

    function makeOverlappedCardStackUpdater(resultCardStack: CardStack | null) {
        return (prev: CardStack | null) => {
            if (prev !== resultCardStack) {
                overlappedCardStackRef.current = resultCardStack;
                return resultCardStack;
            }
            return prev;
        };
    }

    useEffect(() => {
        return () => {
            window.removeEventListener("mouseup", handleMouseUp);
            window.removeEventListener("mousemove", handleMouseMove);
        };
    }, [handleMouseUp, handleMouseMove]);

    /*move types
    * toss from hand
    * take single card from table with hand card
    * combine two cards on table to sum to hand card
    * create stacked card on table with hand that sums to other hand
    * */

    function closeModal() {
        dragEnabled.current = true;
        overlappedCardStackRef.current = null;
        isTableOverlappedRef.current = false;
        resetDraggedCard();
        setOverlappedCardStack(null);
        setIsTableOverlapped(false);
        setShowModalPrompt(false);
    }

    function registerCardStackRef(cardStack: CardStack, cardStackRef: HTMLDivElement | null): void {
        if (cardStackRef) {
            allCardStackRefs.current.set(cardStack, cardStackRef);
        } else {
            allCardStackRefs.current.delete(cardStack);
        }
    }

    function registerTableRef(table: HTMLDivElement | null) {
        if (table){
            tableRef.current = table;
        }
    }

    const value = {
        dragEnabled: dragEnabled.current,
        draggedCardStack: draggedCardStackObj.current,
        overlappedCardStack,
        isTableOverlapped,
        handleMouseDown,
        registerCardStackRef,
        registerTableRef,
        showModalPrompt,
        closeModal,
    }

    return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}
