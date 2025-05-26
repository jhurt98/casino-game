import type { CardStack } from "../types.ts";

export function detectTable(draggedCard: HTMLDivElement, table: HTMLDivElement) {
    const cardRect = draggedCard.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    return elementsAreOverlapping(tableRect, cardRect);
}

/** state, don't need to call setState when the overlappedCard hasn't changed. we can still check every 16ms, is calling setState updating state on each event
*  call? is it smart enough to limit for changes only? Or can i tell it to do that somehow? */
export function detectOverlappedCardStack(draggedCard: HTMLDivElement, allCardStacks: Map<CardStack, HTMLDivElement>) {
    const resultCard = findDominantOverlappingCardStack(draggedCard, allCardStacks);
    return resultCard;
}

function findDominantOverlappingCardStack(draggedCard: HTMLDivElement,allCardStacks: Map<CardStack, HTMLDivElement>) {
    const overlappingCardStacks = getOverlappingTableCardStacks(draggedCard, allCardStacks);
    return dominantCardStack(overlappingCardStacks, draggedCard.getBoundingClientRect(), allCardStacks);
}

/* think about why you need to check .current is null in each function. do we want them to know the value of draggedCardRef know it won't be null?*/
function getOverlappingTableCardStacks(draggedCard: HTMLDivElement, allCardStacks: Map<CardStack, HTMLDivElement>) {
    const overlappingCards = [];
    for (const [cardStack, cardDiv] of allCardStacks) {
        // this isn't exactly accurate anymore because a draggedCard div is
        // a card and cardDiv is a cardStack soooooo??? use the child??? that's fine
        if (cardDiv === draggedCard || cardStack.cards.length === 0 || cardDiv.children[0] === draggedCard) {
            continue;
        }
        const tableCardRect = cardDiv.getBoundingClientRect();
        const draggedCardRect = draggedCard.getBoundingClientRect();
        if (elementsAreOverlapping(tableCardRect, draggedCardRect)) {
            overlappingCards.push(cardStack);
        }
    }
    return overlappingCards;
}

function elementsAreOverlapping(target: DOMRect, source: DOMRect) {
    const [x1, y1, width1, height1] = [source.x, source.y, source.width, source.height];
    const [x2, y2, width2, height2] = [target.x, target.y, target.width, target.height];
    return !(x1 > x2 + width2 || x1 + width1 < x2 || y1 > y2 + height2 || y1 + height1 < y2);
}

function getOverlappedArea(target: DOMRect, source: DOMRect) {
    let width, height;
    if (source.x >= target.x) {
        width = target.width - (source.x - target.x);
    } else {
        width = source.x + source.width - target.x;
    }
    if (source.y >= target.y) {
        height = target.height - (source.y - target.y);
    } else {
        height = source.y + source.height - target.y;
    }
    return width * height;
}

function dominantCardStack(targets: Array<CardStack>, source: DOMRect, allCardStacks: Map<CardStack, HTMLDivElement>) {
    if (targets.length === 0) {
        return null;
    }
    let resultCard = targets[0];
    let maxArea = 0;
    for (const target of targets) {
        const div = allCardStacks.get(target);
        if (div === undefined) continue;
        const area = getOverlappedArea(div.getBoundingClientRect(), source);
        if (area > maxArea) {
            resultCard = target;
            maxArea = area;
        }
    }
    return resultCard;
}
