package vehicle

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/apperror"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Store defines the database persistence interface for vehicles.
type Store interface {
	Create(ctx context.Context, v *models.Vehicle) error
	List(ctx context.Context) ([]models.Vehicle, error)
	GetByID(ctx context.Context, id string) (*models.Vehicle, error)
}

type pgStore struct {
	pool *pgxpool.Pool
}

// NewStore creates a new PostgreSQL-backed Store for vehicles.
func NewStore(pool *pgxpool.Pool) Store {
	return &pgStore{pool: pool}
}

// Create inserts a new vehicle record, translating unique constraint violations to a ConflictError.
func (s *pgStore) Create(ctx context.Context, v *models.Vehicle) error {
	query := `
		INSERT INTO vehicles (id, vehicle_number, driver_name, vehicle_type, phone, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7);
	`
	_, err := s.pool.Exec(ctx, query,
		v.ID,
		v.VehicleNumber,
		v.DriverName,
		v.VehicleType,
		v.Phone,
		v.Status,
		v.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return apperror.NewConflictError("vehicle_number already exists")
		}
		return fmt.Errorf("failed to insert vehicle: %w", err)
	}
	return nil
}

// List returns all vehicles ordered by created_at DESC.
func (s *pgStore) List(ctx context.Context) ([]models.Vehicle, error) {
	query := `
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, status, created_at
		FROM vehicles
		ORDER BY created_at DESC;
	`
	rows, err := s.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicles: %w", err)
	}
	defer rows.Close()

	vehicles := make([]models.Vehicle, 0)
	for rows.Next() {
		var v models.Vehicle
		if err := rows.Scan(&v.ID, &v.VehicleNumber, &v.DriverName, &v.VehicleType, &v.Phone, &v.Status, &v.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan vehicle row: %w", err)
		}
		vehicles = append(vehicles, v)
	}

	if err := rows.Err(); err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("rows iteration error: %w", err)
	}

	return vehicles, nil
}

// GetByID retrieves a single vehicle by its ID.
func (s *pgStore) GetByID(ctx context.Context, id string) (*models.Vehicle, error) {
	query := `
		SELECT id, vehicle_number, driver_name, vehicle_type, phone, status, created_at
		FROM vehicles
		WHERE id = $1;
	`
	var v models.Vehicle
	err := s.pool.QueryRow(ctx, query, id).Scan(
		&v.ID,
		&v.VehicleNumber,
		&v.DriverName,
		&v.VehicleType,
		&v.Phone,
		&v.Status,
		&v.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, apperror.NewNotFoundError(fmt.Sprintf("vehicle with ID %s not found", id))
		}
		return nil, fmt.Errorf("failed to query vehicle by ID: %w", err)
	}
	return &v, nil
}
