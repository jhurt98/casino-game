import { useState, useRef } from "react";
function Card({ suit, rank, draggable }) {
    const [pos, setPos] = useState(undefined);
    const [drag, setDrag] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const test = useRef(null);

    function handleMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        drag.x = e.clientX;
        drag.y = e.clientY;
        setDragging(true);
    }

    function handleMouseMove(e: React.MouseEvent) {
        e.preventDefault();
        console.log(drag);
        const xDiff = drag.x - e.clientX;
        const yDiff = drag.y - e.clientY;
        drag.x = e.clientX;
        drag.y = e.clientY;
        console.log(drag, xDiff, yDiff);
        if (test && test.current) {
            const newTop = `${test.current.offsetTop - yDiff}px`;
            const newLeft = `${test.current.offsetLeft - xDiff}px`;
            const newPos = { top: newTop, left: newLeft };
            setPos(newPos);
        }
    }
    function getIcon(suit) {
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
    function getColor(suit) {
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
    const icon = getIcon(suit);
    const color = { color: getColor(suit) };
    const dynamicStyle =
        pos === undefined ? {} : { top: pos.top, left: pos.left };
    return (
        <div
            className="playingCard"
            onMouseDown={draggable ? handleMouseDown : undefined}
            onMouseMove={dragging ? handleMouseMove : undefined}
            onMouseUp={() => setDragging(false)}
            ref={test}
            style={dynamicStyle}
        >
            <div className="content" style={color}>
                <p>{rank}</p>
                {icon}
            </div>
            <div className="content bottom" style={color}>
                <p>{rank}</p>
                {icon}
            </div>
        </div>
    );
}
export default Card;
