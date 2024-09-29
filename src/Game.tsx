import "./Game.css";
import { useState } from "react";
import Card from "./Card.tsx";
const suits = ["spades", "clubs", "hearts", "diamonds"];
const ranks = ["A","J","K","Q","2","3","4","5","6","7","8","9","10"];

interface Card {
    suit: string;
    rank: string;
    value: number;
}

interface Player {
    id: number;
    hand: Array<Card>;
    pile: Array<Card>;
    points: number;
}

const playerOne: Player = {
    id: 1,
    hand: [],
    pile: [],
    points: 0,
};

function makeAllPlayers() {
    const allPlayers = [playerOne];
    for (let i = 2; i <= 6; i++) {
        allPlayers.push({ id: i, hand: [], pile: [], points: 0});
    }
    return allPlayers;
}

function makeDeck(): Array<Card> {
    const deck: Array<Card> = [];
    for (let i = 0; i < suits.length; i++) {
        const suit = suits[i];
        for (let j = 0; j < ranks.length; j++) {
            const rank = ranks[j];
            deck.push({ suit: suit, rank: rank, value: getValue(suit, rank) });
        }
    }
    return deck;
}

function getValue(suit: string, rank: string) {
    if (suit == "spades" && rank == "2") {
        return 2;
    }

    if (suit == "diamonds" && rank == "10") {
        return 3;
    }

    if (rank == "A") {
        return 1;
    }

    return 0;
}

function passToPlayers(
    players: Array<Player>,
    deck: Array<Card>,
    nCards: number,
) {
    for (let i = 0; i < nCards; i++) {
        const j = i % players.length;
        const card = deck.pop();
        if (card) {
            players[j].hand.push(card);
        }
    }
}

function passToTable(
    currentTable: Array<Card>,
    deck: Array<Card>,
    nCards: number,
) {
    while (nCards > 0) {
        const card = deck.pop();
        if (card) {
            currentTable.push(card);
        }
        nCards--;
    }
}

function deal(
    deck: Array<Card>,
    players: Array<Player>,
    currentTable: Array<Card>,
) {
    console.log("dealing");
    let totalCards = 0;
    const cardPerPerson = Math.floor(deck.length / players.length);
    if (cardPerPerson >= 3) {
        totalCards = 3 * players.length;
        passToPlayers(players, deck, totalCards);
        passToTable(currentTable, deck, 3);
    } else {
        totalCards = cardPerPerson * players.length;
        passToPlayers(players, deck, totalCards);
        passToTable(currentTable, deck, deck.length);
    }
}

function createCardComponent(card: Card) {
    return <Card rank={card.rank} suit={card.suit} draggable={false} />
}

function createPlayerComponents(players: Array<Player>, currentMove: number) {
    return players.map((player, index)=> {
        const style = { fontWeight: index === currentMove % players.length ? "bold": "normal"};
        return (
            <span key={index} style={style}> {player.id} </span>
        );
    });
}

const MAX_POINTS = 25;
let i = 0;
const allPlayers = makeAllPlayers();
let currentTable: Array<Card>  = [];
function Game() {
    const [allPlayers, setAllPlayers] = useState<Array<Player>>([]);
    const [currentTable, setTable] = useState<Array<Card>>([]);
    const [currentMove, setCurrentMove] = useState<number>(0);
    const [currentDeck, setCurrentDeck] = useState<Array<Card>>([]);
    const [selectedCards, setSelectedCards] = useState<Array<Card>>([]);
    const [selectingCards, setSelectingCards] = useState<boolean>(false);


    function startMatch() {
        const newPlayers = makeAllPlayers();
        const deck = makeDeck();
        deal(deck, newPlayers, currentTable);
        setAllPlayers([...newPlayers]);
        setTable([...currentTable]);
        setCurrentDeck([...deck]);
    }

    function createCardComponents(cards: Array<Card>) {
        return cards.map((card) => { 
                const style = selectingCards ? { cursor: "pointer" } : {};
                const handleSelect = () => {
                    setSelectedCards([...selectedCards, card]);
                }
                return (
                    <div style={style} key={card.suit+card.rank} onClick={selectingCards ? handleSelect : undefined}> { createCardComponent(card) } </div>
                );
            });
    }

    const winner = allPlayers.find(player => player.points >= MAX_POINTS);
    let status;
    if (winner) {
        status = `WINNER: ${winner.id}`;
    } else {
        if (allPlayers.length === 0) {
            status = "Waiting for game to start :)";
        } else {
            const i = currentMove % allPlayers.length;
            status = `It is player ${i+1}'s turn`;
        }
    }

    const currentHand = allPlayers.length > 0 ? allPlayers[currentMove%allPlayers.length].hand : [];
    const selectedCardsContainer = <div className="selectedCards"> { createCardComponents(selectedCards) } </div>;
    return (
        <div className="board">
            <div style={{alignSelf: "center"}}>
                <h3 style={{color: "pink"}}> {status} </h3>
                <div> { createPlayerComponents(allPlayers, currentMove) } </div>
            </div>
            <div className="field"> { createCardComponents(currentTable) }</div>
            <div className="playerHand"> { createCardComponents(currentHand) }</div>
            <div>
                <button onClick={startMatch}>Start Match</button>
                <button onClick={()=> { setCurrentMove(currentMove+1) }}>Next Move</button>
                { allPlayers.length > 0 ? <button onClick={()=> { setSelectingCards(!selectingCards) }}>Select Cards to Pile</button> : null }
                { selectingCards ? <div> Selecting </div> : null }
                { selectingCards ? selectedCardsContainer : null }
           </div> 
        </div>
    );
}

function allHandsEmpty(allPlayers: Array<Player>): boolean {
    for (const player of allPlayers) {
        if (player.hand.length > 0) return false;
    }
    return true;
}

async function delay(ms: number) {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}

export default Game;
