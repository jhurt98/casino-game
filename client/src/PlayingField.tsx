import { useEffect, useRef } from "react";
import type { GameState } from "./Game.tsx";
import type { PlayingCard } from "./Game.tsx";
import Card from "./Card.tsx";
function PlayingField({gameState, playerId}: {gameState: GameState, playerId: string|undefined}) {

    const pos = useRef<{ top: number; left: number }>({
        top: 0,
        left: 0,
    });
    const dragStart = useRef<{ x: number; y: number } | null>(null);
    const draggedCardRef = useRef<HTMLDivElement | null>(null);
    const time = useRef<number>(0);
    const tableCardsRef = useRef<Array<Element>>([]);
    const overlappingCardRef = useRef<Element|null>(null);

    function handleMouseDown(e: MouseEvent, cardRef: HTMLDivElement | null) {
        e.preventDefault();
        dragStart.current = { x: e.clientX, y: e.clientY };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        if (cardRef) {
            draggedCardRef.current = cardRef;
            cardRef.style.zIndex = "100";
        }       
    }

    function handleMouseMove(e: MouseEvent) {
        if (!dragStart.current || !draggedCardRef.current) {
            return;
        }
        e.preventDefault();
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        pos.current.left = pos.current.left + dx;
        pos.current.top = pos.current.top + dy;
        dragStart.current = { x: e.clientX, y: e.clientY };
        if (draggedCardRef.current) {
            draggedCardRef.current.style.transform = `translate(${pos.current.left}px, ${pos.current.top}px)`;
        }       
        detectCollisions();
    }

    function handleMouseUp() {
        pos.current.left = 0;
        pos.current.top = 0;
        dragStart.current = null;
        if (draggedCardRef.current) {
            draggedCardRef.current.style.transform = `translate(${pos.current.left}px, ${pos.current.top}px)`;
            draggedCardRef.current.style.zIndex = "0";
            draggedCardRef.current = null;
        }       
        if (overlappingCardRef.current !== null) {
            overlappingCardRef.current.style.border = "2px solid grey";
            overlappingCardRef.current = null;
        }
    }

    function detectCollisions() {
        if (!draggedCardRef.current) return;
        if (Date.now() - time.current < 16) return;
        time.current = Date.now();
        // loop through cards on the table...
        if (tableCardsRef.current.length === 0) {
            tableCardsRef.current = getTableCards();
        }
        const overlappingCards = [];
        for (const tableCard of tableCardsRef.current) {
            const tableCardRect = tableCard.getBoundingClientRect();
            const draggedCardRect = draggedCardRef.current.getBoundingClientRect();
            if (cardsAreOverlapping(tableCardRect, draggedCardRect)) {
                overlappingCards.push(tableCard);
            }
        }
        if (overlappingCards.length > 0) {
            const result = dominantCard(overlappingCards, draggedCardRef.current.getBoundingClientRect());
            if (result !== overlappingCardRef.current) {
                if (overlappingCardRef.current !== null) {
                    overlappingCardRef.current.style.border = "2px solid grey";
                }
                overlappingCardRef.current = result;
                overlappingCardRef.current.style.border = "4px solid yellow";
            }
            //console.log(overlappingCardRef.current);
        } else {
            if (overlappingCardRef.current !== null) {
                overlappingCardRef.current.style.border = "2px solid grey";
                overlappingCardRef.current = null;
            }
        }

    }

    function cardsAreOverlapping(target: DOMRect, source: DOMRect) {
        const [x1, y1, width1, height1] = [source.x, source.y, source.width, source.height];
        const [x2, y2, width2, height2] = [target.x, target.y, target.width, target.height];
        return !((x1 > x2 + width2) || (x1 + width1 < x2) || (y1 > y2 + height2) || (y1 + height1 < y2));
    }

    function getOverlappedArea(target: DOMRect, source: DOMRect) {
        let width, height;
        if (source.x >= target.x) {
            width = target.width - (source.x - target.x);
        } else {
            width = (source.x + source.width) - target.x;
        }
        if (source.y >= target.y) {
            height = target.height - (source.y - target.y);
        } else {
            height = (source.y + source.height) - target.y;
        }
        return width * height;
    }

    function dominantCard(targets: Array<Element>, source: DOMRect) {
        let result = null;
        let maxArea = 0;
        for (const target of targets) {
            const area = getOverlappedArea(target.getBoundingClientRect(), source); 
            if (area > maxArea) {
                result = target;
                maxArea = area;
            }
        }
        return result;
    }

    useEffect(() => {
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    function createCardComponents(cards: Array<PlayingCard>) {
        return cards.map((card) => {
            const style = { "margin": "4px", "position": "relative" };
            return (
                <div
                    style={style}
                    key={card.suit + card.rank}
                >
                    {createCardComponent(card)}
                </div>
            );
        });
    }

    function createCardComponent(card: PlayingCard) {
        return <Card card={card} handleMouseDown={handleMouseDown}/>;
    }

    function getTableCards() {
        const tableDiv = document.getElementById("tableCards");
        const childrenArray = Array.from(tableDiv.children);
        return childrenArray.map(child => child.children[0]);
    }

    const currentPlayer = gameState.players.find(
        (player) => player.id === playerId,
    ) || {
        hand: [],
        pile: [],
        points: 0,
        id: "undefined",
    };
    const { hand: currentHand, pile: currentPile } = currentPlayer;

    return (
        <>
        <div className="table" id="tableCards">
            {createCardComponents(gameState.table)}
        </div>
        <div style={{ display: "flex" }}>
            <div className="playerHand">
                {createCardComponents(currentHand)}
            </div>
        <div className="playerPile">
        {createCardComponents(currentPile)}
        </div>
        </div>
        </>
    );
}

export default PlayingField;
