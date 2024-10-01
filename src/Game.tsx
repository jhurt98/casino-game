import "./Game.css";
import { useState } from "react";
import Card from "./Card.tsx";
const suits = ["spades", "clubs", "hearts", "diamonds"];
// i dont want prettier to put these on new line
const ranks = [
    "A",
    "J",
    "K",
    "Q",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
];

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
        allPlayers.push({ id: i, hand: [], pile: [], points: 0 });
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
    return <Card rank={card.rank} suit={card.suit} draggable={false} />;
}

function createPlayerComponents(players: Array<Player>, currentMove: number) {
    return players.map((player, index) => {
        const style = {
            fontWeight:
                index === currentMove % players.length ? "bold" : "normal",
        };
        return (
            <span key={index} style={style}>
                {" "}
                {player.id}{" "}
            </span>
        );
    });
}

const MAX_POINTS = 25;
function Game() {
    const [allPlayers, setAllPlayers] = useState<Array<Player>>([]);
    const [currentTable, setTable] = useState<Array<Card>>([]);
    const [currentMove, setCurrentMove] = useState<number>(0);
    const [currentDeck, setCurrentDeck] = useState<Array<Card>>([]);
    const [selectedCards, setSelectedCards] = useState<Array<Card>>([]);
    const [selectingPileCards, setSelectingPileCards] =
        useState<boolean>(false);
    const [selectingThrowCards, setSelectingThrowCards] =
        useState<boolean>(false);

    const n = allPlayers.length;
    const currentPlayer = allPlayers[currentMove % n];

    function startMatch() {
        const newPlayers = makeAllPlayers();
        const deck = makeDeck();
        deal(deck, newPlayers, currentTable);
        setAllPlayers([...newPlayers]);
        setTable([...currentTable]);
        setCurrentDeck([...deck]);
    }

    function endRound() {
        let mostCardsPlayer: Player = allPlayers[0];
        let mostSpadesPlayer: Player = allPlayers[0];
        for (const player of allPlayers) {
            if (mostCardsPlayer.pile.length < player.pile.length) {
                mostCardsPlayer = player;
            }
            if (
                getSpadesCount(mostSpadesPlayer.pile) <
                getSpadesCount(player.pile)
            ) {
                mostSpadesPlayer = player;
            }
            let pts = 0;
            for (const card of player.pile) {
                pts += card.value;
            }
            player.points += pts;
        }
        mostCardsPlayer.points++;
        mostSpadesPlayer.points++;
        console.log(mostCardsPlayer, mostSpadesPlayer);
        setAllPlayers([...allPlayers]);
    }

    function getSpadesCount(pile: Array<Card>): number {
        let count = 0;
        for (const card of pile) {
            if (card.suit === "spades") count++;
        }
        return count;
    }

    function createCardComponents(cards: Array<Card>, selectable: boolean) {
        return cards.map((card) => {
            const style = selectable ? { cursor: "pointer" } : {};
            const handleSelect = () => {
                if (selectedCards.includes(card)) return;
                setSelectedCards([...selectedCards, card]);
            };
            return (
                <div
                    style={style}
                    key={card.suit + card.rank}
                    onClick={selectable ? handleSelect : undefined}
                >
                    {" "}
                    {createCardComponent(card)}{" "}
                </div>
            );
        });
    }

    function handleAddToPile() {
        const table = currentTable;
        for (const card of selectedCards) {
            let i = table.findIndex((c) => card === c);
            if (i !== -1) {
                table.splice(i, 1);
            }

            i = currentPlayer.hand.findIndex((c) => card === c);
            if (i !== -1) {
                currentPlayer.hand.splice(i, 1);
            }
            currentPlayer.pile.push(card);
        }
        setSelectedCards([]);
        setAllPlayers([...allPlayers]);
        setTable([...table]);
        setSelectingPileCards(false);
    }

    function handleThrowCards() {
        const table = currentTable;
        for (const card of selectedCards) {
            const i = currentPlayer.hand.findIndex((c) => card === c);
            if (i !== -1) {
                currentPlayer.hand.splice(i, 1);
            }
            table.push(card);
        }
        setTable([...table]);
        setSelectedCards([]);
        setSelectingThrowCards(false);
    }

    const winner = allPlayers.find((player) => player.points >= MAX_POINTS);
    let status;
    if (winner) {
        status = `WINNER: ${winner.id}`;
    } else {
        if (allPlayers.length === 0) {
            status = "Waiting for game to start :)";
        } else {
            const i = currentMove % allPlayers.length;
            status = `It is player ${i + 1}'s turn`;
        }
    }

    const currentHand = currentPlayer ? currentPlayer.hand : [];
    const currentPile = currentPlayer ? currentPlayer.pile : [];
    const selectingCards = selectingPileCards || selectingThrowCards;
    const selectedCardsContainer = (
        <div style={{ display: "flex" }}>
            {createCardComponents(selectedCards, false)}
        </div>
    );
    const endOfRound = currentPlayer && allHandsEmpty(allPlayers);
    console.log(allPlayers);
    return (
        <div className="board">
            <div style={{ alignSelf: "center", minHeight: "90px" }}>
                <h3 style={{ color: "pink" }}> {status} </h3>
                <div> {createPlayerComponents(allPlayers, currentMove)} </div>
            </div>
            <div className="field">
                {" "}
                {createCardComponents(currentTable, selectingPileCards)}
            </div>
            <div style={{ display: "flex" }}>
                <div className="playerHand">
                    {" "}
                    {createCardComponents(currentHand, selectingCards)}
                </div>
                <div className="playerPile">
                    {" "}
                    {createCardComponents(currentPile, false)}
                </div>
            </div>
            <div>
            {/*this whole div is some nonsense, just for testing function*/}
                <button onClick={startMatch}>Start Match</button>
                <button
                    onClick={() => {
                        setCurrentMove(currentMove + 1);
                    }}
                >
                    Next Move
                </button>
                {currentPlayer ? (
                    <button
                        onClick={() => {
                            setSelectingPileCards(!selectingPileCards);
                        }}
                    >
                        Select Cards to Pile
                    </button>
                ) : null}
                {currentPlayer ? (
                    <button
                        onClick={() => {
                            setSelectingThrowCards(!selectingThrowCards);
                        }}
                    >
                        Select Cards to Throw
                    </button>
                ) : null}
                {selectingCards ? <div> Selecting </div> : null}
                {selectingCards ? selectedCardsContainer : null}
                {selectingCards && selectedCards.length > 0 ? (
                    <button
                        onClick={
                            selectingThrowCards
                                ? handleThrowCards
                                : handleAddToPile
                        }
                    >
                        {selectingThrowCards ? "Throw to Field" : "Add to pile"}
                    </button>
                ) : null}
                {endOfRound ? (
                    <button onClick={endRound}>
                        End Round, Calculate Points
                    </button>
                ) : null}
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
