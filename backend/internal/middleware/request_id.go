package middleware

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
)

type contextKey string

// RequestIDContextKey is the key under which request IDs are stored in context.
const RequestIDContextKey contextKey = "request_id"

// HeaderRequestID is the HTTP header for request correlation.
const HeaderRequestID = "X-Request-ID"

// GetRequestID retrieves the request ID string from context.
func GetRequestID(ctx context.Context) string {
	if val, ok := ctx.Value(RequestIDContextKey).(string); ok {
		return val
	}
	return ""
}

// RequestID inspects or generates an X-Request-ID header and injects it into context.
func RequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := strings.TrimSpace(r.Header.Get(HeaderRequestID))
		if reqID == "" {
			var b [6]byte
			_, _ = rand.Read(b[:])
			reqID = "req_" + hex.EncodeToString(b[:])
		}

		w.Header().Set(HeaderRequestID, reqID)
		ctx := context.WithValue(r.Context(), RequestIDContextKey, reqID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
