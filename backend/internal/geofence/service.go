package geofence

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/ids"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// ValidCategories defines the allowed set of geofence categories.
var ValidCategories = map[string]bool{
	models.CategoryDeliveryZone:   true,
	models.CategoryRestrictedZone: true,
	models.CategoryTollZone:       true,
	models.CategoryCustomerArea:   true,
}

// Service defines the business logic interface for geofences.
type Service interface {
	Create(ctx context.Context, req models.CreateGeofenceRequest) (*models.CreateGeofenceResponse, error)
	List(ctx context.Context, category string) ([]models.Geofence, error)
}

type service struct {
	store Store
}

// NewService constructs a new geofence Service.
func NewService(store Store) Service {
	return &service{store: store}
}

// Create validates inputs, checks PostGIS geometry validity, and persists the geofence.
func (s *service) Create(ctx context.Context, req models.CreateGeofenceRequest) (*models.CreateGeofenceResponse, error) {
	var details []string

	// 1. Name validation
	name := strings.TrimSpace(req.Name)
	if name == "" {
		details = append(details, "name is required and must not be empty")
	} else if len(name) > 200 {
		details = append(details, "name must not exceed 200 characters")
	}

	// 2. Category validation
	category := strings.TrimSpace(req.Category)
	if category == "" || !ValidCategories[category] {
		details = append(details, "category is required and must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
	}

	// 3. Coordinates validation
	coords := req.Coordinates
	if len(coords) == 0 {
		details = append(details, "coordinates are required")
	} else {
		if len(coords) < 4 {
			details = append(details, "coordinates must contain at least 4 points")
		}

		hasInvalidValues := false
		for i, pt := range coords {
			lat := pt[0]
			lng := pt[1]

			if math.IsNaN(lat) || math.IsInf(lat, 0) || math.IsNaN(lng) || math.IsInf(lng, 0) {
				if !hasInvalidValues {
					details = append(details, "coordinates must not contain NaN or infinite values")
					hasInvalidValues = true
				}
				continue
			}

			if lat < -90.0 || lat > 90.0 {
				details = append(details, fmt.Sprintf("point %d latitude %f out of range [-90, 90]", i, lat))
			}
			if lng < -180.0 || lng > 180.0 {
				details = append(details, fmt.Sprintf("point %d longitude %f out of range [-180, 180]", i, lng))
			}
		}

		// First point == last point check (closed ring)
		if len(coords) >= 4 {
			first := coords[0]
			last := coords[len(coords)-1]
			if first[0] != last[0] || first[1] != last[1] {
				details = append(details, "first and last coordinate must be identical to form a closed polygon")
			}
		}
	}

	if len(details) > 0 {
		return nil, apperror.NewValidationError("validation failed", details...)
	}

	// Build WKT with swapped coordinates: POLYGON((lng lat, lng lat, ...))
	wkt := buildWKT(coords)

	// Validate polygon geometry in PostGIS (detect self-intersections or zero area)
	isValid, err := s.store.ValidateGeometry(ctx, wkt)
	if err != nil {
		return nil, fmt.Errorf("failed to validate geometry: %w", err)
	}
	if !isValid {
		return nil, apperror.NewBadRequestError("polygon is not valid (self-intersecting or zero area)")
	}

	// Construct domain model
	id := ids.New(ids.PrefixGeofence)
	now := time.Now().UTC()
	g := &models.Geofence{
		ID:          id,
		Name:        name,
		Description: strings.TrimSpace(req.Description),
		Category:    category,
		Coordinates: coords,
		Status:      models.StatusActive,
		CreatedAt:   now,
	}

	if err := s.store.Create(ctx, g, wkt); err != nil {
		return nil, fmt.Errorf("failed to save geofence: %w", err)
	}

	return &models.CreateGeofenceResponse{
		ID:     g.ID,
		Name:   g.Name,
		Status: g.Status,
	}, nil
}

// List retrieves geofences, optionally filtered by category.
func (s *service) List(ctx context.Context, category string) ([]models.Geofence, error) {
	trimmedCategory := strings.TrimSpace(category)
	if trimmedCategory != "" && !ValidCategories[trimmedCategory] {
		return nil, apperror.NewBadRequestError("invalid category: must be one of: delivery_zone, restricted_zone, toll_zone, customer_area")
	}

	return s.store.List(ctx, trimmedCategory)
}

// buildWKT converts API coordinates [[lat, lng], ...] to WKT POLYGON((lng lat, ...)).
func buildWKT(coords []models.Coordinate) string {
	points := make([]string, len(coords))
	for i, c := range coords {
		// PostGIS expects (longitude latitude) order
		lngStr := strconv.FormatFloat(c[1], 'f', -1, 64)
		latStr := strconv.FormatFloat(c[0], 'f', -1, 64)
		points[i] = lngStr + " " + latStr
	}
	return "POLYGON((" + strings.Join(points, ", ") + "))"
}
