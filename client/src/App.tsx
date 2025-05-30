import "./App.css";
import Game from "./Game.tsx";
import { GameStateContextProvider } from "./GameStateContext.tsx";

function App() {
    return (
        <GameStateContextProvider>
            <Game/>
        </GameStateContextProvider>
    );
}

export default App;
