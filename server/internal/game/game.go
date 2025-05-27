package game

import (
	"encoding/json"
	"fmt"
	"math/rand/v2"
	"slices"
	"sync"
)

type GamePhase int

const (
	PhaseLobby GamePhase = iota
	PhasePlaying
	PhaseRoundOver
	PhaseGameOver
)

var suits = [4]string{"spades", "clubs", "hearts", "diamonds"}
var ranks = [13]string{"A", "J", "K", "Q", "2", "3", "4", "5", "6", "7", "8", "9", "10"}

type Engine struct {
	State *GameState
}

type Card struct {
	Suit  string `json:"suit"`
	Rank  string `json:"rank"`
	Value int    `json:"value"`
}

type CardStack struct {
	Cards []Card `json:"cards"`
    Type  string `json:"type"`
    Rank  string `json:"rank"`
}

type Player struct {
	Id     string `json:"id"`
	Points int    `json:"points"`
	Hand   []Card `json:"hand"`
	Pile   []Card `json:"pile"`
}

type PlayerMove struct {
	MoveType  string    `json:"moveType"`
	PlayerId  string    `json:"playerId"`
	Cards     []Card    `json:"cards"`
	CardStack CardStack `json:"cardStack"`
}

type Turn struct {
	TurnCount       int    `json:"turnCount"`
	CurrentPlayerId string `json:"currentPlayerId"`
}

type GameState struct {
	Deck    []Card      `json:"deck"`
	Players []*Player   `json:"players"`
	Table   []CardStack `json:"table"`
	Turn    *Turn       `json:"turn"`
	Phase   GamePhase   `json:"phase"`
	mu      sync.Mutex
}

func NewEngine() *Engine {
	return &Engine{
		State: NewGameState(),
	}
}

func NewGameState() *GameState {
	deck := initDeck()
	table := make([]CardStack, 0)
	players := make([]*Player, 0)
	return &GameState{
		Deck:    deck,
		Table:   table,
		Players: players,
		Turn:    &Turn{TurnCount: 0, CurrentPlayerId: ""},
		Phase:   PhaseLobby,
	}
}

func (e *Engine) StartGame() {
	e.dealCards()
	e.passToTable(3)
	e.State.Phase = PhasePlaying
	e.State.Turn.TurnCount = 1
	e.State.Turn.CurrentPlayerId = e.State.Players[(e.State.Turn.TurnCount-1)%len(e.State.Players)].Id
}

func (e *Engine) ResetGame() {
	e.State = NewGameState()
}

func (e *Engine) StartNextRound() {
	e.resetPlayerCards()
	e.resetTable()
	e.resetDeck()
	e.dealCards()
	e.passToTable(3)
	e.State.Phase = PhasePlaying
}

func (e *Engine) AddPlayer(playerId string) {
	e.State.mu.Lock()
	e.State.Players = append(e.State.Players, &Player{Points: 0, Id: playerId, Hand: []Card{}, Pile: []Card{}})
	e.State.mu.Unlock()
}

func (e *Engine) RemovePlayer(playerId string) {
	e.State.mu.Lock()
	e.State.Players = slices.DeleteFunc(e.State.Players, func(player *Player) bool {
		return player.Id == playerId
	})
	e.State.mu.Unlock()
}

func (e *Engine) ProcessMove(move PlayerMove) {
	e.State.mu.Lock()
	if move.MoveType == "toss" {
		e.tossCards(move.PlayerId, move.Cards)
	} else if move.MoveType == "take" {
		e.takeCards(move.PlayerId, move.Cards)
	} else if move.MoveType == "stackForLater" {
		e.stackForLater(move.PlayerId, move.Cards, move.CardStack)
	}
	e.State.Turn.TurnCount++
	e.State.Turn.CurrentPlayerId = e.State.Players[(e.State.Turn.TurnCount-1)%len(e.State.Players)].Id
	if e.isRoundOver() {
		e.State.Phase = PhaseRoundOver
		e.calculatePlayerPoints()
		if e.hasWinner() {
			e.State.Phase = PhaseGameOver
		}
	} else if e.allPlayersHandsEmpty() {
		e.dealCards()
	}

	e.State.mu.Unlock()
}

