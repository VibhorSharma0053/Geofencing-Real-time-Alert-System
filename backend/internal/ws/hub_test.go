package ws

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestHubBroadcastAndDisconnect(t *testing.T) {
	hub := NewHub([]string{"*"})
	go hub.Run()
	defer hub.Close()

	server := httptest.NewServer(http.HandlerFunc(hub.ServeWS))
	defer server.Close()

	wsURL := "ws" + strings.TrimPrefix(server.URL, "http")

	// Connect Client 1
	c1, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect client 1: %v", err)
	}
	defer c1.Close()

	// Connect Client 2
	c2, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		t.Fatalf("failed to connect client 2: %v", err)
	}
	defer c2.Close()

	// Wait for registrations to settle
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 2 {
		t.Fatalf("expected 2 clients connected, got %d", count)
	}

	// Broadcast test payload
	testMsg := `{"event_id":"evt_test","event_type":"entry"}`
	hub.Broadcast([]byte(testMsg))

	// Verify Client 1 receives the message
	_ = c1.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg1, err := c1.ReadMessage()
	if err != nil {
		t.Fatalf("client 1 failed to read message: %v", err)
	}
	if string(msg1) != testMsg {
		t.Errorf("client 1 received %q, want %q", string(msg1), testMsg)
	}

	// Verify Client 2 receives the message
	_ = c2.SetReadDeadline(time.Now().Add(2 * time.Second))
	_, msg2, err := c2.ReadMessage()
	if err != nil {
		t.Fatalf("client 2 failed to read message: %v", err)
	}
	if string(msg2) != testMsg {
		t.Errorf("client 2 received %q, want %q", string(msg2), testMsg)
	}

	// Disconnect Client 1
	_ = c1.Close()

	// Wait for unregistration
	time.Sleep(50 * time.Millisecond)

	if count := hub.ClientCount(); count != 1 {
		t.Errorf("expected 1 client connected after c1 disconnect, got %d", count)
	}
}
