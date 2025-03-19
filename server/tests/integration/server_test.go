package integration

import (
	"strings"
	"testing"
	"encoding/json"
	"game-server/internal/game"
	"game-server/internal/server"
	"github.com/gorilla/websocket"
	"net/http"
	"net/http/httptest"
    "sync"
)

type MessageWrapper struct {
	*server.GameMessage
}

func (m MessageWrapper) MarshalJSON() ([]byte, error) {
	return json.Marshal(&struct {
		Type string `json:"type"`
		Data string `json:"data"` // Convert bytes to string
	}{
		Type: m.Type,
		Data: string(m.Data), // Convert []byte to string before marshaling
	})
}

func (m MessageWrapper) String() string {
	jsonData, _ := json.MarshalIndent(m, "", "  ")
	return string(jsonData)
}


func TestWSHandshake(t *testing.T) {
	_, clients := testSetup(t, 1)
	defer clients[0].Close()
}

func TestJoin(t *testing.T) {
	_, wsClients := testSetup(t, 1)
	for i := range wsClients {
		defer wsClients[i].Close()
	}

	testJSON := `{}`
	msg := server.GameMessage{Type: "join", Data: []byte(testJSON)}
	js, err := json.Marshal(msg)

	if err := wsClients[0].WriteMessage(websocket.TextMessage, js); err != nil {
		t.Errorf("error writing message to ws: %+v\n", err)
	}
	_, p, err := wsClients[0].ReadMessage()
	if err != nil {
		t.Errorf("error reading from ws: %+v\n", err)
	}

	gmResponse := server.GameMessage{}
	json.Unmarshal(p, &gmResponse)
	t.Log(MessageWrapper{&gmResponse})
}

func TestStartGame(t *testing.T) {
	_, wsClients := testSetup(t, 1)
	for i := range wsClients {
		defer wsClients[i].Close()
	}

	joinClients(t, wsClients)

	testJSON := `{}`
	msg := server.GameMessage{Type: "start", Data: []byte(testJSON)}
	js, err := json.Marshal(msg)

	if err := wsClients[0].WriteMessage(websocket.TextMessage, js); err != nil {
		t.Errorf("error writing message to ws: %+v\n", err)
	}
	_, p, err := wsClients[0].ReadMessage()
	if err != nil {
		t.Errorf("error reading from ws: %+v\n", err)
	}

	var gameMessage server.GameMessage
	err = json.Unmarshal(p, &gameMessage)
	var gameState game.GameState
	err = json.Unmarshal(gameMessage.Data, &gameState)

    t.Logf("game message %+v\n", gameMessage)
    t.Logf("game state %+v\n", &gameState)
	if len(gameState.Players[0].Hand) == 0 {
		t.Error("starting the game did not pass cards correctly")
	}
	t.Logf("%+v\n",&gameState)
	logPlayers(t, gameState.Players)

}

func TestTossCards(t *testing.T) {
    _, clients := testSetup(t, 1)
    defer closeAllConnections(clients)

	joinClients(t, clients)

	testJSON := `{}`
	msg := server.GameMessage{Type: "start", Data: []byte(testJSON)}
	js, err := json.Marshal(msg)

	if err := clients[0].WriteMessage(websocket.TextMessage, js); err != nil {
		t.Errorf("error writing message to ws: %+v\n", err)
	}
	_, p, err := clients[0].ReadMessage()
	if err != nil {
		t.Errorf("error reading from ws: %+v\n", err)
	}

	var gameMessage server.GameMessage
	err = json.Unmarshal(p, &gameMessage)
	var gameState game.GameState
	err = json.Unmarshal(gameMessage.Data, &gameState)
    cards := []game.Card{gameState.Players[0].Hand[0]}
    playerMove := game.PlayerMove {
        MoveType: "toss",
        PlayerId: gameState.Players[0].Id,
        Cards: cards,
    }
    data, err := json.Marshal(playerMove)
    msg = server.GameMessage{Type: "playerMove", Data: []byte(data) }
    js,err = json.Marshal(msg)
	if err := clients[0].WriteMessage(websocket.TextMessage, js); err != nil {
		t.Errorf("error writing message to ws: %+v\n", err)
	}
	_, p, err = clients[0].ReadMessage()
	if err != nil {
		t.Errorf("error reading from ws: %+v\n", err)
	}
	err = json.Unmarshal(p, &gameMessage)
    err = json.Unmarshal(gameMessage.Data, &gameState)
    t.Logf("game state after tossing %+v\n", &gameState)
	logPlayers(t, gameState.Players)
}

