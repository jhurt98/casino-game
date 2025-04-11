import { useRef } from "react";
import type {PlayingCard} from "./Game.tsx";

interface CardProps {
    card: PlayingCard;
    handleMouseDown: (e: MouseEvent, cardRef: HTMLDivElement | null) => void;
}

function Card( {
    card,
    handleMouseDown
}: CardProps) {

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
            default:
                return "black";
        }
    }

        const icon = getIcon(card.suit);
        const color = { color: getColor(card.suit) };
        //const cardId = `${card.suit}-${card.rank}`;
        return (
            <div
                className="playingCard"
                onMouseDown={(e: MouseEvent)=> handleMouseDown(e,cardRef.current)}
                ref={cardRef}
                style={{
                    position: "relative",
                }}
            >
                <div className="content" style={color}>
                    <p>{card.rank}</p>
                    {icon}
                </div>
                <div className="content bottom" style={color}>
                    <p>{card.rank}</p>
                    {icon}
                </div>
            </div>
        );
}
export default Card;
