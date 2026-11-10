package middleware

import (
	"crypto/subtle"
	"net/http"
	"strings"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
)

// Auth verifies the X-API-Key header or ?api_key= query parameter when apiKey is configured.
// When apiKey is empty, authentication is disabled. Bypasses GET /health and OPTIONS.
func Auth(apiKey string, next http.Handler) http.Handler {
	if apiKey == "" {
		return next
	}

	expectedKeyBytes := []byte(apiKey)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		// Bypass health check
		if r.Method == http.MethodGet && r.URL.Path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		// Bypass preflight OPTIONS
		if r.Method == http.MethodOptions {
			next.ServeHTTP(w, r)
			return
		}

		var providedKey string
		if strings.HasPrefix(r.URL.Path, "/ws/") {
			// WebSocket endpoint: check query param first, fallback to header
			providedKey = r.URL.Query().Get("api_key")
		}
		if providedKey == "" {
			providedKey = r.Header.Get("X-API-Key")
		}

		if providedKey == "" || subtle.ConstantTimeCompare([]byte(providedKey), expectedKeyBytes) != 1 {
			httpx.WriteError(w, http.StatusUnauthorized, "unauthorized: invalid or missing API key", start)
			return
		}

		next.ServeHTTP(w, r)
	})
}
