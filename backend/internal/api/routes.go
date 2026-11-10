package api

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/geofence"
	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"github.com/vibhorsharma/geofence-backend/internal/location"
	"github.com/vibhorsharma/geofence-backend/internal/vehicle"
	"github.com/vibhorsharma/geofence-backend/internal/violation"
)

// RouterConfig holds dependencies required to register application routes.
type RouterConfig struct {
	Pool             *pgxpool.Pool
	GeofenceHandler  *geofence.Handler
	VehicleHandler   *vehicle.Handler
	LocationHandler  *location.Handler
	ViolationHandler *violation.Handler
}

type methodAndNotFoundInterceptor struct {
	http.ResponseWriter
	start       time.Time
	wroteHeader bool
	intercepted bool
}

func (w *methodAndNotFoundInterceptor) WriteHeader(statusCode int) {
	if !w.wroteHeader {
		w.wroteHeader = true
		if statusCode == http.StatusMethodNotAllowed {
			w.intercepted = true
			httpx.WriteError(w.ResponseWriter, http.StatusMethodNotAllowed, "method not allowed", w.start)
			return
		}
		if statusCode == http.StatusNotFound && w.Header().Get("Content-Type") == "" {
			w.intercepted = true
			httpx.WriteError(w.ResponseWriter, http.StatusNotFound, "route not found", w.start)
			return
		}
	}
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *methodAndNotFoundInterceptor) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.WriteHeader(http.StatusOK)
	}
	if w.intercepted {
		return len(b), nil
	}
	return w.ResponseWriter.Write(b)
}

// InterceptStandardHTTPStatus ensures that net/http generated 404 and 405 responses
// are transformed into standard JSON responses containing "time_ns".
func InterceptStandardHTTPStatus(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		interceptor := &methodAndNotFoundInterceptor{
			ResponseWriter: w,
			start:          start,
		}
		next.ServeHTTP(interceptor, r)
	})
}

// NewRouter builds and registers all API routes using Go 1.22+ ServeMux patterns.
func NewRouter(cfg RouterConfig) http.Handler {
	mux := http.NewServeMux()

	// 1. Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		dbStatus := "ok"

		if cfg.Pool != nil {
			pingCtx, pingCancel := context.WithTimeout(r.Context(), 2*time.Second)
			defer pingCancel()

			if err := cfg.Pool.Ping(pingCtx); err != nil {
				dbStatus = "down"
			}
		} else {
			dbStatus = "down"
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"db":     dbStatus,
		}, start)
	})

	// 2. Geofence endpoints (POST /geofences, GET /geofences)
	if cfg.GeofenceHandler != nil {
		mux.HandleFunc("POST /geofences", cfg.GeofenceHandler.Create)
		mux.HandleFunc("GET /geofences", cfg.GeofenceHandler.List)
	}

	// 3. Vehicle endpoints (POST /vehicles, GET /vehicles)
	if cfg.VehicleHandler != nil {
		mux.HandleFunc("POST /vehicles", cfg.VehicleHandler.Create)
		mux.HandleFunc("GET /vehicles", cfg.VehicleHandler.List)
	}

	// 4. Vehicle location endpoints (POST /vehicles/location, GET /vehicles/location/{vehicle_id})
	if cfg.LocationHandler != nil {
		mux.HandleFunc("POST /vehicles/location", cfg.LocationHandler.PostLocation)
		mux.HandleFunc("GET /vehicles/location/{vehicle_id}", cfg.LocationHandler.GetLocation)
	}

	// 5. Violation history endpoint (GET /violations/history)
	if cfg.ViolationHandler != nil {
		mux.HandleFunc("GET /violations/history", cfg.ViolationHandler.GetHistory)
	}

	// 6. Catch-all for unknown routes
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		httpx.WriteError(w, http.StatusNotFound, "route not found", start)
	})

	return InterceptStandardHTTPStatus(mux)
}
