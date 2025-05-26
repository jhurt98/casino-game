package server

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"game-server/internal/game"
	"github.com/gorilla/websocket"
	"net/http"
	"os"
	"sync"
    "time"
)

type GameMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type Server struct {
	Engine      *game.Engine
	Connections map[string]*websocket.Conn
	mu          sync.Mutex
	router      *http.ServeMux
    acks map[string]bool
    acksMu sync.Mutex
}

func NewServer() *Server {
	return &Server{
		Engine:      game.NewEngine(),
		Connections: make(map[string]*websocket.Conn),
		router:      http.NewServeMux(),
	}
}

func (s *Server) SetupRoutes() {
	s.router.HandleFunc("/game", s.GameHandler)
	s.router.HandleFunc("/test", s.testHandler)
}

func (s *Server) Handler() http.Handler {
	return s.router
}

func (s *Server) Start() {
	s.SetupRoutes()
	fmt.Printf("server started\n")
	err := http.ListenAndServe(":8080", s.Handler())
	if err != nil {
		fmt.Printf("error returned from http.ListenAndServe\nerror: %v\n", err)
		os.Exit(1)
	}
}

func (s *Server) GameHandler(w http.ResponseWriter, r *http.Request) {
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	defer conn.Close()

	if err != nil {
		fmt.Printf("failed upgrading connection from %v\n%v\n", r, err)
		return
	}

	s.mu.Lock()
	playerId := generatePlayerID()
	s.Connections[playerId] = conn
	s.printConnections()
	s.mu.Unlock()

	fmt.Println("opened ws with", r.Header.Get("Origin"))

	// is this infinite loop good? is the err case sufficient to make sure it closes properly???
	for {
		_, message, err := conn.ReadMessage()
		if err = s.checkError(err, playerId); err != nil {
			return
		}

		msg := GameMessage{}
		err = json.Unmarshal(message, &msg)
		s.checkError(err, playerId)

        s.HandleMessage(playerId, msg)
	}
}

func (s *Server) HandleMessage(playerId string, msg GameMessage) {
    fmt.Printf("got message %v from %v\n", playerId, msg)
    switch msg.Type {
    case "start":
        s.handleStart()
    case "join":
        s.handleJoin(playerId)
    case "playerMove":
        s.handlePlayerMove(playerId, msg)
    case "readyAck":
        s.handlePlayerReadyAck(playerId)
    default:
       fmt.Printf("unknown message type: %+v", msg.Type)
    }
}

func (s *Server) Broadcast(playerViewType string,wsMsgType int, buildPlayerView func(playerId string) json.RawMessage) {
	s.mu.Lock()
	for playerId, conn := range s.Connections {
        gameMessage := GameMessage { Type: playerViewType, Data: buildPlayerView(playerId) } 
        response, err := json.Marshal(gameMessage)
        fmt.Printf("message response size in bytes: %v\n\n", len(response))
        s.checkError(err, playerId)
        err = conn.WriteMessage(wsMsgType, response)
	}
	s.mu.Unlock()
}

func (s *Server) handleStart() {
    s.Engine.StartGame()
    s.Broadcast("state", websocket.TextMessage, s.Engine.GetStateJsonForPlayer)
}

func (s *Server) handleJoin(playerId string) {
    s.Engine.AddPlayer(playerId)
    s.Broadcast("join", websocket.TextMessage, s.Engine.GetPlayersJsonForPlayer)
}

func (s *Server) handlePlayerMove(playerId string, msg GameMessage) {
    playerMove := game.PlayerMove{}
    err := json.Unmarshal(msg.Data, &playerMove)
    s.checkError(err, playerId)
    s.Engine.ProcessMove(playerMove)
    s.Broadcast("state", websocket.TextMessage, s.Engine.GetStateJsonForPlayer)
    /* if state.Phase == RoundOver: client has round over prompt with a ready up button
       server starts a timeout for starting the next round. or sends the function if all players ready beforehand.
    */
    if s.Engine.State.Phase == game.PhaseRoundOver {
        s.initAcks()
    }
}

func (s *Server) handlePlayerReadyAck(playerId string) {
    fmt.Printf("got a ready ack from: %v. during gamephase %v\n", playerId, s.Engine.State.Phase)
    if s.Engine.State.Phase != game.PhaseRoundOver {
        return
    }
    s.acksMu.Lock()
    s.acks[playerId] = true
    s.acksMu.Unlock()
    s.checkAndHandleAcks(false)
}

func (s *Server) initAcks() {
    s.acksMu.Lock()
    defer s.acksMu.Unlock()
    s.acks = make(map[string]bool)
    for playerId := range s.Connections {
        s.acks[playerId] = false
    }
    go func() {
        time.Sleep(5*time.Second)
        s.checkAndHandleAcks(true)
    }()

}

func (s *Server) checkAndHandleAcks(force bool) {
    s.acksMu.Lock()
    defer s.acksMu.Unlock()
    ready := force
    if !ready {
        ready = true 
        for _, isReady := range s.acks {
            if !isReady {
                ready = false
                break
            }
        }
    }

    if ready {
        s.acks = nil
        s.Engine.StartNextRound()
        s.Broadcast("state", websocket.TextMessage, s.Engine.GetStateJsonForPlayer)
    }
}

func printMessages(messages map[string]json.RawMessage) {
    for pId, msg := range messages { 
        fmt.Printf("%+v: %+v\n", pId, string(msg))
    }
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	return origin == "http://192.168.0.120:5173" || origin == "http://localhost:5173" || origin == "localhost"
}

func (s *Server) checkError(err error, playerId string) error {
	conn := s.Connections[playerId]
	if err == nil {
		return nil
	}
	if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure, websocket.CloseAbnormalClosure) {
		fmt.Printf("--- error: %v\n", err)
	} else if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		fmt.Printf("----- normal close: %v -----\n", err)
	} else if conn == nil {
		fmt.Printf("----- failed to upgrade websocket with error: %+v\n", err)
	}
    s.Engine.RemovePlayer(playerId)
	delete(s.Connections, playerId)
    // this is probably bad design removing the players on an error... what's the better practice for handling side effects when clients close their ws? 
    if len(s.Connections) == 0 {
        s.Engine.ResetGame()
    }
	return err
}

func generatePlayerID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func (s *Server) printConnections() {
	fmt.Printf("connections %+v\n", s.Connections)
}

func marshalGameMessage(msgType string, data json.RawMessage) []byte {
	gameMessage := GameMessage{Type: msgType, Data: data}
	res, err := json.Marshal(gameMessage)
	if err != nil {
		fmt.Printf("error calling json.Marshall on %+v\nError message: %+v\n", gameMessage, err)
	}
	return res
}

func (server *Server) testHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
	fmt.Fprintf(w, "hello\n")
	printHeaders(r)
}

func printHeaders(r *http.Request) {
	for k, v := range r.Header {
		fmt.Println(k, v)
	}
}
