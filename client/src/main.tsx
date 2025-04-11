import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

function logCords(e) {
    console.log("coords", e.clientX, e.clientY);
}

document.addEventListener("mousedown", logCords);
createRoot(document.getElementById("root")!).render(<App />);
