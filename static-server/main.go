package main

import (
    "net/http"
    "log"
)

func main() {
    // Serve static files from client/dist directory
    fs := http.FileServer(http.Dir("../client/dist"))
    http.Handle("/", fs)
    
    log.Println("Serving static files on :3000")
    log.Fatal(http.ListenAndServe(":3000", nil))
}
