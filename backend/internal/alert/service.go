package alert

import (
	"context"
	"strings"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/ids"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// ValidEventTypes defines the allowed event types for alert rules.
var ValidEventTypes = map[string]bool{
	models.EventTypeEntry: true,
	models.EventTypeExit:  true,
	models.EventTypeBoth:  true,
}

// Service defines the business logic interface for alert rules.
type Service interface {
	CreateRule(ctx context.Context, req models.ConfigureAlertRequest) (*models.ConfigureAlertResponse, error)
	ListRules(ctx context.Context, geofenceID, vehicleID string) ([]models.AlertRuleDetail, error)
	DeleteRule(ctx context.Context, alertID string) error
}

type service struct {
	store Store
}

// NewService constructs a new alert Service.
func NewService(store Store) Service {
	return &service{store: store}
}

// CreateRule validates the rule configuration, normalizes vehicle ID, and creates the alert rule.
func (s *service) CreateRule(ctx context.Context, req models.ConfigureAlertRequest) (*models.ConfigureAlertResponse, error) {
	geofenceID := strings.TrimSpace(req.GeofenceID)
	if geofenceID == "" {
		return nil, apperror.NewBadRequestError("geofence_id is required")
	}

	eventType := strings.TrimSpace(req.EventType)
	if !ValidEventTypes[eventType] {
		return nil, apperror.NewBadRequestError("event_type must be one of: entry, exit, both")
	}

	var vehicleID *string
	if req.VehicleID != nil {
		trimmed := strings.TrimSpace(*req.VehicleID)
		if trimmed != "" {
			vehicleID = &trimmed
		}
	}

	alertID := ids.New(ids.PrefixAlert)
	rule := &models.AlertRule{
		ID:         alertID,
		GeofenceID: geofenceID,
		VehicleID:  vehicleID,
		EventType:  eventType,
		Status:     models.StatusActive,
		CreatedAt:  time.Now().UTC(),
	}

	if err := s.store.CreateRule(ctx, rule); err != nil {
		return nil, err
	}

	return &models.ConfigureAlertResponse{
		AlertID:    rule.ID,
		GeofenceID: rule.GeofenceID,
		VehicleID:  rule.VehicleID,
		EventType:  rule.EventType,
		Status:     rule.Status,
	}, nil
}

// ListRules retrieves alert rules, optionally filtered by geofence or vehicle.
func (s *service) ListRules(ctx context.Context, geofenceID, vehicleID string) ([]models.AlertRuleDetail, error) {
	rules, err := s.store.ListRules(ctx, strings.TrimSpace(geofenceID), strings.TrimSpace(vehicleID))
	if err != nil {
		return nil, err
	}
	if rules == nil {
		rules = make([]models.AlertRuleDetail, 0)
	}
	return rules, nil
}

// DeleteRule removes an alert rule by ID.
func (s *service) DeleteRule(ctx context.Context, alertID string) error {
	cleanID := strings.TrimSpace(alertID)
	if cleanID == "" {
		return apperror.NewBadRequestError("alert_id must not be empty")
	}
	return s.store.DeleteRule(ctx, cleanID)
}
