export interface PlayingCard {
    suit: string;
    rank: string;
    value: number;
    location: string;
}

export interface CardStack {
    cards: Array<PlayingCard>;
    type: string;
}

export interface GameState {
    deckLen: number;
    table: Array<CardStack>;
    players: Array<Player>;
    turn: Turn;
    phase: number;
}

export interface Turn {
    turnCount: number;
    currentPlayerId: string;
}

export interface Player {
    id: string;
    hand: Array<PlayingCard>;
    pile: Array<PlayingCard>;
    points: number;
}

export function calculateCardStackRank(cardStack: CardStack): string {
    if (cardStack.type === "single") {
        return cardStack.cards[0].rank;
    }
    if (cardStack.type === "sum") {
        const rankValuesAsNumbers = cardStack.cards.map(card => Number(card.rank));
        const sum = rankValuesAsNumbers.reduce((prev, curr) => prev+ curr);
        return sum.toString();
    }
    return cardStack.cards[cardStack.cards.length-1].rank;
}
