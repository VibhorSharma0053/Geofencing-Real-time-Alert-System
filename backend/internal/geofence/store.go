package geofence

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Store defines the database persistence interface for geofences.
type Store interface {
	ValidateGeometry(ctx context.Context, wkt string) (bool, error)
	Create(ctx context.Context, g *models.Geofence, wkt string) error
	List(ctx context.Context, category string, limit, offset *int) ([]models.Geofence, int64, error)
}

type pgStore struct {
	pool *pgxpool.Pool
}

// NewStore creates a new PostgreSQL-backed Store for geofences.
func NewStore(pool *pgxpool.Pool) Store {
	return &pgStore{pool: pool}
}

// ValidateGeometry checks if a polygon WKT is valid and has a non-zero area using PostGIS.
func (s *pgStore) ValidateGeometry(ctx context.Context, wkt string) (bool, error) {
	query := `
		SELECT 
			ST_IsValid(geom) AND ST_Area(geom::geography) > 0
		FROM (
			SELECT ST_SetSRID(ST_GeomFromText($1), 4326) AS geom
		) AS sub;
	`
	var isValid bool
	err := s.pool.QueryRow(ctx, query, wkt).Scan(&isValid)
	if err != nil {
		return false, nil
	}
	return isValid, nil
}

// Create inserts a new geofence record with both JSONB coordinates and a PostGIS polygon geometry.
func (s *pgStore) Create(ctx context.Context, g *models.Geofence, wkt string) error {
	coordsJSON, err := json.Marshal(g.Coordinates)
	if err != nil {
		return fmt.Errorf("failed to marshal coordinates to JSONB: %w", err)
	}

	query := `
		INSERT INTO geofences (id, name, description, category, coordinates, boundary, status, created_at)
		VALUES ($1, $2, $3, $4, $5, ST_SetSRID(ST_GeomFromText($6), 4326), $7, $8);
	`
	_, err = s.pool.Exec(ctx, query,
		g.ID,
		g.Name,
		g.Description,
		g.Category,
		coordsJSON,
		wkt,
		g.Status,
		g.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert geofence: %w", err)
	}
	return nil
}

// List returns geofences ordered by created_at DESC, with optional category filter and pagination.
func (s *pgStore) List(ctx context.Context, category string, limit, offset *int) ([]models.Geofence, int64, error) {
	var countQuery string
	var query string
	var args []any
	argIdx := 1

	if category != "" {
		countQuery = "SELECT COUNT(*) FROM geofences WHERE category = $1;"
		query = "SELECT id, name, description, category, coordinates, status, created_at FROM geofences WHERE category = $1 ORDER BY created_at DESC"
		args = append(args, category)
		argIdx++
	} else {
		countQuery = "SELECT COUNT(*) FROM geofences;"
		query = "SELECT id, name, description, category, coordinates, status, created_at FROM geofences ORDER BY created_at DESC"
	}

	var totalCount int64
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&totalCount); err != nil {
		return nil, 0, fmt.Errorf("failed to count geofences: %w", err)
	}

	dataArgs := append([]any(nil), args...)
	if limit != nil && offset != nil {
		query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
		dataArgs = append(dataArgs, *limit, *offset)
	}
	query += ";"

	rows, err := s.pool.Query(ctx, query, dataArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query geofences: %w", err)
	}
	defer rows.Close()

	geofences := make([]models.Geofence, 0)
	for rows.Next() {
		var g models.Geofence
		var coordsRaw []byte

		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.Category, &coordsRaw, &g.Status, &g.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("failed to scan geofence row: %w", err)
		}

		if err := json.Unmarshal(coordsRaw, &g.Coordinates); err != nil {
			return nil, 0, fmt.Errorf("failed to unmarshal coordinates for geofence %s: %w", g.ID, err)
		}
		g.CreatedAt = g.CreatedAt.UTC()
		geofences = append(geofences, g)
	}

	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, fmt.Errorf("rows iteration error: %w", err)
	}

	return geofences, totalCount, nil
}
