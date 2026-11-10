package vehicle

import (
	"context"
	"strings"
	"testing"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

type mockStore struct {
	createErr  error
	listResult []models.Vehicle
	listErr    error
	getByIDRes *models.Vehicle
	getByIDErr error
}

func (m *mockStore) Create(ctx context.Context, v *models.Vehicle) error {
	return m.createErr
}

func (m *mockStore) List(ctx context.Context) ([]models.Vehicle, error) {
	return m.listResult, m.listErr
}

func (m *mockStore) GetByID(ctx context.Context, id string) (*models.Vehicle, error) {
	return m.getByIDRes, m.getByIDErr
}

func TestVehicleCreateValidation(t *testing.T) {
	store := &mockStore{}
	svc := NewService(store)
	ctx := context.Background()

	t.Run("missing all fields returns multiple errors", func(t *testing.T) {
		req := models.CreateVehicleRequest{}
		_, err := svc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected error, got nil")
		}

		valErr, ok := err.(*apperror.ValidationError)
		if !ok {
			t.Fatalf("expected ValidationError, got %T", err)
		}

		if len(valErr.Details) != 4 {
			t.Errorf("expected 4 validation errors for 4 empty fields, got %d: %v", len(valErr.Details), valErr.Details)
		}
	})

	t.Run("invalid phone format rejected", func(t *testing.T) {
		invalidPhones := []string{
			"12345",         // too short (< 7 chars)
			"abc-123-4567",  // contains letters
			"+++---()",      // no numeric digits
			"123456789012345678901", // > 20 chars
		}

		for _, p := range invalidPhones {
			req := models.CreateVehicleRequest{
				VehicleNumber: "KA-01-AB-1234",
				DriverName:    "John Doe",
				VehicleType:   "Van",
				Phone:         p,
			}
			_, err := svc.Create(ctx, req)
			if err == nil {
				t.Errorf("expected phone %q to fail validation, but succeeded", p)
			}
		}
	})

	t.Run("valid phones accepted", func(t *testing.T) {
		validPhones := []string{
			"+1-555-123-4567",
			"+91 98765 43210",
			"(555) 123-4567",
			"9876543210",
		}

		for _, p := range validPhones {
			req := models.CreateVehicleRequest{
				VehicleNumber: "KA-01-AB-1234",
				DriverName:    "John Doe",
				VehicleType:   "Van",
				Phone:         p,
			}
			res, err := svc.Create(ctx, req)
			if err != nil {
				t.Errorf("expected phone %q to succeed, got error: %v", p, err)
			}
			if res == nil || res.VehicleNumber != "KA-01-AB-1234" {
				t.Errorf("unexpected response: %v", res)
			}
		}
	})

	t.Run("normalizes vehicle_number to uppercase", func(t *testing.T) {
		req := models.CreateVehicleRequest{
			VehicleNumber: "  ka-01-ab-1234  ",
			DriverName:    "John Doe",
			VehicleType:   "Van",
			Phone:         "+1-555-123-4567",
		}
		res, err := svc.Create(ctx, req)
		if err != nil {
			t.Fatalf("expected success, got error: %v", err)
		}
		if res.VehicleNumber != "KA-01-AB-1234" {
			t.Errorf("expected normalized vehicle number 'KA-01-AB-1234', got %q", res.VehicleNumber)
		}
	})

	t.Run("propagates conflict error on duplicate vehicle_number", func(t *testing.T) {
		conflictStore := &mockStore{
			createErr: apperror.NewConflictError("vehicle_number already exists"),
		}
		conflictSvc := NewService(conflictStore)

		req := models.CreateVehicleRequest{
			VehicleNumber: "KA-01-AB-1234",
			DriverName:    "John Doe",
			VehicleType:   "Van",
			Phone:         "+1-555-123-4567",
		}
		_, err := conflictSvc.Create(ctx, req)
		if err == nil {
			t.Fatal("expected conflict error, got nil")
		}
		conflictErr, ok := err.(*apperror.ConflictError)
		if !ok {
			t.Fatalf("expected ConflictError, got %T (%v)", err, err)
		}
		if !strings.Contains(conflictErr.Message, "vehicle_number already exists") {
			t.Errorf("unexpected error message: %s", conflictErr.Message)
		}
	})
}
