package ws

import (
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = 30 * time.Second
	maxMessageSize = 512
	sendBufferSize = 256
	broadcastSize  = 1024
)

// Hub maintains the set of active connected WebSocket clients and broadcasts alert messages.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	quit       chan struct{}
	mu         sync.RWMutex
	upgrader   websocket.Upgrader
	closed     bool
}

// NewHub constructs a new WebSocket Hub with origin validation.
func NewHub(allowedOrigins []string) *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, broadcastSize),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		quit:       make(chan struct{}),
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				for _, o := range allowedOrigins {
					if o == "*" {
						return true
					}
				}
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}
				for _, o := range allowedOrigins {
					if strings.EqualFold(origin, o) {
						return true
					}
				}
				return false
			},
		},
	}
}

// Run executes the hub event loop in a dedicated goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if !h.closed {
				h.clients[client] = true
			}
			h.mu.Unlock()
			slog.Info("ws client connected", "clients_count", h.ClientCount())

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
			slog.Info("ws client disconnected", "clients_count", h.ClientCount())

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client protection: buffer is full, disconnect client
					slog.Warn("ws client send buffer full; disconnecting slow client")
					close(client.send)
					delete(h.clients, client)
					_ = client.conn.Close()
				}
			}
			h.mu.Unlock()

		case <-h.quit:
			h.mu.Lock()
			for client := range h.clients {
				close(client.send)
				_ = client.conn.WriteControl(
					websocket.CloseMessage,
					websocket.FormatCloseMessage(websocket.CloseNormalClosure, "server shutting down"),
					time.Now().Add(time.Second),
				)
				_ = client.conn.Close()
			}
			h.clients = make(map[*Client]bool)
			h.mu.Unlock()
			return
		}
	}
}

// Broadcast sends JSON payload bytes non-blockingly to all connected clients.
func (h *Hub) Broadcast(msg []byte) {
	h.mu.RLock()
	if h.closed {
		h.mu.RUnlock()
		return
	}
	h.mu.RUnlock()

	select {
	case h.broadcast <- msg:
	default:
		slog.Warn("ws hub broadcast channel full; dropping message")
	}
}

// ClientCount returns the number of currently connected WebSocket clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Close gracefully shuts down the hub and terminates client connections.
func (h *Hub) Close() {
	h.mu.Lock()
	if h.closed {
		h.mu.Unlock()
		return
	}
	h.closed = true
	h.mu.Unlock()
	close(h.quit)
}

// ServeWS handles incoming HTTP GET /ws/alerts requests and upgrades them to WebSocket connections.
func (h *Hub) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("ws upgrade failed", "error", err)
		return
	}

	client := &Client{
		hub:  h,
		conn: conn,
		send: make(chan []byte, sendBufferSize),
	}

	h.register <- client

	go client.writePump()
	go client.readPump()
}
