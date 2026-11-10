package location

import (
	"context"
	"math"
	"sync"
	"testing"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

type mockStore struct {
	recordResult *LocationUpdateResult
	recordErr    error
	getLocResult *models.GetVehicleLocationResponse
	getLocErr    error
}

func (m *mockStore) RecordLocationAndDiff(ctx context.Context, params LocationUpdateParams) (*LocationUpdateResult, error) {
	return m.recordResult, m.recordErr
}

func (m *mockStore) GetVehicleLocation(ctx context.Context, vehicleID string) (*models.GetVehicleLocationResponse, error) {
	return m.getLocResult, m.getLocErr
}

type recordingNotifier struct {
	mu            sync.Mutex
	notifications []EventNotification
}

func (r *recordingNotifier) Notify(ctx context.Context, n EventNotification) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.notifications = append(r.notifications, n)
}

func (r *recordingNotifier) count() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return len(r.notifications)
}

func TestRecordLocationValidation(t *testing.T) {
	store := &mockStore{}
	svc := NewService(store, nil)
	ctx := context.Background()

	t.Run("missing all required fields returns validation details", func(t *testing.T) {
		req := models.PostLocationRequest{}
		_, err := svc.RecordLocation(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T", err)
		}

		if len(valErr.Details) != 4 {
			t.Errorf("expected 4 validation errors (vehicle_id, lat, lng, timestamp), got %d: %v", len(valErr.Details), valErr.Details)
		}
	})

	t.Run("zero coordinates are valid and not treated as missing", func(t *testing.T) {
		store := &mockStore{
			recordResult: &LocationUpdateResult{
				VehicleID:        "veh_123",
				CurrentGeofences: []models.CurrentGeofenceStatus{},
			},
		}
		svc := NewService(store, nil)

		lat := 0.0
		lng := 0.0
		req := models.PostLocationRequest{
			VehicleID: "veh_123",
			Latitude:  &lat,
			Longitude: &lng,
			Timestamp: "2026-11-10T12:00:00Z",
		}
		res, err := svc.RecordLocation(ctx, req)
		if err != nil {
			t.Fatalf("expected success with 0,0 coordinates, got error: %v", err)
		}
		if res.VehicleID != "veh_123" {
			t.Errorf("expected veh_123, got %s", res.VehicleID)
		}
	})

	t.Run("out of range coordinates rejected", func(t *testing.T) {
		invalidLat := 95.0
		invalidLng := -185.0
		req := models.PostLocationRequest{
			VehicleID: "veh_123",
			Latitude:  &invalidLat,
			Longitude: &invalidLng,
			Timestamp: "2026-11-10T12:00:00Z",
		}
		_, err := svc.RecordLocation(ctx, req)
		if err == nil {
			t.Fatal("expected coordinate range error, got nil")
		}
	})

	t.Run("NaN and infinite coordinates rejected", func(t *testing.T) {
		nanVal := math.NaN()
		infVal := math.Inf(1)
		req := models.PostLocationRequest{
			VehicleID: "veh_123",
			Latitude:  &nanVal,
			Longitude: &infVal,
			Timestamp: "2026-11-10T12:00:00Z",
		}
		_, err := svc.RecordLocation(ctx, req)
		if err == nil {
			t.Fatal("expected NaN/Inf rejection, got nil")
		}
	})

	t.Run("invalid timestamp rejected", func(t *testing.T) {
		lat := 37.77
		lng := -122.41
		req := models.PostLocationRequest{
			VehicleID: "veh_123",
			Latitude:  &lat,
			Longitude: &lng,
			Timestamp: "not-a-timestamp",
		}
		_, err := svc.RecordLocation(ctx, req)
		if err == nil {
			t.Fatal("expected timestamp error, got nil")
		}
	})
}

func TestAsyncNotifierCalled(t *testing.T) {
	notifier := &recordingNotifier{}
	store := &mockStore{
		recordResult: &LocationUpdateResult{
			VehicleID:     "veh_abc123",
			VehicleNumber: "KA-01-AB-1234",
			DriverName:    "John Doe",
			CurrentGeofences: []models.CurrentGeofenceStatus{
				{GeofenceID: "geo_1", GeofenceName: "Zone 1", Status: "inside"},
			},
			DetectedEvents: []DetectedEvent{
				{
					ViolationID:  "viol_001",
					GeofenceID:   "geo_1",
					GeofenceName: "Zone 1",
					Category:     "delivery_zone",
					EventType:    "entry",
					Timestamp:    time.Now().UTC(),
				},
			},
		},
	}

	svc := NewService(store, notifier)
	lat := 37.7749
	lng := -122.4194
	req := models.PostLocationRequest{
		VehicleID: "veh_abc123",
		Latitude:  &lat,
		Longitude: &lng,
		Timestamp: "2026-11-10T12:00:00Z",
	}

	res, err := svc.RecordLocation(context.Background(), req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if !res.LocationUpdated {
		t.Errorf("expected location_updated to be true")
	}

	// Wait briefly for asynchronous notification goroutine
	time.Sleep(50 * time.Millisecond)

	if notifier.count() != 1 {
		t.Errorf("expected 1 notification fired, got %d", notifier.count())
	}
}

func TestGetVehicleLocation(t *testing.T) {
	ctx := context.Background()

	t.Run("empty vehicle id returns 400", func(t *testing.T) {
		svc := NewService(&mockStore{}, nil)
		_, err := svc.GetVehicleLocation(ctx, "   ")
		if err == nil {
			t.Fatal("expected error for empty vehicle id, got nil")
		}
	})

	t.Run("never reported location returns null location and empty geofences", func(t *testing.T) {
		store := &mockStore{
			getLocResult: &models.GetVehicleLocationResponse{
				VehicleID:        "veh_new",
				VehicleNumber:    "KA-01-NEW",
				CurrentLocation:  nil,
				CurrentGeofences: []models.VehicleGeofenceDetail{},
			},
		}
		svc := NewService(store, nil)

		res, err := svc.GetVehicleLocation(ctx, "veh_new")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if res.CurrentLocation != nil {
			t.Errorf("expected current_location to be nil, got %v", res.CurrentLocation)
		}
		if len(res.CurrentGeofences) != 0 {
			t.Errorf("expected 0 current geofences, got %d", len(res.CurrentGeofences))
		}
	})
}
