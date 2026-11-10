package location

import (
	"context"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Service defines the business logic interface for vehicle location tracking and geofence evaluation.
type Service interface {
	RecordLocation(ctx context.Context, req models.PostLocationRequest) (*models.PostLocationResponse, error)
	GetVehicleLocation(ctx context.Context, vehicleID string) (*models.GetVehicleLocationResponse, error)
}

type service struct {
	store    Store
	notifier EventNotifier
}

// NewService constructs a new location Service with its store and event notifier.
func NewService(store Store, notifier EventNotifier) Service {
	if notifier == nil {
		notifier = NewNoopNotifier()
	}
	return &service{
		store:    store,
		notifier: notifier,
	}
}

// RecordLocation validates location payload, processes containment & diffs, and fires async alerts.
func (s *service) RecordLocation(ctx context.Context, req models.PostLocationRequest) (*models.PostLocationResponse, error) {
	var details []string

	vehicleID := strings.TrimSpace(req.VehicleID)
	if vehicleID == "" {
		details = append(details, "vehicle_id is required and must not be empty")
	}

	if req.Latitude == nil {
		details = append(details, "latitude is required")
	} else if math.IsNaN(*req.Latitude) || math.IsInf(*req.Latitude, 0) {
		details = append(details, "latitude must not be NaN or infinite")
	} else if *req.Latitude < -90.0 || *req.Latitude > 90.0 {
		details = append(details, "latitude must be between -90 and 90")
	}

	if req.Longitude == nil {
		details = append(details, "longitude is required")
	} else if math.IsNaN(*req.Longitude) || math.IsInf(*req.Longitude, 0) {
		details = append(details, "longitude must not be NaN or infinite")
	} else if *req.Longitude < -180.0 || *req.Longitude > 180.0 {
		details = append(details, "longitude must be between -180 and 180")
	}

	var parsedTime time.Time
	rawTime := strings.TrimSpace(req.Timestamp)
	if rawTime == "" {
		details = append(details, "timestamp is required")
	} else {
		var err error
		parsedTime, err = time.Parse(time.RFC3339Nano, rawTime)
		if err != nil {
			parsedTime, err = time.Parse(time.RFC3339, rawTime)
		}
		if err != nil {
			details = append(details, "timestamp must be a valid ISO 8601 / RFC3339 string")
		} else {
			parsedTime = parsedTime.UTC()
		}
	}

	if len(details) > 0 {
		return nil, apperror.NewValidationError("validation failed", details...)
	}

	// Update location and calculate containment state in atomic transaction
	result, err := s.store.RecordLocationAndDiff(ctx, LocationUpdateParams{
		VehicleID: vehicleID,
		Latitude:  *req.Latitude,
		Longitude: *req.Longitude,
		Timestamp: parsedTime,
	})
	if err != nil {
		return nil, err
	}

	// Asynchronously fire notifier outside the HTTP transaction context
	if len(result.DetectedEvents) > 0 {
		detectedEvents := result.DetectedEvents
		vehInfo := VehicleInfo{
			ID:            result.VehicleID,
			VehicleNumber: result.VehicleNumber,
			DriverName:    result.DriverName,
		}
		locInfo := LocationInfo{
			Latitude:  *req.Latitude,
			Longitude: *req.Longitude,
		}

		go func() {
			defer func() {
				if r := recover(); r != nil {
					slog.Error("recovered panic in event notifier goroutine", "panic", r)
				}
			}()

			notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()

			s.notifier.Notify(notifyCtx, EventNotification{
				Vehicle:  vehInfo,
				Events:   detectedEvents,
				Location: locInfo,
			})
		}()
	}

	currentGeofs := result.CurrentGeofences
	if currentGeofs == nil {
		currentGeofs = make([]models.CurrentGeofenceStatus, 0)
	}

	return &models.PostLocationResponse{
		VehicleID:        result.VehicleID,
		LocationUpdated:  true,
		CurrentGeofences: currentGeofs,
	}, nil
}

// GetVehicleLocation retrieves current location and active geofences for a vehicle.
func (s *service) GetVehicleLocation(ctx context.Context, vehicleID string) (*models.GetVehicleLocationResponse, error) {
	cleanID := strings.TrimSpace(vehicleID)
	if cleanID == "" {
		return nil, apperror.NewBadRequestError("vehicle_id must not be empty")
	}

	res, err := s.store.GetVehicleLocation(ctx, cleanID)
	if err != nil {
		return nil, err
	}

	if res.CurrentGeofences == nil {
		res.CurrentGeofences = make([]models.VehicleGeofenceDetail, 0)
	}

	return res, nil
}
