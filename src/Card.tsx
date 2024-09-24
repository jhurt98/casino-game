import { useState, useRef } from "react";
function Card() {
    const [pos, setPos] = useState(undefined);
    const [drag, setDrag] = useState({x: 0, y: 0});
    const [dragging, setDragging] = useState(false);
    const test = useRef(null);
    function gpt() {
        return( 
               <div>
<svg width="400" height="700" xmlns="http://www.w3.org/2000/svg">
    {/**-- Card Template --*/}
  <defs>
    <rect id="card" width="60" height="90" rx="10" ry="10" fill="white" stroke="black" /> <symbol id="heart" viewBox="0 0 32 29.6">
      <path d="M23.6,0c-3.2,0-6.1,1.2-8.6,3.2C12.5,1.2,9.6,0,6.4,0C2.9,0,0,2.9,0,6.4c0,7.3,11.2,12.3,16,19.2c4.8-6.9,16-11.9,16-19.2 C32,2.9,29.1,0,25.6,0C24.8,0,24.1,0.2,23.6,0z" fill="red"/>
    </symbol>
    <symbol id="diamond" viewBox="0 0 32 32">
      <path d="M16,0L0,16l16,16l16-16L16,0z" fill="red"/>
    </symbol>
    <symbol id="club" viewBox="0 0 32 32">
      <path d="M16 22c-5 0-8-4-8-8 0-3 2-5 5-5 1 0 2-.3 3-1 1 1 2 1 3 1 3 0 5 2 5 5 0 4-3 8-8 8z" fill="black"/>
      <circle cx="12" cy="14" r="5" fill="black"/>
      <circle cx="20" cy="14" r="5" fill="black"/>
      <ellipse cx="16" cy="22" rx="4" ry="2" fill="black"/>
    </symbol>
    <symbol id="spade" viewBox="0 0 32 32">
      <path d="M16,0c-3.3,0-6,2.7-6,6c0,2.2,1.3,4.1,3.2,5C9.8,11.5,8,13.7,8,16c0,5.5,8,12,8,12s8-6.5,8-12 c0-2.3-1.8-4.5-5.2-5.1C20.7,10.1,22,8.2,22,6C22,4.7,21.3,3.5,20.5,3c-1.6-2-4-3-6.5-3C16.3,0,16,0,16,0 S16.1,0,16,0z" fill="black"/>
    </symbol>
  </defs>

  {/**-- Hearts --*/}
  <g transform="translate(10, 10)">
    <use href="#card" />
    <use href="#heart" x="15" y="10" width="20" height="20"/>
  </g>
  
  {/**-- Diamonds --*/}
  <g transform="translate(80, 10)">
    <use href="#card" />
    <use href="#diamond" x="15" y="10" width="20" height="20"/>
  </g>

  {/**-- Clubs --*/}
  <g transform="translate(150, 10)">
    <use href="#card" />
    <use href="#club" x="15" y="10" width="20" height="20"/>
  </g>

  {/**-- Spades --*/}
  <g transform="translate(220, 10)">
    <use href="#card" />
    <use href="#spade" x="15" y="10" width="20" height="20"/>
  </g>

  //-- Additional cards can be created similarly --
</svg>
</div>)
    }

    function handleMouseDown(e: React.MouseEvent) {
        e.preventDefault();
        drag.x = e.clientX;
        drag.y = e.clientY;
        console.log(e.target.getBoundingClientRect());
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
            let newTop = `${test.current.offsetTop - yDiff}px`;
            let newLeft = `${test.current.offsetLeft - xDiff}px`;
            let newPos = { top: newTop, left: newLeft };
            setPos(newPos);
        }
    }
    let dynamicStyle = pos === undefined ? {} : { top: pos.top, left: pos.left };
  return (
    <>
    {/*gpt()*/}
    <div className="playingCard"
         onMouseDown={handleMouseDown} 
         onMouseMove={dragging ? handleMouseMove : undefined } 
         onMouseUp={() => setDragging(false)} ref={test}
         style={dynamicStyle}
    >
      <div className="content">
        <p>4</p>
        <svg
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          fillRule="evenodd"
          clipRule="evenodd"
        >
          <path
            d="m12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402m5.726-20.583c-2.203 0-4.446 1.042-5.726 3.238-1.285-2.206-3.522-3.248-5.719-3.248-3.183 0-6.281 2.187-6.281 6.191 0 4.661 5.571 9.429 12 15.809 6.43-6.38 12-11.148 12-15.809 0-4.011-3.095-6.181-6.274-6.181"
          />
        </svg>
      </div>

      <div className={"bottom content"}>
        <p>4</p>
        <svg
          width="24"
          height="24"
          xmlns="http://www.w3.org/2000/svg"
          fillRule="evenodd"
          clipRule="evenodd"
        >
          <path
            d="m12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402m5.726-20.583c-2.203 0-4.446 1.042-5.726 3.238-1.285-2.206-3.522-3.248-5.719-3.248-3.183 0-6.281 2.187-6.281 6.191 0 4.661 5.571 9.429 12 15.809 6.43-6.38 12-11.148 12-15.809 0-4.011-3.095-6.181-6.274-6.181"
          />
        </svg>
      </div>
    </div>  
    </>
  )
}

export default Card 
