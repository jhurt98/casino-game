package main

import (
	"os"
    "net/http"
    "log"
)

func main() {
    // Serve static files from client/dist directory
    fs := http.FileServer(http.Dir("../client/dist"))
    http.Handle("/", fs)

	
	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}
    
    log.Println("Serving static files on :" + port)
    log.Fatal(http.ListenAndServe(":"+port, nil))
}
