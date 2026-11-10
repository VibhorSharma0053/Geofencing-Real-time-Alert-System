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

	"github.com/vibhorsharma/geofence-backend/internal/alert"
	"github.com/vibhorsharma/geofence-backend/internal/api"
	"github.com/vibhorsharma/geofence-backend/internal/config"
	"github.com/vibhorsharma/geofence-backend/internal/db"
	"github.com/vibhorsharma/geofence-backend/internal/geofence"
	"github.com/vibhorsharma/geofence-backend/internal/location"
	"github.com/vibhorsharma/geofence-backend/internal/middleware"
	"github.com/vibhorsharma/geofence-backend/internal/vehicle"
	"github.com/vibhorsharma/geofence-backend/internal/violation"
	"github.com/vibhorsharma/geofence-backend/internal/ws"
)

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

	// Initialize WebSocket hub for real-time alert broadcasts
	hub := ws.NewHub(cfg.AllowedOriginsList())
	go hub.Run()
	defer hub.Close()

	// Initialize Geofence layer
	geofenceStore := geofence.NewStore(pool)
	geofenceService := geofence.NewService(geofenceStore)
	geofenceHandler := geofence.NewHandler(geofenceService)

	// Initialize Vehicle layer
	vehicleStore := vehicle.NewStore(pool)
	vehicleService := vehicle.NewService(vehicleStore)
	vehicleHandler := vehicle.NewHandler(vehicleService)

	// Initialize Alert layer
	alertStore := alert.NewStore(pool)
	alertService := alert.NewService(alertStore)
	alertHandler := alert.NewHandler(alertService)

	// Initialize Alert Dispatcher (implements location.EventNotifier)
	dispatcher := alert.NewDispatcher(alertStore, hub)

	// Initialize Location layer wired to the alert Dispatcher
	locationStore := location.NewStore(pool)
	locationService := location.NewService(locationStore, dispatcher)
	locationHandler := location.NewHandler(locationService)

	// Initialize Violation layer
	violationStore := violation.NewStore(pool)
	violationService := violation.NewService(violationStore)
	violationHandler := violation.NewHandler(violationService)

	// Build router with Go 1.22+ ServeMux patterns
	router := api.NewRouter(api.RouterConfig{
		Pool:             pool,
		GeofenceHandler:  geofenceHandler,
		VehicleHandler:   vehicleHandler,
		LocationHandler:  locationHandler,
		ViolationHandler: violationHandler,
		AlertHandler:     alertHandler,
		WSHub:            hub,
	})

	// Initialize rate limiter for POST /vehicles/location
	rateLimiter := middleware.NewRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst)
	defer rateLimiter.Close()

	// Build hardened middleware chain:
	// Recovery -> RequestID -> Logger -> CORS -> Auth -> RateLimit -> Router
	var handler http.Handler = router
	handler = rateLimiter.Limit(handler)
	handler = middleware.Auth(cfg.APIKey, handler)
	handler = middleware.CORS(cfg.AllowedOriginsList(), handler)
	handler = middleware.Logger(handler)
	handler = middleware.RequestID(handler)
	handler = middleware.Recovery(handler)

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
		slog.Info("starting server", "port", cfg.Port, "auth_enabled", cfg.APIKey != "")
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
		hub.Close()
		rateLimiter.Close()
		pool.Close()
		slog.Info("server stopped gracefully")
	}
}
