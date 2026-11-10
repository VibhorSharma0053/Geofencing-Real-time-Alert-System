package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRecoveryMiddleware(t *testing.T) {
	panickingHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("simulated catastrophic panic")
	})

	handler := Recovery(panickingHandler)
	req := httptest.NewRequest(http.MethodGet, "/fail", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("expected 500 Internal Server Error, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json error: %v", err)
	}
	if res["error"] != "internal server error" {
		t.Errorf("expected 'internal server error', got %v", res["error"])
	}
	if _, ok := res["time_ns"].(string); !ok {
		t.Errorf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestRequestIDMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := GetRequestID(r.Context())
		if reqID == "" {
			t.Errorf("expected request id in context, got empty")
		}
		w.WriteHeader(http.StatusOK)
	})

	handler := RequestID(dummyHandler)

	t.Run("generates request id when absent", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Header().Get(HeaderRequestID) == "" {
			t.Errorf("expected X-Request-ID response header")
		}
	})

	t.Run("preserves client supplied request id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set(HeaderRequestID, "custom-req-12345")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Header().Get(HeaderRequestID) != "custom-req-12345" {
			t.Errorf("expected custom-req-12345, got %q", rec.Header().Get(HeaderRequestID))
		}
	})
}

func TestCORSMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := CORS([]string{"http://localhost:5173"}, dummyHandler)

	t.Run("OPTIONS preflight returns 204", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodOptions, "/geofences", nil)
		req.Header.Set("Origin", "http://localhost:5173")
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		if rec.Code != http.StatusNoContent {
			t.Fatalf("expected 204 No Content for preflight, got %d", rec.Code)
		}
		if rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:5173" {
			t.Errorf("expected origin http://localhost:5173, got %q", rec.Header().Get("Access-Control-Allow-Origin"))
		}
	})
}
