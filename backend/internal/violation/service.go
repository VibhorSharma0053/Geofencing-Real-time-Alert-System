package violation

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// HistoryQueryParams contains raw query parameter strings from the HTTP request.
type HistoryQueryParams struct {
	VehicleID  string
	GeofenceID string
	StartDate  string
	EndDate    string
	Limit      string
	Offset     string
}

// Service defines the business logic interface for violation events.
type Service interface {
	GetHistory(ctx context.Context, params HistoryQueryParams) (*models.ListViolationsResponse, error)
}

type service struct {
	store Store
}

// NewService constructs a new violation Service.
func NewService(store Store) Service {
	return &service{store: store}
}

// GetHistory parses and validates query filters, fetches events from the store, and clamps pagination limits.
func (s *service) GetHistory(ctx context.Context, params HistoryQueryParams) (*models.ListViolationsResponse, error) {
	filter := Filter{
		VehicleID:  strings.TrimSpace(params.VehicleID),
		GeofenceID: strings.TrimSpace(params.GeofenceID),
		Limit:      50, // default limit
		Offset:     0,  // default offset
	}

	// 1. Parse start_date
	if rawStart := strings.TrimSpace(params.StartDate); rawStart != "" {
		st, err := time.Parse(time.RFC3339Nano, rawStart)
		if err != nil {
			st, err = time.Parse(time.RFC3339, rawStart)
		}
		if err != nil {
			return nil, apperror.NewBadRequestError("invalid start_date format (must be RFC3339 / ISO 8601)")
		}
		filter.StartDate = st.UTC()
	}

	// 2. Parse end_date
	if rawEnd := strings.TrimSpace(params.EndDate); rawEnd != "" {
		et, err := time.Parse(time.RFC3339Nano, rawEnd)
		if err != nil {
			et, err = time.Parse(time.RFC3339, rawEnd)
		}
		if err != nil {
			return nil, apperror.NewBadRequestError("invalid end_date format (must be RFC3339 / ISO 8601)")
		}
		filter.EndDate = et.UTC()
	}

	// 3. Ensure start_date <= end_date
	if !filter.StartDate.IsZero() && !filter.EndDate.IsZero() && filter.StartDate.After(filter.EndDate) {
		return nil, apperror.NewBadRequestError("start_date must be before or equal to end_date")
	}

	// 4. Parse limit
	if rawLimit := strings.TrimSpace(params.Limit); rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil || parsedLimit < 1 {
			return nil, apperror.NewBadRequestError("limit must be a positive integer greater than 0")
		}
		if parsedLimit > 500 {
			parsedLimit = 500 // clamp to maximum 500
		}
		filter.Limit = parsedLimit
	}

	// 5. Parse offset
	if rawOffset := strings.TrimSpace(params.Offset); rawOffset != "" {
		parsedOffset, err := strconv.Atoi(rawOffset)
		if err != nil || parsedOffset < 0 {
			return nil, apperror.NewBadRequestError("offset must be a non-negative integer")
		}
		filter.Offset = parsedOffset
	}

	violations, totalCount, err := s.store.GetHistory(ctx, filter)
	if err != nil {
		return nil, err
	}

	if violations == nil {
		violations = make([]models.ViolationEvent, 0)
	}

	return &models.ListViolationsResponse{
		Violations: violations,
		TotalCount: totalCount,
	}, nil
}
