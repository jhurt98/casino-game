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
	"log"
)

type GameMessage struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

type Config struct {
	port string
	allowedOrigins string
}

type Server struct {
	router *http.ServeMux
	rooms  map[string]*Room
	mu     sync.Mutex
	config Config
}

type Room struct {
	id     string
	engine *game.Engine
	mu     sync.Mutex
	playerConns map[string]*PlayerConnection
	acks   map[string]bool
	acksMu sync.Mutex
}

type PlayerConnection struct {
	conn           *websocket.Conn
	id             string
	name           string
	disconnectedAt *time.Time
	lastMessage    time.Time
	msgCount       int
}

var (
	InfoLogger = log.New(os.Stdout, "INFO: ", log.Ldate|log.Ltime|log.Lshortfile)
	ErrorLogger = log.New(os.Stderr, "ERROR: ", log.Ldate|log.Ltime|log.Lshortfile)
	WarnLogger = log.New(os.Stdout, "WARN: ", log.Ldate|log.Ltime|log.Lshortfile)
)

func NewServer() *Server {
	config := Config {
		port: getEnv("PORT", "8000"),
		allowedOrigins: getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
	}

	return &Server{
		router: http.NewServeMux(),
		rooms:  make(map[string]*Room),
		config: config,
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
	InfoLogger.Printf("Server Started\n")
	err := http.ListenAndServe(":"+s.config.port, s.Handler())
	if err != nil {
		ErrorLogger.Fatalf("Error returned from http.ListenAndServe\nerror: %v\n", err)
	}
}

func (s *Server) CreateRoom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", s.config.allowedOrigins)
	newRoomID := generateRoomID()
	s.mu.Lock()
	if _, in := s.rooms[newRoomID]; in {
		fmt.Fprintf(w, "room already exists")
		return
	}
	s.rooms[newRoomID] = &Room{id: newRoomID, playerConns: make(map[string]*PlayerConnection), engine: game.NewEngine()}
	s.mu.Unlock()
	fmt.Fprint(w, newRoomID)
}

// POST /join/{roomId}/?playerName={playerName}
func (s *Server) JoinRoom(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", s.config.allowedOrigins)
	roomId := r.PathValue("roomId")
	playerName := r.URL.Query().Get("playerName")
	if roomId == "" {
		WarnLogger.Println("Called /join with empty string.")
		http.Error(w, "Room ID required.", http.StatusBadRequest)
		return
	}
	room, in := s.rooms[roomId]
	if !in {
		WarnLogger.Printf("Did not find room with id: %v\n", roomId)
		http.Error(w, "room does not exist", http.StatusNotFound)
		return
	}
	room.mu.Lock()
	playerId := generatePlayerID()
	if playerName == "" {
		playerName = fmt.Sprintf("Player %v", len(room.playerConns)+1)
	}
	room.playerConns[playerId] = &PlayerConnection{name: playerName, id: playerId, disconnectedAt: nil}
	room.mu.Unlock()
	fmt.Fprint(w, playerId)
	InfoLogger.Printf("%v joined %v\n", playerName, roomId) 
}

func (s *Server) GameConnect(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", s.config.allowedOrigins)
	roomId := r.PathValue("roomId")
	playerId := r.PathValue("playerId")
	room, in := s.rooms[roomId]
	if !in {
		WarnLogger.Printf("GameConnect: roomId does not exist: %v\n", roomId)
		http.Error(w, "room does not exist", http.StatusNotFound)
		return
	}
	playerConn, playerJoined := room.playerConns[playerId]
	if !playerJoined {
		WarnLogger.Printf("GameConnect: player is not in the room %v %v\n", playerId, roomId)
		http.Error(w, "player is not connected", http.StatusNotFound)
		return
	}

	InfoLogger.Printf("connecting %v\n", playerConn.name)
	var upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin:     s.checkOrigin,
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		WarnLogger.Printf("Failed upgrading connection from %v\n%v\n", r, err)
		return
	}

	defer conn.Close()

    room.SetConnection(playerId, conn)
    if !room.HasPlayerInGame(playerId) {
	    room.handleJoinGame(playerId)
    } else {
        fmt.Printf("got reconnect message from %v\n", playerConn.name)
        connectMsg := GameMessage {
            Type: "connect",
            Data: json.RawMessage(`{"playerId": "` + playerId + `"}`),
        }
        room.Broadcast(websocket.TextMessage, connectMsg)

		gameMessage := GameMessage{Type: "state", Data: room.engine.GetStateJsonForPlayer(playerId)}
		response, err := json.Marshal(gameMessage)
		room.checkError(err)
		playerConn.conn.WriteMessage(websocket.TextMessage, response)
    }

	InfoLogger.Println("Opened ws with", r.Header.Get("Origin"))

	for {
		_, message, err := conn.ReadMessage()
		if err = room.checkError(err); err != nil {
            t := time.Now()
            playerConn.disconnectedAt = &t
			playerConn.conn = nil
            disconnectMsg := GameMessage {
                Type: "disconnect",
                Data: json.RawMessage(`{"playerId": "` + playerId + `"}`),
            }
            room.Broadcast(websocket.TextMessage, disconnectMsg)
            go func() {
                time.Sleep(30*time.Second)
				if playerConn.disconnectedAt != nil && time.Since(*playerConn.disconnectedAt) < 30*time.Second {
					return
				}
                room.mu.Lock()
	            room.engine.RemovePlayer(playerId)
	            delete(room.playerConns, playerId)
                room.mu.Unlock()
                if len(room.playerConns) == 0 {
                    delete(s.rooms,room.id)
					InfoLogger.Printf("Deleted room: %v\n", room.id)
                }
	            room.BroadcastEngineUpdate("join", websocket.TextMessage, room.engine.GetPlayersJsonForPlayer)
            }()
			return
		}
		msg := GameMessage{}
		err = json.Unmarshal(message, &msg)
		room.checkError(err)
		room.HandleMessage(playerId, msg)
	}
}

