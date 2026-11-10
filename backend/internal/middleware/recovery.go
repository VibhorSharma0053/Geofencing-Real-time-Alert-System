package middleware

import (
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
)

// Recovery catches downstream panics, logs stack traces with the request ID, and writes a 500 JSON error.
func Recovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		defer func() {
			if rec := recover(); rec != nil {
				reqID := GetRequestID(r.Context())
				slog.Error("panic recovered in HTTP handler",
					"request_id", reqID,
					"panic", rec,
					"stack", string(debug.Stack()),
				)
				httpx.WriteError(w, http.StatusInternalServerError, "internal server error", start)
			}
		}()
		next.ServeHTTP(w, r)
	})
}
