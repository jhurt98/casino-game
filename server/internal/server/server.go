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
	router *http.ServeMux
	rooms  map[string]*Room
	mu     sync.Mutex
}

type Room struct {
	id     string
	engine *game.Engine
	mu     sync.Mutex
	conns  map[string]*PlayerConnection
	acks   map[string]bool
	acksMu sync.Mutex
}

type PlayerConnection struct {
	conn           *websocket.Conn
	id             string
	name           string
	disconnectedAt *time.Time
	lastMessage    time.Time
}

func NewServer() *Server {
	return &Server{
		router: http.NewServeMux(),
		rooms:  make(map[string]*Room),
	}
}

func (s *Server) SetupRoutes() {
	s.router.HandleFunc("/gameconnect/{roomId}/{playerId}", s.GameConnect)
	s.router.HandleFunc("/test", s.testHandler)
	s.router.HandleFunc("POST /createRoom", s.CreateRoom)
	s.router.HandleFunc("POST /joinRoom/{roomId}", s.JoinRoom)
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
	w.Header().Set("Access-Control-Allow-Origin", "*")
	newRoomID := generateRoomID()
	s.mu.Lock()
	if _, in := s.rooms[newRoomID]; in {
		fmt.Fprintf(w, "room already exists")
		return
	}
	s.rooms[newRoomID] = &Room{id: newRoomID, conns: make(map[string]*PlayerConnection), engine: game.NewEngine()}
	s.mu.Unlock()
	fmt.Fprint(w, newRoomID)
}

// POST /join/{roomId}/?playerName={playerName}
func (s *Server) JoinRoom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	roomId := r.PathValue("roomId")
	playerName := r.URL.Query().Get("playerName")
	fmt.Printf("roomId: %v, playerName: %v\n", roomId, playerName)
	if roomId == "" {
		fmt.Println("empty room id string")
		http.Error(w, "Room ID required.", http.StatusBadRequest)
		return
	}
	room, in := s.rooms[roomId]
	if !in {
		fmt.Println("room does not exist")
		http.Error(w, "room does not exist", http.StatusNotFound)
		return
	}
	room.mu.Lock()
	playerId := generatePlayerID()
	if playerName == "" {
		playerName = fmt.Sprintf("Player %v", len(room.conns)+1)
	}
	room.conns[playerId] = &PlayerConnection{name: playerName, id: playerId, disconnectedAt: nil}
    fmt.Printf("room conns: %+v\n", room.conns)
	room.mu.Unlock()
	fmt.Fprint(w, playerId)
}

func (s *Server) GameConnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	roomId := r.PathValue("roomId")
	playerId := r.PathValue("playerId")
	room, in := s.rooms[roomId]
	if !in {
		http.Error(w, "room does not exist", http.StatusNotFound)
		return
	}
	player, playerJoined := room.conns[playerId]
	if !playerJoined {
		http.Error(w, "player is not connected", http.StatusNotFound)
		return
	}

	fmt.Printf("connecting %v\n", player.name)
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

    room.SetConnection(playerId, conn)
    if !room.HasPlayerInGame(playerId) {
	    room.handleJoinGame(playerId)
    } else {
        connectMsg := GameMessage {
            Type: "connect",
            Data: json.RawMessage(`{"playerId": "` + playerId + `"}`),
        }
        room.Broadcast(websocket.TextMessage, connectMsg)

		gameMessage := GameMessage{Type: "state", Data: room.engine.GetStateJsonForPlayer(playerId)}
		response, err := json.Marshal(gameMessage)
		room.checkError(err, playerId)
		room.conns[playerId].conn.WriteMessage(websocket.TextMessage, response)
    }

	fmt.Println("opened ws with", r.Header.Get("Origin"))

	for {
		_, message, err := conn.ReadMessage()
		if err = room.checkError(err, playerId); err != nil {
            // handle player disconnect: set conn to nil, set disconnectedAt, setTimeout to remove from room.
            t := time.Now()
            room.conns[playerId].disconnectedAt = &t
            disconnectMsg := GameMessage {
                Type: "disconnect",
                Data: json.RawMessage(`{"playerId": "` + playerId + `"}`),
            }
            room.Broadcast(websocket.TextMessage, disconnectMsg)
            go func() {
                time.Sleep(30*time.Second)
                room.mu.Lock()
	            room.engine.RemovePlayer(playerId)
	            delete(room.conns, playerId)
                room.mu.Unlock()
                if len(room.conns) == 0 {
                    delete(s.rooms,room.id)
                }
	            room.BroadcastEngineUpdate("join", websocket.TextMessage, room.engine.GetPlayersJsonForPlayer)
            }()
			return
		}
		msg := GameMessage{}
		err = json.Unmarshal(message, &msg)
		room.checkError(err, playerId)
		room.HandleMessage(playerId, msg)
	}
}

