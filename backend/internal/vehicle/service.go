package vehicle

import (
	"context"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/ids"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

var phoneRegex = regexp.MustCompile(`^[0-9+\s\-()]{7,20}$`)

// Service defines the business logic interface for vehicles.
type Service interface {
	Create(ctx context.Context, req models.CreateVehicleRequest) (*models.CreateVehicleResponse, error)
	List(ctx context.Context, limitStr, offsetStr string) ([]models.Vehicle, *int64, error)
	GetByID(ctx context.Context, id string) (*models.Vehicle, error)
}

type service struct {
	store Store
}

// NewService constructs a new vehicle Service.
func NewService(store Store) Service {
	return &service{store: store}
}

// Create validates all required vehicle fields, normalizes the vehicle number, and persists the vehicle.
func (s *service) Create(ctx context.Context, req models.CreateVehicleRequest) (*models.CreateVehicleResponse, error) {
	var details []string

	vehicleNumber := strings.TrimSpace(req.VehicleNumber)
	if vehicleNumber == "" {
		details = append(details, "vehicle_number is required and must not be empty")
	}

	driverName := strings.TrimSpace(req.DriverName)
	if driverName == "" {
		details = append(details, "driver_name is required and must not be empty")
	}

	vehicleType := strings.TrimSpace(req.VehicleType)
	if vehicleType == "" {
		details = append(details, "vehicle_type is required and must not be empty")
	}

	phone := strings.TrimSpace(req.Phone)
	if phone == "" {
		details = append(details, "phone is required and must not be empty")
	} else if !isValidPhone(phone) {
		details = append(details, "phone must be 7-20 characters containing digits, +, spaces, dashes, or parentheses")
	}

	if len(details) > 0 {
		return nil, apperror.NewValidationError("validation failed", details...)
	}

	// Normalize vehicle number for case-insensitive uniqueness
	normalizedNumber := strings.ToUpper(vehicleNumber)

	id := ids.New(ids.PrefixVehicle)
	now := time.Now().UTC()

	v := &models.Vehicle{
		ID:            id,
		VehicleNumber: normalizedNumber,
		DriverName:    driverName,
		VehicleType:   vehicleType,
		Phone:         phone,
		Status:        models.StatusActive,
		CreatedAt:     now,
	}

	if err := s.store.Create(ctx, v); err != nil {
		return nil, err
	}

	return &models.CreateVehicleResponse{
		ID:            v.ID,
		VehicleNumber: v.VehicleNumber,
		Status:        v.Status,
	}, nil
}

// List retrieves all vehicles with optional limit/offset pagination.
func (s *service) List(ctx context.Context, limitStr, offsetStr string) ([]models.Vehicle, *int64, error) {
	var limitPtr, offsetPtr *int
	isPaginated := false

	if lStr := strings.TrimSpace(limitStr); lStr != "" {
		isPaginated = true
		l, err := strconv.Atoi(lStr)
		if err != nil || l < 1 {
			return nil, nil, apperror.NewBadRequestError("limit must be a positive integer greater than 0")
		}
		if l > 500 {
			l = 500
		}
		limitPtr = &l
	}

	if oStr := strings.TrimSpace(offsetStr); oStr != "" {
		isPaginated = true
		o, err := strconv.Atoi(oStr)
		if err != nil || o < 0 {
			return nil, nil, apperror.NewBadRequestError("offset must be a non-negative integer")
		}
		offsetPtr = &o
	}

	if isPaginated {
		if limitPtr == nil {
			defaultLimit := 50
			limitPtr = &defaultLimit
		}
		if offsetPtr == nil {
			defaultOffset := 0
			offsetPtr = &defaultOffset
		}
	}

	vehicles, totalCount, err := s.store.List(ctx, limitPtr, offsetPtr)
	if err != nil {
		return nil, nil, err
	}

	if !isPaginated {
		return vehicles, nil, nil
	}

	return vehicles, &totalCount, nil
}

// GetByID retrieves a vehicle by ID.
func (s *service) GetByID(ctx context.Context, id string) (*models.Vehicle, error) {
	cleanID := strings.TrimSpace(id)
	if cleanID == "" {
		return nil, apperror.NewBadRequestError("vehicle_id must not be empty")
	}
	return s.store.GetByID(ctx, cleanID)
}

// isValidPhone validates that a phone string matches the allowed characters and length,
// and contains at least 7 actual numeric digits.
func isValidPhone(phone string) bool {
	if !phoneRegex.MatchString(phone) {
		return false
	}
	digitCount := 0
	for _, r := range phone {
		if unicode.IsDigit(r) {
			digitCount++
		}
	}
	return digitCount >= 7
}
