package violation

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Filter holds query filtering options for violation event history.
type Filter struct {
	VehicleID  string
	GeofenceID string
	StartDate  time.Time
	EndDate    time.Time
	Limit      int
	Offset     int
}

// Store defines persistence operations for retrieving violation history.
type Store interface {
	GetHistory(ctx context.Context, filter Filter) ([]models.ViolationEvent, int64, error)
}

type pgStore struct {
	pool *pgxpool.Pool
}

// NewStore constructs a new PostgreSQL Store for violation history.
func NewStore(pool *pgxpool.Pool) Store {
	return &pgStore{pool: pool}
}

// GetHistory queries violation events joining vehicles and geofences with dynamic parameterized filtering.
func (s *pgStore) GetHistory(ctx context.Context, filter Filter) ([]models.ViolationEvent, int64, error) {
	var conditions []string
	var args []any
	argIdx := 1

	if filter.VehicleID != "" {
		conditions = append(conditions, fmt.Sprintf("v.vehicle_id = $%d", argIdx))
		args = append(args, filter.VehicleID)
		argIdx++
	}

	if filter.GeofenceID != "" {
		conditions = append(conditions, fmt.Sprintf("v.geofence_id = $%d", argIdx))
		args = append(args, filter.GeofenceID)
		argIdx++
	}

	if !filter.StartDate.IsZero() {
		conditions = append(conditions, fmt.Sprintf("v.timestamp >= $%d", argIdx))
		args = append(args, filter.StartDate)
		argIdx++
	}

	if !filter.EndDate.IsZero() {
		conditions = append(conditions, fmt.Sprintf("v.timestamp <= $%d", argIdx))
		args = append(args, filter.EndDate)
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = " WHERE " + strings.Join(conditions, " AND ")
	}

	// 1. Total count query ignoring limit and offset
	countQuery := "SELECT COUNT(*) FROM violation_events v" + whereClause + ";"
	var totalCount int64
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, fmt.Errorf("failed to count violation events: %w", err)
	}

	// 2. Data query with vehicle and geofence names, ordered by timestamp DESC, id ASC
	dataQuery := `
		SELECT 
			v.id, 
			v.vehicle_id, 
			COALESCE(veh.vehicle_number, ''), 
			v.geofence_id, 
			COALESCE(g.name, ''), 
			v.event_type, 
			v.latitude, 
			v.longitude, 
			v.timestamp, 
			v.created_at
		FROM violation_events v
		LEFT JOIN vehicles veh ON v.vehicle_id = veh.id
		LEFT JOIN geofences g ON v.geofence_id = g.id
	` + whereClause + fmt.Sprintf(" ORDER BY v.timestamp DESC, v.id ASC LIMIT $%d OFFSET $%d;", argIdx, argIdx+1)

	dataArgs := append([]any(nil), args...)
	dataArgs = append(dataArgs, filter.Limit, filter.Offset)

	rows, err := s.pool.Query(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query violation events: %w", err)
	}
	defer rows.Close()

	violations := make([]models.ViolationEvent, 0)
	for rows.Next() {
		var ev models.ViolationEvent
		if err := rows.Scan(
			&ev.ID,
			&ev.VehicleID,
			&ev.VehicleNumber,
			&ev.GeofenceID,
			&ev.GeofenceName,
			&ev.EventType,
			&ev.Latitude,
			&ev.Longitude,
			&ev.Timestamp,
			&ev.CreatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan violation event row: %w", err)
		}
		ev.Timestamp = ev.Timestamp.UTC()
		ev.CreatedAt = ev.CreatedAt.UTC()
		violations = append(violations, ev)
	}

	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, fmt.Errorf("rows iteration error in violations: %w", err)
	}

	return violations, totalCount, nil
}
