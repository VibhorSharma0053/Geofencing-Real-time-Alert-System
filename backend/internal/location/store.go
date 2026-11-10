package location

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/ids"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// LocationUpdateParams contains input parameters for updating a vehicle's position.
type LocationUpdateParams struct {
	VehicleID string
	Latitude  float64
	Longitude float64
	Timestamp time.Time
}

// LocationUpdateResult contains the result of a position update and event detection.
type LocationUpdateResult struct {
	VehicleID        string
	VehicleNumber    string
	DriverName       string
	CurrentGeofences []models.CurrentGeofenceStatus
	DetectedEvents   []DetectedEvent
	IsOutOfOrder     bool
}

// Store defines persistence operations for vehicle locations, containment state, and violations.
type Store interface {
	RecordLocationAndDiff(ctx context.Context, params LocationUpdateParams) (*LocationUpdateResult, error)
	GetVehicleLocation(ctx context.Context, vehicleID string) (*models.GetVehicleLocationResponse, error)
}

type pgStore struct {
	pool *pgxpool.Pool
}

// NewStore constructs a new PostgreSQL Store for vehicle locations.
func NewStore(pool *pgxpool.Pool) Store {
	return &pgStore{pool: pool}
}

// RecordLocationAndDiff executes the atomic position update, containment check, and diff within a single transaction.
func (s *pgStore) RecordLocationAndDiff(ctx context.Context, params LocationUpdateParams) (*LocationUpdateResult, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Lock the vehicle row to serialize concurrent position updates
	var vehicleNumber, driverName string
	err = tx.QueryRow(ctx, "SELECT vehicle_number, driver_name FROM vehicles WHERE id = $1 FOR UPDATE", params.VehicleID).
		Scan(&vehicleNumber, &driverName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NewNotFoundError(fmt.Sprintf("vehicle %s not found", params.VehicleID))
		}
		return nil, fmt.Errorf("failed to lock vehicle: %w", err)
	}

	// 2. Query the latest recorded_at for the vehicle
	var latestRecordedAt time.Time
	err = tx.QueryRow(ctx, "SELECT recorded_at FROM vehicle_locations WHERE vehicle_id = $1 ORDER BY recorded_at DESC LIMIT 1", params.VehicleID).
		Scan(&latestRecordedAt)
	hasPreviousLocation := err == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to fetch latest recorded location: %w", err)
	}

	// 3. Insert the new location point (PostGIS ST_MakePoint(lng, lat))
	insertLocQuery := `
		INSERT INTO vehicle_locations (vehicle_id, latitude, longitude, geom, recorded_at, created_at)
		VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326), $6, now());
	`
	_, err = tx.Exec(ctx, insertLocQuery,
		params.VehicleID,
		params.Latitude,
		params.Longitude,
		params.Longitude, // ST_MakePoint(lng, lat)
		params.Latitude,
		params.Timestamp,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to insert vehicle location: %w", err)
	}

	// 4. Handle out-of-order updates
	if hasPreviousLocation && params.Timestamp.Before(latestRecordedAt) {
		// Read current stored geofences without modifying state
		stateQuery := `
			SELECT g.id, g.name
			FROM vehicle_geofence_state s
			JOIN geofences g ON s.geofence_id = g.id
			WHERE s.vehicle_id = $1
			ORDER BY g.name ASC;
		`
		rows, qErr := tx.Query(ctx, stateQuery, params.VehicleID)
		if qErr != nil {
			return nil, fmt.Errorf("failed to query stored geofence state: %w", qErr)
		}
		defer rows.Close()

		storedGeofences := make([]models.CurrentGeofenceStatus, 0)
		for rows.Next() {
			var gid, gname string
			if scanErr := rows.Scan(&gid, &gname); scanErr != nil {
				return nil, fmt.Errorf("failed to scan stored geofence: %w", scanErr)
			}
			storedGeofences = append(storedGeofences, models.CurrentGeofenceStatus{
				GeofenceID:   gid,
				GeofenceName: gname,
				Status:       models.StatusInside,
			})
		}

		if err := tx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("failed to commit out-of-order location: %w", err)
		}

		return &LocationUpdateResult{
			VehicleID:        params.VehicleID,
			VehicleNumber:    vehicleNumber,
			DriverName:       driverName,
			CurrentGeofences: storedGeofences,
			DetectedEvents:   nil,
			IsOutOfOrder:     true,
		}, nil
	}

	// 5. Query containing active geofences via ST_Covers (boundary counts as inside)
	coversQuery := `
		SELECT id, name, category
		FROM geofences
		WHERE status = 'active'
		  AND ST_Covers(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326))
		ORDER BY name ASC;
	`
	cRows, err := tx.Query(ctx, coversQuery, params.Longitude, params.Latitude)
	if err != nil {
		return nil, fmt.Errorf("failed to query containing geofences: %w", err)
	}
	defer cRows.Close()

	type geofenceInfo struct {
		ID       string
		Name     string
		Category string
	}
	currentGeofencesMap := make(map[string]geofenceInfo)
	currentIDs := make([]string, 0)
	currentStatuses := make([]models.CurrentGeofenceStatus, 0)

	for cRows.Next() {
		var g geofenceInfo
		if err := cRows.Scan(&g.ID, &g.Name, &g.Category); err != nil {
			return nil, fmt.Errorf("failed to scan containing geofence: %w", err)
		}
		currentGeofencesMap[g.ID] = g
		currentIDs = append(currentIDs, g.ID)
		currentStatuses = append(currentStatuses, models.CurrentGeofenceStatus{
			GeofenceID:   g.ID,
			GeofenceName: g.Name,
			Status:       models.StatusInside,
		})
	}
	cRows.Close()

	// 6. Query previously recorded geofence state
	prevRows, err := tx.Query(ctx, "SELECT geofence_id FROM vehicle_geofence_state WHERE vehicle_id = $1", params.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query previous state: %w", err)
	}
	defer prevRows.Close()

	previousIDs := make([]string, 0)
	for prevRows.Next() {
		var pid string
		if err := prevRows.Scan(&pid); err != nil {
			return nil, fmt.Errorf("failed to scan previous geofence id: %w", err)
		}
		previousIDs = append(previousIDs, pid)
	}
	prevRows.Close()

	// Diff previous vs current geofences
	enteredIDs, exitedIDs := DiffGeofences(previousIDs, currentIDs)

	// 7. Apply state changes: INSERT entered, DELETE exited
	for _, eid := range enteredIDs {
		_, err := tx.Exec(ctx, `
			INSERT INTO vehicle_geofence_state (vehicle_id, geofence_id, entered_at)
			VALUES ($1, $2, $3)
			ON CONFLICT (vehicle_id, geofence_id) DO NOTHING;
		`, params.VehicleID, eid, params.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to insert vehicle geofence state: %w", err)
		}
	}

	for _, xid := range exitedIDs {
		_, err := tx.Exec(ctx, `
			DELETE FROM vehicle_geofence_state
			WHERE vehicle_id = $1 AND geofence_id = $2;
		`, params.VehicleID, xid)
		if err != nil {
			return nil, fmt.Errorf("failed to delete vehicle geofence state: %w", err)
		}
	}

	// 8. Load metadata for exited geofences (since they are no longer in currentGeofencesMap)
	exitedGeofencesMap := make(map[string]geofenceInfo)
	if len(exitedIDs) > 0 {
		exitedRows, err := tx.Query(ctx, "SELECT id, name, category FROM geofences WHERE id = ANY($1)", exitedIDs)
		if err != nil {
			return nil, fmt.Errorf("failed to query exited geofences metadata: %w", err)
		}
		defer exitedRows.Close()
		for exitedRows.Next() {
			var g geofenceInfo
			if err := exitedRows.Scan(&g.ID, &g.Name, &g.Category); err != nil {
				return nil, fmt.Errorf("failed to scan exited geofence: %w", err)
			}
			exitedGeofencesMap[g.ID] = g
		}
		exitedRows.Close()
	}

	// Record violation_events and collect detected events for notification
	detectedEvents := make([]DetectedEvent, 0, len(enteredIDs)+len(exitedIDs))

	for _, eid := range enteredIDs {
		violID := ids.New(ids.PrefixViolation)
		gInfo := currentGeofencesMap[eid]

		_, err := tx.Exec(ctx, `
			INSERT INTO violation_events (id, vehicle_id, geofence_id, event_type, latitude, longitude, timestamp, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, now());
		`, violID, params.VehicleID, eid, models.EventTypeEntry, params.Latitude, params.Longitude, params.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to insert entry violation event: %w", err)
		}

		detectedEvents = append(detectedEvents, DetectedEvent{
			ViolationID:  violID,
			GeofenceID:   eid,
			GeofenceName: gInfo.Name,
			Category:     gInfo.Category,
			EventType:    models.EventTypeEntry,
			Timestamp:    params.Timestamp,
		})
	}

	for _, xid := range exitedIDs {
		violID := ids.New(ids.PrefixViolation)
		gInfo := exitedGeofencesMap[xid]

		_, err := tx.Exec(ctx, `
			INSERT INTO violation_events (id, vehicle_id, geofence_id, event_type, latitude, longitude, timestamp, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, now());
		`, violID, params.VehicleID, xid, models.EventTypeExit, params.Latitude, params.Longitude, params.Timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to insert exit violation event: %w", err)
		}

		detectedEvents = append(detectedEvents, DetectedEvent{
			ViolationID:  violID,
			GeofenceID:   xid,
			GeofenceName: gInfo.Name,
			Category:     gInfo.Category,
			EventType:    models.EventTypeExit,
			Timestamp:    params.Timestamp,
		})
	}

	// 9. Commit transaction
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return &LocationUpdateResult{
		VehicleID:        params.VehicleID,
		VehicleNumber:    vehicleNumber,
		DriverName:       driverName,
		CurrentGeofences: currentStatuses,
		DetectedEvents:   detectedEvents,
		IsOutOfOrder:     false,
	}, nil
}

