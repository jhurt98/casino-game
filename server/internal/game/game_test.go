package game_test

import (
    "testing"
    "game-server/internal/game"
    "crypto/rand"
    "encoding/base64"
    "encoding/json"
)

/*
things to test: 
1. game start state: pass appropriately to players, table
2. single loop,
3. single round,
  - points counted
  - deck reset, cards passed again
4. complete game
*/
func TestAddPlayer(t *testing.T) {
    gameEngine := game.NewEngine()
    playerId := generatePlayerId()
    gameEngine.AddPlayer(playerId)
    expectedPlayerLen := 1
    got :=  len(gameEngine.State.Players)
    if expectedPlayerLen != got { 
        t.Errorf("calling Engine.AddPlayer() did not add a player to game state slice\n")
    }
    if gameEngine.State.Players[0].Id != playerId {
        t.Errorf("calling Engine.AddPlayer() added an inconsistent playerId\n")
    }
}

func TestCompleteGame(t *testing.T) {
    gameEngine := game.NewEngine()
    for i := 0; i < 4; i++ {
        playerId := generatePlayerId()
        gameEngine.AddPlayer(playerId)
    }
    gameEngine.StartGame()
    for gameEngine.State.Phase != game.PhaseGameOver { 
        simulateTurnLoop(gameEngine)
    }
    foundWinner := false
    for _,p := range gameEngine.State.Players {
        if p.Points >= 25 {
            foundWinner = true
        }
    }
    if !foundWinner {
        t.Error("game ended without a winner\n")
    }
    structuredJson,e := json.MarshalIndent(gameEngine.State, "  ", "  ")
    if e != nil {
        t.Error("what the heck mate")
    }
    t.Logf("game state after one loop of turns: %+v\n", string(structuredJson))
}

func TestRoundPoints(t *testing.T) {
    gameEngine := game.NewEngine()
    for i := 0; i < 4; i++ {
        playerId := generatePlayerId()
        gameEngine.AddPlayer(playerId)
    }
    gameEngine.StartGame()

    for gameEngine.State.Phase != game.PhaseRoundOver {
        simulateTurnLoop(gameEngine)
    }

    structuredJson,e := json.MarshalIndent(gameEngine.State, "  ", "  ")
    if e != nil {
        t.Error("what the heck mate")
    }
    t.Logf("game state after one loop of turns: %+v\n", string(structuredJson))

}

func generatePlayerId() string { 
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func simulateTurnLoop(e *game.Engine) {
    for _, p := range e.State.Players {
        playerMove := chooseMove(e, p)
        e.ProcessMove(playerMove)
    }
}

func chooseMove(e *game.Engine, p *game.Player) game.PlayerMove {
    if len(p.Hand) == 0 {
        return buildPlayerMove(p, []game.Card{}, "skip")
    }

    // if hand empty, skip
    action := "skip"
    var selectedCards []game.Card

    for _, c := range e.State.Table {
        if card, found := findCardMatch(c, p.Hand); found {
            action = "take"
            selectedCards = []game.Card { c, card } 
            if card.Suit == "spades" {
                break
            }
        }
    }

    if action == "skip" {
        action = "toss"
        selectedCards = []game.Card{ p.Hand[0] }
    }

    return buildPlayerMove(p, selectedCards, action)
}

func findCardMatch(checkCard game.Card, hand []game.Card) (game.Card, bool) {
    for _,card := range hand {
        if card.Rank == checkCard.Rank {
            return card, true
        }
    }
    return game.Card{}, false
}

func buildPlayerMove(p *game.Player, cards []game.Card, moveType string) game.PlayerMove {
    return game.PlayerMove {
        PlayerId: p.Id,
        Cards: cards,
        MoveType: moveType,
    }
}
