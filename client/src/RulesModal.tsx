import { useState } from "react";
import "./RulesModal.css";

interface RulesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function RulesModal({ isOpen, onClose }: RulesModalProps) {
    const [activeTab, setActiveTab] = useState<"basics" | "rules">("basics");

    if (!isOpen) return null;

    return (
        <div className="rules-modal" onClick={onClose}>
            <div className="modal-wrapper">
                <button className="close-btn" onClick={onClose}>
                    &times;
                </button>
                <div className="rules-content" onClick={(e) => e.stopPropagation()}>
                    <div className="rules-header">
                        <h2>How to Play</h2>
                    </div>

                    <div className="rules-tabs">
                        <button className={`tab-btn ${activeTab === "basics" ? "active" : ""}`} onClick={() => setActiveTab("basics")}>
                            How to Play
                        </button>
                        <button className={`tab-btn ${activeTab === "rules" ? "active" : ""}`} onClick={() => setActiveTab("rules")}>
                            Rules
                        </button>
                    </div>

                    <div className="rules-body">
                        {activeTab === "basics" && (
                            <div className="tab-content">
                                <div className="rules-section">
                                    <h4>Basic Actions</h4>
                                    <ul>
                                        <li>Drag cards from your hand to make moves</li>
                                        <li>Take cards by dragging a hand card onto a matching table card/stack</li>
                                        <li>Create stacks by combining cards of the same rank or cards that sum together</li>
                                        <li>Toss cards to the table when you can't make any other moves</li>
                                    </ul>
                                </div>

                                <div className="rules-section">
                                    <h4>Each Turn:</h4>
                                    <h4>You must use a single card from your hand. You can:</h4>
                                    <ul>
                                        <li>
                                            <strong>Take matching cards</strong> - Drag a card from your hand onto table cards with the same
                                            rank
                                        </li>
                                        <li>
                                            <strong>Stack for later</strong> - Combine your card with table cards to create a stack you'll
                                            take later
                                        </li>
                                        <li>
                                            <strong>Toss</strong> - Put a card on the table if you can't do anything else
                                        </li>
                                        <li>
                                            <em>
                                                <strong>Table Setup</strong>
                                            </em>{" "}
                                            - Before you use your card, you can make as many setup plays with table cards as possible. Types
                                            of setup plays are explained in the rules tab.
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeTab === "rules" && (
                            <div className="tab-content">
                                <div className="rules-section">
                                    <h4>Game Setup</h4>
                                    <ul>
                                        <li>Each player starts with 3 cards</li>
                                        <li>3 cards are dealt to the table</li>
                                        <li>First to 25 points wins</li>
                                    </ul>
                                </div>

                                <div className="rules-section">
                                    <h4>Scoring</h4>
                                    <div className="scoring-grid">
                                        <div className="score-item">
                                            <span className="card-display">A</span>
                                            <span>1 point</span>
                                        </div>
                                        <div className="score-item">
                                            <span className="card-display spades">2♠</span>
                                            <span>2 points</span>
                                        </div>
                                        <div className="score-item">
                                            <span className="card-display diamonds">10♦</span>
                                            <span>3 points</span>
                                        </div>
                                        <div className="score-item">
                                            <span className="bonus">Most cards taken</span>
                                            <span>1 point</span>
                                        </div>
                                        <div className="score-item">
                                            <span className="bonus">Most spades taken</span>
                                            <span>1 point</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="rules-section">
                                    <h4>Stacking Rules</h4>
                                    <ul>
                                        <li>
                                            <strong>Duplicate Stacks:</strong> Cards with the same rank (three 7s, two Kings, etc.)
                                        </li>
                                        <li>
                                            <strong>Sum Stacks:</strong> Cards that add up to a number you have in your hand
                                        </li>
                                        <li>
                                            <em>Example: 3 + 4 = 7, and you have a 7 in your hand</em>
                                        </li>
                                        <li>
                                            <strong>Important:</strong> You can only create stacks if you have the matching card in your
                                            hand to eventually take them.
                                        </li>
                                        <li>You can make any stacks with table cards.</li>
                                    </ul>
                                </div>

                                <div className="rules-section">
                                    <h4>Round Flow</h4>
                                    <ul>
                                        <li>When everyone runs out of cards, the dealer deals 3 more cards to each player</li>
                                        <li>When the deck runs out, the round ends</li>
                                        <li>First player to 25 points wins the game</li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default RulesModal;