func (r *Room) SetConnection(playerId string, conn *websocket.Conn) {
    r.mu.Lock()
    r.conns[playerId].conn = conn
    r.conns[playerId].disconnectedAt = nil
    r.mu.Unlock()
}

func (r *Room) HasPlayerInGame(playerId string) bool {
    return r.engine.HasPlayer(playerId)
}

func (r *Room) HandleMessage(playerId string, msg GameMessage) {
	switch msg.Type {
	case "start":
		r.handleStart()
	case "join":
		r.handleJoinGame(playerId)
	case "playerMove":
		r.handlePlayerMove(playerId, msg)
	case "readyAck":
		r.handlePlayerReadyAck(playerId)
	default:
		fmt.Printf("unknown message type: %+v", msg.Type)
	}
}

    func (r *Room) Broadcast(wsMsgType int, gameMsg GameMessage) {
        r.mu.Lock()
        for pId, pConn := range r.conns {
            if pConn.disconnectedAt == nil {
                msg, err := json.Marshal(gameMsg)
                r.checkError(err, pId)
                pConn.conn.WriteMessage(wsMsgType, msg)
            }
        }
        r.mu.Unlock()
    }

func (r *Room) BroadcastEngineUpdate(messageViewType string, wsMsgType int, buildMessageView func(playerId string) json.RawMessage) {
	r.mu.Lock()
	for playerId, pConn := range r.conns {
		gameMessage := GameMessage{Type: messageViewType, Data: buildMessageView(playerId)}
		response, err := json.Marshal(gameMessage)
		fmt.Printf("message response size in bytes: %v\n\n", len(response))
		r.checkError(err, playerId)
		err = pConn.conn.WriteMessage(wsMsgType, response)
	}
	r.mu.Unlock()
}

func (r *Room) handleStart() {
	r.engine.StartGame()
	r.BroadcastEngineUpdate("state", websocket.TextMessage, r.engine.GetStateJsonForPlayer)
}

func (r *Room) handleJoinGame(playerId string) {
	r.engine.AddPlayer(playerId, r.conns[playerId].name)
	r.BroadcastEngineUpdate("join", websocket.TextMessage, r.engine.GetPlayersJsonForPlayer)
}

func (r *Room) handlePlayerMove(playerId string, msg GameMessage) {
	playerMove := game.PlayerMove{}
	err := json.Unmarshal(msg.Data, &playerMove)
	r.checkError(err, playerId)
	r.engine.ProcessMove(playerMove)
	r.BroadcastEngineUpdate("state", websocket.TextMessage, r.engine.GetStateJsonForPlayer)
	if r.engine.State.Phase == game.PhaseRoundOver {
		r.initAcks()
	}
}

func (r *Room) handlePlayerReadyAck(playerId string) {
	fmt.Printf("got a ready ack from: %v. during gamephase %v\n", playerId, r.engine.State.Phase)
	if r.engine.State.Phase != game.PhaseRoundOver {
		return
	}
	r.acksMu.Lock()
	r.acks[playerId] = true
	allReady := r.checkAllReady()
	if allReady {
		r.acks = nil
		r.engine.StartNextRound()
		r.BroadcastEngineUpdate("state", websocket.TextMessage, r.engine.GetStateJsonForPlayer)
	}
	r.acksMu.Unlock()
}

func (r *Room) initAcks() {
	r.acksMu.Lock()
	defer r.acksMu.Unlock()
	r.acks = make(map[string]bool)
	for playerId := range r.conns {
		r.acks[playerId] = false
	}
}

func (r *Room) checkAllReady() bool {
	ready := true
	for _, isReady := range r.acks {
		if !isReady {
			ready = false
			break
		}
	}
	return ready
}

func printMessages(messages map[string]json.RawMessage) {
	for pId, msg := range messages {
		fmt.Printf("%+v: %+v\n", pId, string(msg))
	}
}

func checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	fmt.Printf("origin: %v\n", origin)
	return origin == "http://192.168.0.120:5173" || origin == "http://localhost:5173" || origin == "localhost" || origin == "null"
}

func (r *Room) checkError(err error, playerId string) error {
	conn := r.conns[playerId]
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
	if len(r.conns) == 0 {
		r.engine.ResetGame()
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

func (r *Room) printConnections() {
	fmt.Printf("connections %+v\n", r.conns)
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
