package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/config"
	"github.com/vibhorsharma/geofence-backend/internal/db"
	"github.com/vibhorsharma/geofence-backend/internal/httpx"
)

// statusResponseWriter wraps http.ResponseWriter to capture HTTP status codes.
type statusResponseWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// loggingMiddleware logs incoming HTTP requests with method, path, status, and duration.
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusResponseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)
		duration := time.Since(start)

		slog.Info("http request",
			"method", r.Method,
			"path", r.URL.Path,
			"status", wrapped.status,
			"duration_ms", duration.Milliseconds(),
			"duration", duration.String(),
		)
	})
}

// corsMiddleware attaches basic CORS headers for frontend integration.
func corsMiddleware(allowedOrigins string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// Initialize structured JSON logging
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to PostgreSQL with retry/backoff up to 30s
	pool, err := db.Connect(ctx, cfg.DatabaseURL, 30*time.Second)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer pool.Close()

	// Apply embedded database migrations
	if err := db.RunMigrations(pool); err != nil {
		slog.Error("failed to run database migrations", "error", err)
		os.Exit(1)
	}

	// Initialize Go 1.22+ ServeMux
	mux := http.NewServeMux()

	// GET /health
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		dbStatus := "ok"

		pingCtx, pingCancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer pingCancel()

		if err := pool.Ping(pingCtx); err != nil {
			slog.Warn("health check database ping failed", "error", err)
			dbStatus = "down"
		}

		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"status": "ok",
			"db":     dbStatus,
		}, start)
	})

	// Wrap handler with logging and CORS middlewares
	handler := loggingMiddleware(corsMiddleware(cfg.AllowedOrigins, mux))

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", cfg.Port),
		Handler:      handler,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown handling
	serverErrors := make(chan error, 1)
	go func() {
		slog.Info("starting server", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrors <- err
		}
	}()

	shutdown := make(chan os.Signal, 1)
	signal.Notify(shutdown, os.Interrupt, syscall.SIGTERM)

	select {
	case err := <-serverErrors:
		slog.Error("server startup error", "error", err)
		os.Exit(1)
	case sig := <-shutdown:
		slog.Info("shutdown signal received", "signal", sig.String())
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			slog.Error("graceful server shutdown failed", "error", err)
			_ = server.Close()
		}
		slog.Info("server stopped gracefully")
	}
}