func (r *Room) SetConnection(playerId string, conn *websocket.Conn) {
    r.mu.Lock()
    r.playerConns[playerId].conn = conn
    r.playerConns[playerId].disconnectedAt = nil
    r.mu.Unlock()
}

func (r *Room) HasPlayerInGame(playerId string) bool {
    return r.engine.HasPlayer(playerId)
}

func (r *Room) HandleMessage(playerId string, msg GameMessage) {
	playerConn := r.playerConns[playerId]
	if time.Since(playerConn.lastMessage) < 100*time.Millisecond {
		playerConn.msgCount++
		if playerConn.msgCount > 10 {
			playerConn.conn.Close()
			delete(r.playerConns, playerId)
			return
		}
	} else {
		playerConn.msgCount = 0 
	}
	playerConn.lastMessage = time.Now()
	switch msg.Type {
	case "start":
		r.handleStart()
	case "join":
		r.handleJoinGame(playerId)
	case "playerMove":
		r.handlePlayerMove(msg)
	case "readyAck":
		r.handlePlayerReadyAck(playerId)
	default:
		WarnLogger.Printf("Unknown message type: %+v", msg.Type)
	}
}

    func (r *Room) Broadcast(wsMsgType int, gameMsg GameMessage) {
        r.mu.Lock()
        for _, pConn := range r.playerConns {
            if pConn.conn != nil {
                msg, err := json.Marshal(gameMsg)
                r.checkError(err)
                pConn.conn.WriteMessage(wsMsgType, msg)
            }
        }
        r.mu.Unlock()
    }

func (r *Room) BroadcastEngineUpdate(messageViewType string, wsMsgType int, buildMessageView func(playerId string) json.RawMessage) {
	r.mu.Lock()
	for playerId, pConn := range r.playerConns {
		gameMessage := GameMessage{Type: messageViewType, Data: buildMessageView(playerId)}
		response, err := json.Marshal(gameMessage)
		//fmt.Printf("message response size in bytes: %v\n\n", len(response))
		r.checkError(err)
		err = pConn.conn.WriteMessage(wsMsgType, response)
	}
	r.mu.Unlock()
}

func (r *Room) handleStart() {
	r.engine.StartGame()
	r.BroadcastEngineUpdate("state", websocket.TextMessage, r.engine.GetStateJsonForPlayer)
}

func (r *Room) handleJoinGame(playerId string) {
	r.engine.AddPlayer(playerId, r.playerConns[playerId].name)
	r.BroadcastEngineUpdate("join", websocket.TextMessage, r.engine.GetPlayersJsonForPlayer)
}

func (r *Room) handlePlayerMove(msg GameMessage) {
	playerMove := game.PlayerMove{}
	err := json.Unmarshal(msg.Data, &playerMove)
	r.checkError(err)
	r.engine.ProcessMove(playerMove)
	r.BroadcastEngineUpdate("state", websocket.TextMessage, r.engine.GetStateJsonForPlayer)
	if r.engine.State.Phase == game.PhaseRoundOver {
		r.initAcks()
	}
}

func (r *Room) handlePlayerReadyAck(playerId string) {
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
	for playerId := range r.playerConns {
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

// func printMessages(messages map[string]json.RawMessage) {
// 	for pId, msg := range messages {
// 		fmt.Printf("%+v: %+v\n", pId, string(msg))
// 	}
// }

func (s *Server) checkOrigin(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	InfoLogger.Printf("Request from origin: %v\n", origin)
	return origin == s.config.allowedOrigins
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (r *Room) checkError(err error) error {
	if err == nil {
		return nil
	}
	if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure, websocket.CloseAbnormalClosure) {
		ErrorLogger.Printf("%v\n", err)
	} else if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
		InfoLogger.Printf("normal close: %v\n", err)
	} else {
		ErrorLogger.Printf("%v\n", err)
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
