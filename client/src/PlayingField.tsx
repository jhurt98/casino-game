import { useEffect, useRef, useState } from "react";
import { useDrag } from "./useDrag.ts";
import { useGameState } from "./useGameState.ts";
import type { PlayingCard, CardStack } from "./types.ts";
import { DragProvider } from "./DragContext.tsx";
import Card from "./Card.tsx";
import "./Game.css";
import { Move } from "./useGameStateWithWebSocket.ts";

function PlayingField() {
    const { gameState, playerId } = useGameState();

    const currentPlayer = gameState.players.find((player) => player.id === playerId) || {
        hand: [],
        pile: [],
        points: 0,
        id: "undefined",
    };
    const { hand: playerHand, pile: playerPile} = currentPlayer;
    const isPlayersTurn = gameState.turn.currentPlayerId === playerId;

    return (
        <DragProvider isPlayersTurn={isPlayersTurn}>
        <Table cardStacks={gameState.table} />
        <MovePromptModal />
        <div style={{ display: "flex", marginBottom:"96px"}}>
        <Hand hand={playerHand} isPlayersTurn={isPlayersTurn}/>
        <Pile pile={playerPile}/>
        </div>
        </DragProvider>
    );
}

function CardStack({cardStack}: {cardStack: CardStack}) {
    const cardStackRef = useRef<HTMLDivElement | null>(null);
    const { overlappedCardStack, registerCardStackRef, draggedCardStack, handleMouseDown } = useDrag();
    const isDragging = draggedCardStack === cardStack;
    useEffect(()=> {
        if (registerCardStackRef && cardStackRef.current) {
            registerCardStackRef(cardStack, cardStackRef.current);
        }
        return () => {
            registerCardStackRef(cardStack, null);
        }
    },[cardStack, registerCardStackRef])

    function mouseDown(event: React.MouseEvent<HTMLDivElement>) {
        if (cardStackRef.current) {
            handleMouseDown(event, cardStackRef.current, cardStack);
        }
    }

    const topCard = computeTopCard();
    if (cardStack.cards.length === 0) {
        return <></>;
    }

    function computeTopCard() {
        if (cardStack.type === "single") {
            return cardStack.cards[0];
        }
        const rank = cardStack.rank;
        return { suit: cardStack.type, rank: rank, value: 0, location: "table" } as PlayingCard;
    }

    const cursorStyle = (()=>{
        if (isDragging) {
            return "grabbing";
        }
        return "grab";
    })();

    const isOverlapped = overlappedCardStack === cardStack && overlappedCardStack !== draggedCardStack;
    const isMultiCard = cardStack.cards.length > 1;

    const style = { cursor: cursorStyle,boxShadow: isOverlapped ? "0px 0px 8px 2px white" : "none"}
    return (
        <div ref={cardStackRef} className="cardStack" style={style} onMouseDown={mouseDown}>
        { isMultiCard ? 
        cardStack.cards.map((card) => 
            <Card
            card={card}
            showBottom={false}
            key={card.suit+card.rank}
            />) : null 
        }
        <Card
            card={topCard}
            showBottom={true}
        />
        </div>
    ); 
}

function Table({cardStacks}: {cardStacks: Array<CardStack>}) {
    const tableRef = useRef<HTMLDivElement|null>(null);
    const { isTableOverlapped, registerTableRef } = useDrag();
    useEffect(() => {
        registerTableRef(tableRef.current);
        return () => registerTableRef(null);
    }, [registerTableRef]);

    const tableStyle = {
        border: isTableOverlapped ? "2px dashed yellow" : "2px solid darkgreen"
    };
    return (
        <div className="table-container">
        <TableControls/>
        <div className="table" style={tableStyle} ref={tableRef}>
        { cardStacks.map((stack,i) => <CardStack key={i} cardStack={stack} />) }
        </div>
        </div>
    );
}

function TableControls() {
    const { tableHistory, undoTableHistory, resetTableHistory } = useGameState();

    const display = { display: tableHistory.length > 1 ? "flex" : "none" };
    return (
        <div className="tableControls" style={display}>
        <button onClick={undoTableHistory}>&#x238C;</button>
        <button onClick={resetTableHistory}>&#10006;</button>
        </div>
    );
}

//function makeCardStack(cards: Array<PlayingCard>): CardStack {
//    return { cards: cards };
//}
function MovePromptModal()  {
    const { getPossibleMoves } = useGameState();
    const { showMovePrompt, closeModal, draggedCardStack, overlappedCardStack, isTableOverlapped } = useDrag();
    const moves = getPossibleMoves(draggedCardStack, overlappedCardStack, isTableOverlapped);
    function clickHandler(move: Move) {
        return ()=>{
            move.handler();
            closeModal();
        }
    }
    return (
            <div className="playModal" style={{ display: showMovePrompt ? "flex" : "none" }}>
                { moves.map(move => <button onClick={clickHandler(move)} key={move.type}>{move.title}</button>) }
                <button onClick={closeModal} >Close</button>
            </div>
    );
}

function Hand({hand, isPlayersTurn}: {hand: Array<PlayingCard>, isPlayersTurn: boolean}) {
    return (
        <div className="playerHand" style={{border:isPlayersTurn? "2px solid grey" : "none"}} >
        { hand.map((card,i) => <CardStack key={i} cardStack={{cards:[card], type:"single", rank: card.rank}} />) }
        </div>
    );
}

function Pile({pile}: {pile: Array<PlayingCard>}) {
    const [showScrollingContainer, setShowScrollingContainer] = useState<boolean>(false);
    function scrollingContainer() {
        return (
            <div className="scrollingContainer" >
                {pile.map((card) => {
                    /* this is probably not great but whatever */
                    return <Card key={"pile"+card.suit+card.rank}card={card} className="small" showBottom={true}></Card>;
                })}
            </div>
        );
    }
    
    //const cursorStyle = { cursor: showScrollingContainer ? "zoom-out" : "zoom-in" }
    return (
        <div className="playerPile" onClick={()=> {setShowScrollingContainer((prev)=>!prev)}} >
        { pile.length > 0 && <Card card={pile[pile.length-1]} showBottom={true} /> }
        { showScrollingContainer && scrollingContainer() }
        </div>
    );
}

//const mockCards: PlayingCard[] = [
//  { suit: 'hearts', rank: '5', value: 1, location: 'pile' },
//  { suit: 'spades', rank: 'K', value: 1, location: 'pile' },
//  { suit: 'clubs', rank: 'A', value: 1, location: 'pile' },
//  { suit: 'diamonds', rank: '9', value: 1, location: 'pile' },
//  { suit: 'hearts', rank: 'Q', value: 1, location: 'pile' },
//  { suit: 'spades', rank: '3', value: 1, location: 'pile' },
//  { suit: 'clubs', rank: '10', value: 1, location: 'pile' },
//  { suit: 'diamonds', rank: '6', value: 1, location: 'pile' },
//  { suit: 'hearts', rank: '2', value: 1, location: 'pile' },
//  { suit: 'clubs', rank: 'J', value: 1, location: 'pile' },
//  { suit: 'spades', rank: '7', value: 1, location: 'pile' },
//  { suit: 'diamonds', rank: 'A', value: 1, location: 'pile' }
//];
export default PlayingField;
