export interface PlayingCard {
    suit: string;
    rank: string;
    value: number;
    location: string;
}

export interface CardStack {
    cards: Array<PlayingCard>;
    type: string;
    rank: string;
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
    name: string;
    connected: boolean;
}
