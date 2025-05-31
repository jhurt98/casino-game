import { CardStack, PlayingCard } from "../types.ts";
import { MoveType } from "../useGameStateWithWebSocket.ts";
    /*
        * return array of possible move types. read in onMouseUp: if not empty, showModal with movetypes
    * player HAS to see the sum on the table they can take, then drag table cards, and take with hand card
    * -- show all that at once to the opponents
    * -- show that the player made a stack, then show when the player takes it.
    * are undos even allowed?
    * for now no, so let's just make it so that when you stack, it prompts the player to take the cards...
    * distinguish this stack and take, from the stack you make for a "jugada" ie from hand to table */
export function determinePossibleMoves(hand: Array<PlayingCard>,draggedCardStack: CardStack, overlappedCardStack: CardStack | null, isTableOverlapped: boolean) {
    const from = draggedCardStack.cards[0].location;
    if (from === "hand") {
        return getPlayerMoveTypes(hand, draggedCardStack, overlappedCardStack, isTableOverlapped);
    } else {
        return getTableMoveTypes(draggedCardStack, overlappedCardStack);
    }
}

function getPlayerMoveTypes(hand: Array<PlayingCard>, draggedCardStack: CardStack, overlappedCardStack: CardStack | null, isTableOverlapped: boolean) {
    const possiblePlayerMoveTypes: Array<MoveType>= [];
    if (isTableOverlapped) {
        possiblePlayerMoveTypes.push(MoveType.Toss);
    }
    const to = overlappedCardStack?.cards.at(-1)?.location ?? null;
    if (overlappedCardStack === null || overlappedCardStack.cards.length === 0 || to !== "table") {
        return possiblePlayerMoveTypes;
    }
    if (cardAndStackHaveEqualRank(draggedCardStack, overlappedCardStack)) {
        possiblePlayerMoveTypes.push(MoveType.Take);
        if ((overlappedCardStack.type === "dup" || overlappedCardStack.type === "single") && handHasDuplicateMatch(draggedCardStack, overlappedCardStack, hand)) {
            possiblePlayerMoveTypes.push(MoveType.PlayerStackDup)
        }
    }
    if ((overlappedCardStack.type === "sum" || overlappedCardStack.type === "single") && handHasSumMatch(draggedCardStack, overlappedCardStack, hand)) {
        possiblePlayerMoveTypes.push(MoveType.PlayerStackSum);
    }
    return possiblePlayerMoveTypes;
}

function getTableMoveTypes(draggedCardStack: CardStack, overlappedCardStack: CardStack | null) {
    const possibleTableMoveTypes: Array<MoveType> = [];
    if (overlappedCardStack === null) {
        return possibleTableMoveTypes;
    }
    // the extra check is a bandaid cause the overlapped detector no longer ignores the card itself. see utils/collisionUtils.ts
    if (overlappedCardStack.type === "single" && overlappedCardStack === draggedCardStack) {
        return possibleTableMoveTypes;
    }
    const to = overlappedCardStack?.cards.at(-1)?.location ?? null;
    if (to !== "table") {
        return possibleTableMoveTypes;
    }
    const draggedCardStackRank = draggedCardStack.rank;
    const overlappedCardStackRank = overlappedCardStack.rank;
    if (draggedCardStackRank === overlappedCardStackRank) {
        possibleTableMoveTypes.push(MoveType.TableStackDup);
    }
    if (!isFaceRank(draggedCardStackRank) && !isFaceRank(overlappedCardStackRank)) {
        possibleTableMoveTypes.push(MoveType.TableStackSum);
    }
    return possibleTableMoveTypes;
}

function handHasDuplicateMatch(draggedCardStack: CardStack, cardStack: CardStack, hand: Array<PlayingCard>) {
    const draggedStackRank = draggedCardStack.rank;
    const overlappedStackRank = cardStack.rank;
    if (draggedStackRank !== overlappedStackRank) {
        return false
    }
    for (const card of hand) {
        // this isn't obvious but we want to skip if it's the same card we're dragging. which is only possible when dragging a player card
        // which will always have a single card in the stack
        if (card === draggedCardStack.cards[0]) continue;
        if (draggedStackRank === card.rank) {
            return true 
        }
    }
    return false 
}

function cardAndStackHaveEqualRank(source: CardStack, target: CardStack) {
    return source.rank === target.rank;
}

function handHasSumMatch(draggedCardStack: CardStack, cardStack: CardStack, hand: Array<PlayingCard>) {
    const draggedStackRank = draggedCardStack.rank;
    const stackRank = cardStack.rank; 
    const sum = getRankValue(draggedStackRank) + getRankValue(stackRank);
    if (Number.isNaN(sum)) {
        return false;
    }
    const sumString = String(sum);
    for (const card of hand) {
        if (card.rank === sumString) {
            return true;
        }
    }
    return false;
}

function isFaceRank(rank: string) {
    return rank === "Q" || rank === "K" || rank === "J";
}

export function getRankValue(rank: string): number {
    if (rank === "A") {
        return 1;
    }
    return Number(rank);
}
