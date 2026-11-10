package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	t.Run("auth disabled when apiKey is empty", func(t *testing.T) {
		handler := Auth("", dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/vehicles", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 when auth disabled, got %d", rec.Code)
		}
	})

	t.Run("missing key returns 401 JSON with time_ns", func(t *testing.T) {
		handler := Auth("secret-key", dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/vehicles", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 Unauthorized, got %d", rec.Code)
		}

		var res map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to parse json error: %v", err)
		}
		if res["error"] != "unauthorized: invalid or missing API key" {
			t.Errorf("unexpected error message: %v", res["error"])
		}
		if _, ok := res["time_ns"].(string); !ok {
			t.Errorf("expected time_ns string, got %v", res["time_ns"])
		}
	})

	t.Run("valid key passes", func(t *testing.T) {
		handler := Auth("secret-key", dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/vehicles", nil)
		req.Header.Set("X-API-Key", "secret-key")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 with valid key, got %d", rec.Code)
		}
	})

	t.Run("GET /health bypasses auth", func(t *testing.T) {
		handler := Auth("secret-key", dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for health check without key, got %d", rec.Code)
		}
	})

	t.Run("OPTIONS preflight bypasses auth", func(t *testing.T) {
		handler := Auth("secret-key", dummyHandler)
		req := httptest.NewRequest(http.MethodOptions, "/vehicles", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for OPTIONS without key, got %d", rec.Code)
		}
	})

	t.Run("WebSocket accepts query param api_key", func(t *testing.T) {
		handler := Auth("secret-key", dummyHandler)
		req := httptest.NewRequest(http.MethodGet, "/ws/alerts?api_key=secret-key", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for websocket with query param api_key, got %d", rec.Code)
		}
	})
}
