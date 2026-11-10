package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/vibhorsharma/geofence-backend/internal/geofence"
	"github.com/vibhorsharma/geofence-backend/internal/vehicle"
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
