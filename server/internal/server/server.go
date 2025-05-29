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
	Connections map[string]*websocket.Conn
	router      *http.ServeMux
    rooms map[string]*Room
	mu          sync.Mutex
}

type Room struct {
    ID     string
    Engine *game.Engine
    mu     sync.Mutex
    players map[string]*websocket.Conn
    acks map[string]bool
    acksMu sync.Mutex
}

func NewServer() *Server {
	return &Server{
		Connections: make(map[string]*websocket.Conn),
		router:      http.NewServeMux(),
        rooms:       make(map[string]*Room),
	}
}

func (s *Server) SetupRoutes() {
	s.router.HandleFunc("/game/{roomId}/{playerId}", s.GameHandler)
	s.router.HandleFunc("/test", s.testHandler)
    s.router.HandleFunc("/createRoom", s.CreateRoom)
    s.router.HandleFunc("POST /join/{roomId}", s.JoinRoom)
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

func (s *Server) CreateRoom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
    newRoomID := generateRoomID()
    s.mu.Lock()
    if _, in := s.rooms[newRoomID]; in {
        fmt.Fprintf(w, "room already exists")
        return
    }
    s.rooms[newRoomID] = &Room{ID: newRoomID, players: make(map[string]*websocket.Conn), Engine: game.NewEngine()} 
    s.mu.Unlock()
    fmt.Fprintf(w, "generated id: %v\n", s.rooms[newRoomID])
}

// POST /join/{roomId}
func (s *Server) JoinRoom(w http.ResponseWriter, r *http.Request) {
    roomId := r.PathValue("roomId")
    fmt.Printf("roomId: %v\n", roomId)
    if roomId == "" {
        http.Error(w, "Room ID required.", http.StatusBadRequest)
        return
    }
    room, in := s.rooms[roomId]
    if !in {
        http.Error(w, "room does not exist", http.StatusNotFound)
        return
    }
    room.mu.Lock()
    playerId := generatePlayerID()
    room.players[playerId] = nil
    room.mu.Unlock()
    fmt.Fprint(w, playerId)
}

// ws /gameconnect/{roomId}/{playerId} 
func (s *Server) GameHandler(w http.ResponseWriter, r *http.Request) {
    roomId := r.PathValue("roomId")
    playerId := r.PathValue("playerId")
    room, in := s.rooms[roomId]
    if !in {
        http.Error(w, "room does not exist", http.StatusNotFound)
        return
    }
    _,in = room.players[playerId]
    if !in {
        http.Error(w, "player does not exist", http.StatusNotFound)
        return
    }

	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     checkOrigin,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("failed upgrading connection from %v\n%v\n", r, err)
		return
	}

	defer conn.Close()
    room.mu.Lock()
    room.players[playerId] = conn
    room.handleJoin(playerId)
    room.mu.Unlock()

	fmt.Println("opened ws with", r.Header.Get("Origin"))
    
	// is this infinite loop good? is the err case sufficient to make sure it closes properly???
	for {
		_, message, err := conn.ReadMessage()
		if err = room.checkError(err, playerId); err != nil {
			return
		}
		msg := GameMessage{}
		err = json.Unmarshal(message, &msg)
		room.checkError(err, playerId)
        room.HandleMessage(playerId, msg)
	}
}

func (r *Room) HandleMessage(playerId string, msg GameMessage) {
    fmt.Printf("got message %v from %v\n", playerId, msg)
    switch msg.Type {
    case "start":
        r.handleStart()
    case "join":
        r.handleJoin(playerId)
    case "playerMove":
        r.handlePlayerMove(playerId, msg)
    case "readyAck":
        r.handlePlayerReadyAck(playerId)
    default:
       fmt.Printf("unknown message type: %+v", msg.Type)
    }
}

func (r *Room) Broadcast(playerViewType string,wsMsgType int, buildPlayerView func(playerId string) json.RawMessage) {
	r.mu.Lock()
	for playerId, conn := range r.players {
        gameMessage := GameMessage { Type: playerViewType, Data: buildPlayerView(playerId) } 
        response, err := json.Marshal(gameMessage)
        fmt.Printf("message response size in bytes: %v\n\n", len(response))
        r.checkError(err, playerId)
        err = conn.WriteMessage(wsMsgType, response)
	}
	r.mu.Unlock()
}

func (r *Room) handleStart() {
    r.Engine.StartGame()
    r.Broadcast("state", websocket.TextMessage, r.Engine.GetStateJsonForPlayer)
}

func (r *Room) handleJoin(playerId string) {
    r.Engine.AddPlayer(playerId)
    r.Broadcast("join", websocket.TextMessage, r.Engine.GetPlayersJsonForPlayer)
}

func (r *Room) handlePlayerMove(playerId string, msg GameMessage) {
    playerMove := game.PlayerMove{}
    err := json.Unmarshal(msg.Data, &playerMove)
    r.checkError(err, playerId)
    r.Engine.ProcessMove(playerMove)
    r.Broadcast("state", websocket.TextMessage, r.Engine.GetStateJsonForPlayer)
    /* if state.Phase == RoundOver: client has round over prompt with a ready up button
       server starts a timeout for starting the next round. or sends the function if all players ready beforehand.
    */
    if r.Engine.State.Phase == game.PhaseRoundOver {
        r.initAcks()
    }
}

func (r *Room) handlePlayerReadyAck(playerId string) {
    fmt.Printf("got a ready ack from: %v. during gamephase %v\n", playerId, r.Engine.State.Phase)
    if r.Engine.State.Phase != game.PhaseRoundOver {
        return
    }
    r.acksMu.Lock()
    r.acks[playerId] = true
    r.acksMu.Unlock()
    r.checkAndHandleAcks(false)
}

func (r *Room) initAcks() {
    r.acksMu.Lock()
    defer r.acksMu.Unlock()
    r.acks = make(map[string]bool)
    for playerId := range r.players {
        r.acks[playerId] = false
    }
    go func() {
        time.Sleep(5*time.Second)
        r.checkAndHandleAcks(true)
    }()

}

func (r *Room) checkAndHandleAcks(force bool) {
    r.acksMu.Lock()
    defer r.acksMu.Unlock()
    ready := force
    if !ready {
        ready = true 
        for _, isReady := range r.acks {
            if !isReady {
                ready = false
                break
            }
        }
    }
    if ready {
        r.acks = nil
        r.Engine.StartNextRound()
        r.Broadcast("state", websocket.TextMessage, r.Engine.GetStateJsonForPlayer)
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

func (r *Room) checkError(err error, playerId string) error {
	conn := r.players[playerId]
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
    r.Engine.RemovePlayer(playerId)
	delete(r.players, playerId)
    // this is probably bad design removing the players on an error... what's the better practice for handling side effects when clients close their ws? 
    if len(r.players) == 0 {
        r.Engine.ResetGame()
    }
	return err
}

func generatePlayerID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func generateRoomID() string {
    b := make([]byte, 6)
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