func (e *Engine) GetStateJsonForPlayer(playerId string) json.RawMessage {
	e.State.mu.Lock()
	defer e.State.mu.Unlock()

	// Create a temporary struct for marshaling
	type PlayerView struct {
		Id       string `json:"id"`
		Points   int    `json:"points"`
		Hand     []Card `json:"hand,omitempty"`
		Pile     []Card `json:"pile"`
		HandSize int    `json:"handSize"`
	}

	type GameStateView struct {
		Table   []CardStack  `json:"table"`
		Players []PlayerView `json:"players"`
		Turn    *Turn        `json:"turn"`
		DeckLen int          `json:"deckLen"`
		Phase   GamePhase    `json:"phase"`
	}

	view := GameStateView{
		Table:   e.State.Table,
		Turn:    e.State.Turn,
		Players: make([]PlayerView, len(e.State.Players)),
		DeckLen: len(e.State.Deck),
		Phase:   e.State.Phase,
	}
	for i, p := range e.State.Players {
		pv := PlayerView{
			Id:       p.Id,
			Points:   p.Points,
			Pile:     p.Pile,
			HandSize: len(p.Hand),
		}

		// Only include hand for the current player
		if p.Id == playerId {
			pv.Hand = p.Hand
		}

		view.Players[i] = pv
	}

	data, err := json.Marshal(view)
	if err != nil {
		fmt.Printf("error marshalling State.Players into json: %+v\n", err)
		return []byte{}
	}
	return data
}

func (e *Engine) GetPlayersJsonForPlayer(playerId string) json.RawMessage {
	e.State.mu.Lock()
	defer e.State.mu.Unlock()
	type PlayerView struct {
		Id       string `json:"id"`
		Points   int    `json:"points"`
		Hand     []Card `json:"hand,omitempty"`
		Pile     []Card `json:"pile"`
		HandSize int    `json:"handSize"`
	}

	type View struct {
		AllPlayers []PlayerView `json:"allPlayers"`
		MyPlayerId string       `json:"myPlayerId"`
	}

	allPlayers := make([]PlayerView, len(e.State.Players))
	for i, p := range e.State.Players {
		pv := PlayerView{
			Id:       p.Id,
			Points:   p.Points,
			Pile:     p.Pile,
			HandSize: len(p.Hand),
		}

		// Only include hand for the current player
		if p.Id == playerId {
			pv.Hand = p.Hand
		}

		allPlayers[i] = pv
	}
	view := View{AllPlayers: allPlayers, MyPlayerId: playerId}
	data, err := json.Marshal(view)
	if err != nil {
		fmt.Printf("error marshalling State.Players into json: %+v\n", err)
		return []byte{}
	}
	return data
}

func initDeck() []Card {
	d := make([]Card, 52)
	k := 0
	for i := range suits {
		for j := range ranks {
			value := getValue(suits[i], ranks[j])
			d[k] = Card{Suit: suits[i], Rank: ranks[j], Value: value}
			k++
		}
	}
	return shuffleCards(d)
}

func getValue(suit, rank string) int {
	if suit == "spades" && rank == "2" {
		return 2
	}
	if suit == "diamonds" && rank == "10" {
		return 3
	}
	if rank == "A" {
		return 1
	}
	return 0
}

func (e *Engine) dealCards() {
	if len(e.State.Deck) == 0 {
		e.State.Phase = PhaseRoundOver
		return
	}
	nCardsToPass := 3 * len(e.State.Players)
	e.passToPlayers(nCardsToPass)
	if len(e.State.Deck) < 3*len(e.State.Players) {
		nCardsToPass = (len(e.State.Deck) / len(e.State.Players)) * len(e.State.Players)
		e.passToPlayers(nCardsToPass)
		e.passToTable(len(e.State.Deck))
	}
}

func (e *Engine) passToPlayers(ncards int) {
	players := e.State.Players
	deck := e.State.Deck
	for i := range ncards {
		m := len(deck)
		j := i % len(players)
		card := deck[m-1]
		deck = deck[:m-1]
		players[j].Hand = append(players[j].Hand, card)
	}
	e.State.Players = players
	e.State.Deck = deck
}

func (e *Engine) passToTable(ncards int) {
	table := e.State.Table
	deck := e.State.Deck
	for i := 0; i < ncards; i++ {
		m := len(deck)
		card := deck[m-1]
		deck = deck[:m-1]
        table = append(table, CardStack{Cards: []Card{card}, Type: "single", Rank:card.Rank})
	}
	e.State.Table = table
	e.State.Deck = deck
}

