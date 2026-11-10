package db

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/postgres"
	"github.com/golang-migrate/migrate/v4/source/iofs"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/vibhorsharma/geofence-backend/internal/db/migrations"
)

// DefaultRetryTimeout is the maximum time spent attempting to connect to PostgreSQL.
const DefaultRetryTimeout = 30 * time.Second

// Connect establishes a connection pool to PostgreSQL, retrying with backoff
// for up to maxTimeout (defaulting to 30 seconds) until the database is ready.
func Connect(ctx context.Context, databaseURL string, maxTimeout time.Duration) (*pgxpool.Pool, error) {
	if maxTimeout <= 0 {
		maxTimeout = DefaultRetryTimeout
	}

	deadline := time.Now().Add(maxTimeout)
	backoff := 1 * time.Second
	const maxBackoff = 3 * time.Second

	var lastErr error
	attempt := 1

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		slog.Info("attempting database connection", "attempt", attempt)

		poolConfig, err := pgxpool.ParseConfig(databaseURL)
		if err != nil {
			return nil, fmt.Errorf("invalid database configuration: %w", err)
		}

		// Pool configuration tuned for high throughput & reliability
		poolConfig.MaxConns = 25
		poolConfig.MinConns = 5
		poolConfig.MaxConnIdleTime = 5 * time.Minute
		poolConfig.MaxConnLifetime = 30 * time.Minute

		pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
		if err == nil {
			pingCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
			pingErr := pool.Ping(pingCtx)
			cancel()

			if pingErr == nil {
				slog.Info("successfully connected to database", "attempt", attempt)
				return pool, nil
			}

			pool.Close()
			lastErr = pingErr
		} else {
			lastErr = err
		}

		slog.Warn("database not ready yet, retrying...", "attempt", attempt, "error", lastErr, "backoff", backoff)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(backoff):
		}

		backoff *= 2
		if backoff > maxBackoff {
			backoff = maxBackoff
		}
		attempt++
	}

	return nil, fmt.Errorf("failed to connect to database after %s: %w", maxTimeout, lastErr)
}

// RunMigrations executes all embedded SQL migrations against the database.
func RunMigrations(pool *pgxpool.Pool) error {
	slog.Info("running database migrations...")

	sqlDB := stdlib.OpenDBFromPool(pool)

	driver, err := postgres.WithInstance(sqlDB, &postgres.Config{
		MigrationsTable: "schema_migrations",
	})
	if err != nil {
		return fmt.Errorf("failed to create postgres migration driver: %w", err)
	}

	sourceDriver, err := iofs.New(migrations.FS, ".")
	if err != nil {
		return fmt.Errorf("failed to create iofs migration driver: %w", err)
	}

	m, err := migrate.NewWithInstance("iofs", sourceDriver, "postgres", driver)
	if err != nil {
		return fmt.Errorf("failed to initialize migration instance: %w", err)
	}

	if err := m.Up(); err != nil && !errors.Is(err, migrate.ErrNoChange) {
		return fmt.Errorf("failed to apply migrations: %w", err)
	}

	slog.Info("database migrations applied successfully")
	return nil
}
