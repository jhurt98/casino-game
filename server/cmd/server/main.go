package main

import (
	"game-server/internal/server"
)

func main() {
	s := server.NewServer()
	s.Start()
}
