package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRateLimiter(t *testing.T) {
	// Create rate limiter with 1 rps and burst of 2
	rl := NewRateLimiter(1, 2)
	defer rl.Close()

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	handler := rl.Limit(dummyHandler)

	t.Run("burst allowed then blocked with 429", func(t *testing.T) {
		for i := 0; i < 2; i++ {
			req := httptest.NewRequest(http.MethodPost, "/vehicles/location", nil)
			req.RemoteAddr = "192.168.1.1:12345"
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("request %d expected status 200, got %d", i+1, rec.Code)
			}
		}

		// 3rd immediate request exceeds burst
		req := httptest.NewRequest(http.MethodPost, "/vehicles/location", nil)
		req.RemoteAddr = "192.168.1.1:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusTooManyRequests {
			t.Fatalf("expected 429 Too Many Requests, got %d", rec.Code)
		}

		if rec.Header().Get("Retry-After") != "1" {
			t.Errorf("expected Retry-After: 1, got %q", rec.Header().Get("Retry-After"))
		}

		var res map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
			t.Fatalf("failed to parse json response: %v", err)
		}
		if res["error"] != "rate limit exceeded" {
			t.Errorf("expected error 'rate limit exceeded', got %v", res["error"])
		}
		if _, ok := res["time_ns"].(string); !ok {
			t.Errorf("expected time_ns string, got %v", res["time_ns"])
		}
	})

	t.Run("different IP has independent limit", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/vehicles/location", nil)
		req.RemoteAddr = "192.168.1.2:12345"
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("expected 200 for new client IP, got %d", rec.Code)
		}
	})

	t.Run("X-Forwarded-For first IP respected", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/vehicles/location", nil)
		req.RemoteAddr = "10.0.0.1:12345"
		req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")
		ip := GetClientIP(req)
		if ip != "203.0.113.195" {
			t.Errorf("expected 203.0.113.195, got %q", ip)
		}
	})

	t.Run("other routes are not rate-limited", func(t *testing.T) {
		for i := 0; i < 5; i++ {
			req := httptest.NewRequest(http.MethodGet, "/vehicles", nil)
			req.RemoteAddr = "192.168.1.1:12345"
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusOK {
				t.Fatalf("GET /vehicles should not be rate limited; got %d", rec.Code)
			}
		}
	})
}
