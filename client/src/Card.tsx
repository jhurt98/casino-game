import { useRef } from "react";
import type {PlayingCard} from "./types.ts";

interface CardProps {
    card: PlayingCard;
    showBottom: boolean,
    className?: string,
}

function Card({card, showBottom, className }: CardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    function getIcon(suit: string) {
        switch (suit) {
            case "clubs":
                return <p>&clubs;</p>;
            case "spades":
                return <p>&spades;</p>;
            case "hearts":
                return <p>&hearts;</p>;
            case "diamonds":
                return <p>&diams;</p>;
            case "sum":
                return <p>&#43;</p>;
            case "dup":
                return <p>&#9921;</p>;
            default:
                return "?";
        }
    }

    function getColor(suit: string) {
        switch (suit) {
            case "clubs":
                return "black";
            case "spades":
                return "black";
            case "hearts":
                return "red";
            case "diamonds":
                return "red";
            case "sum":
                return "limegreen";
            case "dup":
                return "limegreen";
            default:
                return "black";
        }
    }

    const icon = getIcon(card.suit);
    const color = { color: getColor(card.suit) };
    //const cardId = `${card.suit}-${card.rank}`;
    //console.log("isdragging", isDragging, "isOverlapped", isOverlapped);
    return (
        <div
        className={className?className:"playingCard"}
        ref={cardRef}
        data-suit={card.suit}
        data-rank={card.rank}
        >
        <div className="content" style={color}>
        <p>{card.rank}</p>
        {icon}
        </div>
        { showBottom ?
        <div className="content bottom" style={color}>
        <p>{card.rank}</p>
        {icon}
        </div>
        : null}
        </div>
    );
}
export default Card;
