package geofence

import (
	"context"
	"math"
	"strings"
	"testing"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

type mockStore struct {
	validGeometry bool
	validateErr   error
	createErr     error
	listResult    []models.Geofence
	listErr       error
}

func (m *mockStore) ValidateGeometry(ctx context.Context, wkt string) (bool, error) {
	return m.validGeometry, m.validateErr
}

func (m *mockStore) Create(ctx context.Context, g *models.Geofence, wkt string) error {
	return m.createErr
}

func (m *mockStore) List(ctx context.Context, category string) ([]models.Geofence, error) {
	return m.listResult, m.listErr
}

func TestServiceCreateValidation(t *testing.T) {
	store := &mockStore{validGeometry: true}
	svc := NewService(store)
	ctx := context.Background()

	t.Run("missing all required fields returns multiple errors", func(t *testing.T) {
		req := models.CreateGeofenceRequest{}
		_, err := svc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T (%v)", err, err)
		}

		if len(valErr.Details) < 3 {
			t.Errorf("expected at least 3 validation details, got %d: %v", len(valErr.Details), valErr.Details)
		}
	})

	t.Run("invalid category", func(t *testing.T) {
		req := models.CreateGeofenceRequest{
			Name:     "Zone A",
			Category: "invalid_category",
			Coordinates: []models.Coordinate{
				{0, 0}, {0, 1}, {1, 1}, {0, 0},
			},
		}
		_, err := svc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T", err)
		}
		found := false
		for _, d := range valErr.Details {
			if strings.Contains(d, "category is required") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected category error detail, got: %v", valErr.Details)
		}
	})

	t.Run("unclosed polygon coordinates", func(t *testing.T) {
		req := models.CreateGeofenceRequest{
			Name:     "Zone A",
			Category: models.CategoryDeliveryZone,
			Coordinates: []models.Coordinate{
				{0, 0}, {0, 1}, {1, 1}, {1, 0}, // not closed!
			},
		}
		_, err := svc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T", err)
		}
		found := false
		for _, d := range valErr.Details {
			if strings.Contains(d, "identical") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected unclosed polygon error, got: %v", valErr.Details)
		}
	})

	t.Run("coordinates with NaN or Inf", func(t *testing.T) {
		req := models.CreateGeofenceRequest{
			Name:     "Zone A",
			Category: models.CategoryDeliveryZone,
			Coordinates: []models.Coordinate{
				{math.NaN(), 0}, {0, 1}, {1, 1}, {math.NaN(), 0},
			},
		}
		_, err := svc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T", err)
		}
		found := false
		for _, d := range valErr.Details {
			if strings.Contains(d, "NaN or infinite") {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("expected NaN error detail, got: %v", valErr.Details)
		}
	})

	t.Run("self-intersecting or invalid geometry rejected", func(t *testing.T) {
		invalidStore := &mockStore{validGeometry: false}
		invalidSvc := NewService(invalidStore)

		req := models.CreateGeofenceRequest{
			Name:     "Invalid Zone",
			Category: models.CategoryDeliveryZone,
			Coordinates: []models.Coordinate{
				{0, 0}, {1, 1}, {0, 1}, {1, 0}, {0, 0},
			},
		}
		_, err := invalidSvc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		badReqErr, ok := err.(*apperror.BadRequestError)
		if !ok {
			t.Fatalf("expected BadRequestError, got %T (%v)", err, err)
		}
		if !strings.Contains(badReqErr.Message, "polygon is not valid (self-intersecting or zero area)") {
			t.Errorf("unexpected error message: %s", badReqErr.Message)
		}
	})

	t.Run("valid creation returns 201 response data", func(t *testing.T) {
		req := models.CreateGeofenceRequest{
			Name:     "Valid Zone",
			Category: models.CategoryDeliveryZone,
			Coordinates: []models.Coordinate{
				{37.7749, -122.4194},
				{37.7750, -122.4180},
				{37.7740, -122.4180},
				{37.7749, -122.4194},
			},
		}
		res, err := svc.Create(ctx, req)
		if err != nil {
			t.Fatalf("expected success, got error: %v", err)
		}
		if !strings.HasPrefix(res.ID, "geo_") {
			t.Errorf("expected id to start with geo_, got %s", res.ID)
		}
		if res.Name != "Valid Zone" {
			t.Errorf("expected name 'Valid Zone', got %s", res.Name)
		}
		if res.Status != "active" {
			t.Errorf("expected status 'active', got %s", res.Status)
		}
	})
}

func TestBuildWKT(t *testing.T) {
	coords := []models.Coordinate{
		{37.7749, -122.4194},
		{37.7750, -122.4180},
		{37.7740, -122.4180},
		{37.7749, -122.4194},
	}
	wkt := buildWKT(coords)
	expectedPrefix := "POLYGON((-122.4194 37.7749, -122.418 37.775, -122.418 37.774, -122.4194 37.7749))"
	if wkt != expectedPrefix {
		t.Errorf("wkt mismatch.\nGot:  %s\nWant: %s", wkt, expectedPrefix)
	}
}