// GetVehicleLocation retrieves the latest location and active geofences for a vehicle.
func (s *pgStore) GetVehicleLocation(ctx context.Context, vehicleID string) (*models.GetVehicleLocationResponse, error) {
	var vehicleNumber string
	err := s.pool.QueryRow(ctx, "SELECT vehicle_number FROM vehicles WHERE id = $1", vehicleID).
		Scan(&vehicleNumber)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NewNotFoundError(fmt.Sprintf("vehicle %s not found", vehicleID))
		}
		return nil, fmt.Errorf("failed to find vehicle: %w", err)
	}

	// Query latest location
	locQuery := `
		SELECT latitude, longitude, recorded_at
		FROM vehicle_locations
		WHERE vehicle_id = $1
		ORDER BY recorded_at DESC
		LIMIT 1;
	`
	var lat, lng float64
	var recordedAt time.Time
	locErr := s.pool.QueryRow(ctx, locQuery, vehicleID).Scan(&lat, &lng, &recordedAt)

	var currentLoc *models.CurrentLocationInfo
	if locErr == nil {
		currentLoc = &models.CurrentLocationInfo{
			Latitude:  lat,
			Longitude: lng,
			Timestamp: recordedAt.UTC(),
		}
	} else if !errors.Is(locErr, pgx.ErrNoRows) {
		return nil, fmt.Errorf("failed to query latest vehicle location: %w", locErr)
	}

	// Query current geofences from state table
	stateQuery := `
		SELECT g.id, g.name, g.category
		FROM vehicle_geofence_state s
		JOIN geofences g ON s.geofence_id = g.id
		WHERE s.vehicle_id = $1
		ORDER BY g.name ASC;
	`
	rows, err := s.pool.Query(ctx, stateQuery, vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to query geofence state: %w", err)
	}
	defer rows.Close()

	geofences := make([]models.VehicleGeofenceDetail, 0)
	for rows.Next() {
		var gd models.VehicleGeofenceDetail
		if err := rows.Scan(&gd.GeofenceID, &gd.GeofenceName, &gd.Category); err != nil {
			return nil, fmt.Errorf("failed to scan geofence state row: %w", err)
		}
		geofences = append(geofences, gd)
	}

	return &models.GetVehicleLocationResponse{
		VehicleID:        vehicleID,
		VehicleNumber:    vehicleNumber,
		CurrentLocation:  currentLoc,
		CurrentGeofences: geofences,
	}, nil
}
