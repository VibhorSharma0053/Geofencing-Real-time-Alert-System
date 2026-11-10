package alert

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Store defines persistence operations for alert rules and alert events.
type Store interface {
	CreateRule(ctx context.Context, rule *models.AlertRule) error
	ListRules(ctx context.Context, geofenceID, vehicleID string) ([]models.AlertRuleDetail, error)
	DeleteRule(ctx context.Context, alertID string) error
	FindMatchingRules(ctx context.Context, geofenceID, vehicleID, eventType string) ([]string, error)
	RecordAlertEvent(ctx context.Context, eventID, violationID string, ruleIDs []string, payload any) error
}

type pgStore struct {
	pool *pgxpool.Pool
}

// NewStore constructs a new PostgreSQL Store for alert rules and events.
func NewStore(pool *pgxpool.Pool) Store {
	return &pgStore{pool: pool}
}

// CreateRule inserts an alert rule after verifying referenced foreign keys, handling duplicates as conflict.
func (s *pgStore) CreateRule(ctx context.Context, rule *models.AlertRule) error {
	// 1. Verify geofence existence (404 if missing)
	var dummy string
	err := s.pool.QueryRow(ctx, "SELECT id FROM geofences WHERE id = $1", rule.GeofenceID).Scan(&dummy)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return apperror.NewNotFoundError(fmt.Sprintf("geofence %s not found", rule.GeofenceID))
		}
		return fmt.Errorf("failed to verify geofence: %w", err)
	}

	// 2. Verify vehicle existence if vehicle_id is specified (404 if missing)
	if rule.VehicleID != nil {
		err = s.pool.QueryRow(ctx, "SELECT id FROM vehicles WHERE id = $1", *rule.VehicleID).Scan(&dummy)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return apperror.NewNotFoundError(fmt.Sprintf("vehicle %s not found", *rule.VehicleID))
			}
			return fmt.Errorf("failed to verify vehicle: %w", err)
		}
	}

	// 3. Insert rule
	query := `
		INSERT INTO alert_rules (id, geofence_id, vehicle_id, event_type, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6);
	`
	_, err = s.pool.Exec(ctx, query,
		rule.ID,
		rule.GeofenceID,
		rule.VehicleID,
		rule.EventType,
		rule.Status,
		rule.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperror.NewConflictError("alert rule already exists for this geofence, vehicle, and event_type")
		}
		return fmt.Errorf("failed to insert alert rule: %w", err)
	}

	return nil
}

// ListRules queries active and inactive alert rules with joined geofence and vehicle details.
func (s *pgStore) ListRules(ctx context.Context, geofenceID, vehicleID string) ([]models.AlertRuleDetail, error) {
	var conditions []string
	var args []any
	argIdx := 1

	if geofenceID != "" {
		conditions = append(conditions, fmt.Sprintf("r.geofence_id = $%d", argIdx))
		args = append(args, geofenceID)
		argIdx++
	}

	if vehicleID != "" {
		conditions = append(conditions, fmt.Sprintf("r.vehicle_id = $%d", argIdx))
		args = append(args, vehicleID)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	query := `
		SELECT 
			r.id, 
			r.geofence_id, 
			g.name, 
			r.vehicle_id, 
			veh.vehicle_number, 
			r.event_type, 
			r.status, 
			r.created_at
		FROM alert_rules r
		JOIN geofences g ON r.geofence_id = g.id
		LEFT JOIN vehicles veh ON r.vehicle_id = veh.id
	` + whereClause + " ORDER BY r.created_at DESC;"

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list alert rules: %w", err)
	}
	defer rows.Close()

	rules := make([]models.AlertRuleDetail, 0)
	for rows.Next() {
		var d models.AlertRuleDetail
		if err := rows.Scan(
			&d.AlertID,
			&d.GeofenceID,
			&d.GeofenceName,
			&d.VehicleID,
			&d.VehicleNumber,
			&d.EventType,
			&d.Status,
			&d.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan alert rule row: %w", err)
		}
		d.CreatedAt = d.CreatedAt.UTC()
		rules = append(rules, d)
	}

	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("rows iteration error in alert rules: %w", err)
	}

	return rules, nil
}

// DeleteRule removes an alert rule by ID, returning NotFoundError if it does not exist.
func (s *pgStore) DeleteRule(ctx context.Context, alertID string) error {
	ct, err := s.pool.Exec(ctx, "DELETE FROM alert_rules WHERE id = $1", alertID)
	if err != nil {
		return fmt.Errorf("failed to delete alert rule: %w", err)
	}
	if ct.RowsAffected() == 0 {
		return apperror.NewNotFoundError(fmt.Sprintf("alert rule %s not found", alertID))
	}
	return nil
}

// FindMatchingRules finds all active alert rules matching the specified geofence, vehicle, and event_type.
func (s *pgStore) FindMatchingRules(ctx context.Context, geofenceID, vehicleID, eventType string) ([]string, error) {
	query := `
		SELECT id
		FROM alert_rules
		WHERE status = 'active'
		  AND geofence_id = $1
		  AND (vehicle_id IS NULL OR vehicle_id = $2)
		  AND (event_type = $3 OR event_type = 'both');
	`
	rows, err := s.pool.Query(ctx, query, geofenceID, vehicleID, eventType)
	if err != nil {
		return nil, fmt.Errorf("failed to query matching alert rules: %w", err)
	}
	defer rows.Close()

	ruleIDs := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("failed to scan matched rule id: %w", err)
		}
		ruleIDs = append(ruleIDs, id)
	}

	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("rows iteration error matching alert rules: %w", err)
	}

	return ruleIDs, nil
}

// RecordAlertEvent inserts an alert event record linking violation event and triggered rules.
func (s *pgStore) RecordAlertEvent(ctx context.Context, eventID, violationID string, ruleIDs []string, payload any) error {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal alert payload: %w", err)
	}

	query := `
		INSERT INTO alert_events (id, violation_id, rule_ids, payload, created_at)
		VALUES ($1, $2, $3, $4, now());
	`
	_, err = s.pool.Exec(ctx, query, eventID, violationID, ruleIDs, payloadJSON)
	if err != nil {
		return fmt.Errorf("failed to insert alert event: %w", err)
	}
	return nil
}
