package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vibhorsharma/geofence-backend/internal/alert"
	"github.com/vibhorsharma/geofence-backend/internal/geofence"
	"github.com/vibhorsharma/geofence-backend/internal/location"
	"github.com/vibhorsharma/geofence-backend/internal/vehicle"
	"github.com/vibhorsharma/geofence-backend/internal/violation"
	"github.com/vibhorsharma/geofence-backend/internal/ws"
)

func TestCatchAllNotFound(t *testing.T) {
	router := NewRouter(RouterConfig{})

	req := httptest.NewRequest(http.MethodGet, "/unknown/path", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if res["error"] != "route not found" {
		t.Errorf("expected error 'route not found', got %v", res["error"])
	}

	if _, ok := res["time_ns"].(string); !ok {
		t.Errorf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestMethodNotAllowedReturnsJSON(t *testing.T) {
	geofenceHandler := geofence.NewHandler(nil)
	vehicleHandler := vehicle.NewHandler(nil)

	router := NewRouter(RouterConfig{
		GeofenceHandler: geofenceHandler,
		VehicleHandler:  vehicleHandler,
	})

	// DELETE /geofences does not exist (only POST and GET do)
	req := httptest.NewRequest(http.MethodDelete, "/geofences", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if res["error"] != "method not allowed" {
		t.Errorf("expected error 'method not allowed', got %v", res["error"])
	}

	if _, ok := res["time_ns"].(string); !ok {
		t.Errorf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestHealthCheckIncludesWSClients(t *testing.T) {
	hub := ws.NewHub([]string{"*"})
	router := NewRouter(RouterConfig{
		WSHub: hub,
	})

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if res["status"] != "ok" {
		t.Errorf("expected status ok, got %v", res["status"])
	}
	if res["ws_clients"] == nil {
		t.Errorf("expected ws_clients key to be present in /health response")
	}
	if _, ok := res["time_ns"].(string); !ok {
		t.Errorf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestAllHandlersRegistered(t *testing.T) {
	router := NewRouter(RouterConfig{
		GeofenceHandler:  geofence.NewHandler(nil),
		VehicleHandler:   vehicle.NewHandler(nil),
		LocationHandler:  location.NewHandler(nil),
		ViolationHandler: violation.NewHandler(nil),
		AlertHandler:     alert.NewHandler(nil),
		WSHub:            ws.NewHub([]string{"*"}),
	})

	// Check that registered routes don't return 404 for methods that exist
	// (e.g. OPTIONS on registered paths or GET /alerts)
	req := httptest.NewRequest(http.MethodOptions, "/alerts", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Since mux has GET /alerts, net/http sets Allow header or returns 200/204 or 405 for wrong method, not 404
	if rec.Code == http.StatusNotFound {
		t.Errorf("expected route /alerts to be registered, but got 404")
	}
}