func (e *Engine) takeCards(playerId string, cards []Card) {
	player, err := e.getPlayer(playerId)

	if err != nil {
		fmt.Printf("%v\n", err)
		return
	}

	for _, c := range cards {
		player.Pile = append(player.Pile, c)
		e.State.Table = slices.DeleteFunc(e.State.Table, func(cardStack CardStack) bool {
			return cardStackHasCard(cardStack, c)
		})
		player.Hand = slices.DeleteFunc(player.Hand, func(handCard Card) bool {
			return handCard == c
		})
	}
}

func (e *Engine) tossCards(playerId string, cards []Card) {
	player, err := e.getPlayer(playerId)

	if err != nil {
		fmt.Printf("%v\n", err)
		return
	}

	for _, c := range cards {
		e.State.Table = append(e.State.Table, CardStack{[]Card{c},"single",c.Rank})
		player.Hand = slices.DeleteFunc(player.Hand, func(handcard Card) bool {
			return handcard == c
		})
	}
}

/*
i dont like this too much because the code expression is saying:

	you can stack more than one card
	not true, its like this because i added an optional cardSTack field to existing PlayerMove{}
	instead of refactoring into unique structs for each or into something else.
	but it works for now and i dont see having to add more move types for now.

    also cardStack.isEqual is a bit misleading because the argument will have a different type
*/
func (e *Engine) stackForLater(playerId string, cards []Card, cardStack CardStack) {
	player, err := e.getPlayer(playerId)
	if err != nil {
		fmt.Printf("%v\n", err)
	}
	for i, tableStack := range e.State.Table {
		if cardStack.isEqual(tableStack) {
			e.State.Table[i].Cards = append(tableStack.Cards, cards...)
            e.State.Table[i].Type = cardStack.Type
		}
	}
	for _, c := range cards {
		player.Hand = slices.DeleteFunc(player.Hand, func(handcard Card) bool {
			return handcard == c
		})
	}
}

func (e *Engine) getPlayer(playerId string) (*Player, error) {
	for _, p := range e.State.Players {
		if p.Id == playerId {
			return p, nil
		}
	}
	return nil, fmt.Errorf("playerId %v not found\n", playerId)
}

func (e *Engine) allPlayersHandsEmpty() bool {
	for _, p := range e.State.Players {
		if len(p.Hand) > 0 {
			return false
		}
	}
	return true
}

func (e *Engine) calculatePlayerPoints() {
	mostCardsPlayer := &Player{}
	mostSpadesPlayer := &Player{}
	for _, p := range e.State.Players {
		cardPoints := 0
		for _, card := range p.Pile {
			cardPoints += card.Value
		}
		if len(p.Pile) > len(mostCardsPlayer.Pile) {
			mostCardsPlayer = p
		}
		if getSpadesCount(p) > getSpadesCount(mostSpadesPlayer) {
			mostSpadesPlayer = p
		}
		p.Points += cardPoints
	}
	mostCardsPlayer.Points += 1
	mostSpadesPlayer.Points += 1
}

func getSpadesCount(p *Player) int {
	count := 0
	for _, card := range p.Pile {
		if card.Suit == "spades" {
			count++
		}
	}
	return count
}

func (cs *CardStack) push(c Card) {
	cs.Cards = append(cs.Cards, c)
}

func (e *Engine) resetPlayerCards() {
	for _, p := range e.State.Players {
		p.Hand = []Card{}
		p.Pile = []Card{}
	}
}

func (e *Engine) resetTable() {
	e.State.Table = []CardStack{}
}

func (e *Engine) resetDeck() {
	e.State.Deck = initDeck()
}

func (e *Engine) isRoundOver() bool {
	return e.allPlayersHandsEmpty() && len(e.State.Deck) == 0
}

func (e *Engine) hasWinner() bool {
	for _, p := range e.State.Players {
		if p.Points >= 25 {
			return true
		}
	}
	return false
}

func shuffleCards(cards []Card) []Card {
	n := len(cards)
	shuffledCards := make([]Card, n)
	for i := range n {
		j := rand.IntN(n - i)
		shuffledCards[i] = cards[j]
		cards = append(cards[:j], cards[j+1:]...)
	}
	return shuffledCards
}

func cardStackHasCard(cardStack CardStack, card Card) bool {
	for _, c := range cardStack.Cards {
		if card == c {
			return true
		}
	}
	return false
}

func (source CardStack) isEqual(target CardStack) bool {
	for _, card := range source.Cards {
		if !cardStackHasCard(target, card) {
			return false
		}
	}
	return true
}
