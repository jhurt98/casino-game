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

function makePlayers() {
    const players = [playerOne];
    for (let i = 2; i <= 4; i++) {
        players.push({ id: i, hand: [], pile: [], points: 0 });
    }
    return players;
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
    table: Array<Card>,
    deck: Array<Card>,
    nCards: number,
) {
    for (let i = 0; i < nCards; i++) {
        const card = deck.pop();
        if (card) {
            table.push(card);
        }
    }
}

function deal(
    deck: Array<Card>,
    players: Array<Player>,
    table: Array<Card>,
) {
    let totalCards = 3*players.length;
    passToPlayers(players, deck, totalCards);
    if (deck.length < 3*players.length) {
        totalCards = Math.floor(deck.length / players.length) * players.length;
        passToPlayers(players, deck, totalCards);
        passToTable(table, deck, deck.length);
    }
    
}

function initRound(
    deck: Array<Card>,
    players: Array<Player>,
    table: Array<Card>,
) {
    passToTable(table, deck, 3);
    passToPlayers(players, deck, 3 * players.length);
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
    const [players, setPlayers] = useState<Array<Player>>([]);
    const [table, setTable] = useState<Array<Card>>([]);
    const [currentMove, setCurrentMove] = useState<number>(0);
    const [deck, setDeck] = useState<Array<Card>>([]);
    const [selectedCards, setSelectedCards] = useState<Array<Card>>([]);
    const [selectingPileCards, setSelectingPileCards] =
        useState<boolean>(false);
    const [selectingThrowCards, setSelectingThrowCards] =
        useState<boolean>(false);

    const n = players.length;
    const currentPlayer = players[currentMove % n];

    function startMatch() {
        const newPlayers = makePlayers();
        const deck = makeDeck();
        initRound(deck, newPlayers, table);
        setPlayers([...newPlayers]);
        setTable([...table]);
        setDeck([...deck]);
    }

    function endMatch() {
        setPlayers([]);
        setTable([]);
        setDeck([]);
    }

    function endRound() {
        let mostCardsPlayer: Player = players[0];
        let mostSpadesPlayer: Player = players[0];
        for (const player of players) {
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
        setPlayers([...players]);
    }
    
    function getSpadesCount(pile: Array<Card>): number {
        let count = 0;
        for (const card of pile) {
            if (card.suit === "spades") count++;
        }
        return count;
    }

    function createCardComponents(cards: Array<Card>, selectable: boolean) {
        console.log("cards", cards);
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
        const newTable = [...table];
        for (const card of selectedCards) {
            let i = table.findIndex((c) => card === c);
            if (i !== -1) {
                newTable.splice(i, 1);
            }

            i = currentPlayer.hand.findIndex((c) => card === c);
            if (i !== -1) {
                currentPlayer.hand.splice(i, 1);
            }
            currentPlayer.pile.push(card);
        }
        setSelectedCards([]);
        setPlayers([...players]);
        setTable(newTable);
        setSelectingPileCards(false);
    }

    function handleThrowCards() {
        const newtable = [...table];
        for (const card of selectedCards) {
            const i = currentPlayer.hand.findIndex((c) => card === c);
            if (i !== -1) {
                currentPlayer.hand.splice(i, 1);
            }
            newtable.push(card);
        }
        setTable([...table]);
        setSelectedCards([]);
        setSelectingThrowCards(false);
    }

    function handleDeal() {
        deal(deck, players, table);
        setDeck([...deck]);
        setPlayers([...players]);
        setTable([...table]);
    }

    const winner = players.find((player) => player.points >= MAX_POINTS);
    let status;
    if (winner) {
        status = `WINNER: ${winner.id}`;
    } else {
        if (players.length === 0) {
            status = "Waiting for game to start :)";
        } else {
            const i = currentMove % players.length;
            status = `It is player ${i + 1}'s turn`;
        }
    }

    console.log("currentPlayer", currentPlayer);
    const currentHand = currentPlayer ? currentPlayer.hand : [];
    const currentPile = currentPlayer ? currentPlayer.pile : [];
    const selectingCards = selectingPileCards || selectingThrowCards;
    const selectedCardsContainer = (
        <div style={{ display: "flex" }}>
            {createCardComponents(selectedCards, false)}
        </div>
    );

    return (
        <div style={{display:"flex", flexGrow:1, justifyContent: "spaceBetween"}}>
        <div className="board">
            <div style={{ alignSelf: "center", minHeight: "90px" }}>
                <h3 style={{ color: "pink" }}>{status}</h3>
                <div>{createPlayerComponents(players, currentMove)}</div>
            </div>
            <div className="table">
                {createCardComponents(table, selectingPileCards)}
            </div>
            <div style={{ display: "flex" }}>
                <div className="playerHand">
                    {createCardComponents(currentHand, selectingCards)}
                </div>
                <div className="playerPile">
                    {createCardComponents(currentPile, false)}
                </div>
            </div>
            <div style={{minHeight: "97.6px"}}>
            {selectingCards ? <div> Selecting </div> : null}
            {selectingCards ? selectedCardsContainer : null}
            </div>
            <div>
            {/*this whole div is some nonsense, just for testing function*/}
                <button onClick={currentPlayer ? endMatch : startMatch}>{currentPlayer ? "End Match" : "Start Match"}</button>
                { currentPlayer ? <button onClick={handleDeal}>Deal</button> : null }
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
            </div>
        </div>
        <PointsTable players={players}/>
        </div>
    );
}

function allHandsEmpty(players: Array<Player>): boolean {
    for (const player of players) {
        if (player.hand.length > 0) return false;
    }
    return true;
}

async function delay(ms: number) {
    return new Promise((res) => {
        setTimeout(res, ms);
    });
}

function PointsTable({players}) {
    return (
        <ul> { players.map(player => <li>{player.id} {player.points} </li>) }  </ul>
    );
}

export default Game;