func TestMultiplePlayers(t *testing.T) {
    _, clients := testSetup(t, 4)
	joinClients(t, clients)
	testJSON := `{}`
	msg := server.GameMessage{Type: "start", Data: []byte(testJSON)}
	js, err := json.Marshal(msg)
	if err = clients[0].WriteMessage(websocket.TextMessage, js); err != nil {
		t.Errorf("error writing message to ws: %+v\n", err)
	}
	_, p, err := clients[0].ReadMessage()
    var gameMessage server.GameMessage
    for {
        err = json.Unmarshal(p, &gameMessage)
        t.Logf("raw message returned: %+v\n", string(p))
        if gameMessage.Type == "state" {
            t.Logf("finished testing: %+v\n", string(gameMessage.Data))
            break
        }
        _,p,err = clients[0].ReadMessage()
    }
}

func testSetup(t *testing.T, nClients int) (*server.Server, []*websocket.Conn) {
	gameServer := server.NewServer()
	gameServer.SetupRoutes()
	s := httptest.NewServer(gameServer.Handler())
	defer s.Close()
	u := "ws" + strings.TrimPrefix(s.URL, "http") + "/game"
	header := http.Header{}
	header.Set("Origin", "localhost")
	clients := createWsClients(t, nClients, u, header)
	return gameServer, clients
}

func createWsClients(t *testing.T, n int, u string, h http.Header) []*websocket.Conn {
    var wg sync.WaitGroup
    connectedClients := make(chan *websocket.Conn, n)
    errors := make(chan error, n)
	clients := make([]*websocket.Conn, 0)
    wg.Add(n)

    for i := 0; i < n; i++ {
        go connectClient(connectedClients, errors, &wg, u, h) 
    }
    for i := 0; i < n; i++ {
        select {
        case conn := <-connectedClients:
            clients = append(clients, conn)
        case err := <-errors:
            t.Errorf("error connecting client: %+v\n", err)
        }
    }
    wg.Wait()
	return clients
}

func connectClient(connectedClients chan<- *websocket.Conn, errors chan<- error, wg *sync.WaitGroup, u string, h http.Header) {
    defer wg.Done()
    conn, _, err := websocket.DefaultDialer.Dial(u, h)
    if err != nil {
        errors <- err
    }
    connectedClients <- conn 
}

func joinClients(t *testing.T, clients []*websocket.Conn) {
    var wg sync.WaitGroup
    wg.Add(len(clients))
    joinClient := func(i int) {
        defer wg.Done()
		testJSON := `{}`
		msg := server.GameMessage{Type: "join", Data: []byte(testJSON)}
		js, err := json.Marshal(msg)

		if err := clients[i].WriteMessage(websocket.TextMessage, js); err != nil {
			t.Errorf("error writing message to ws: %+v\n", err)
		}
		_, _, err = clients[i].ReadMessage()
		if err != nil {
			t.Errorf("error reading from ws: %+v\n", err)
		}

    }
	for i := range clients {
        go joinClient(i)
	}
    wg.Wait()
}

func closeAllConnections(clients []*websocket.Conn) {
    for _, client := range clients {
        if client != nil {
            client.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
            client.Close()
        }
    }
}

func logPlayers(t *testing.T, players []*game.Player) {
	for p := range players {
		t.Logf("%+v\n",*players[p])
	}
}

