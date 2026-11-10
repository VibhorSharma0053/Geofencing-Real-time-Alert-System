package geofence

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

func TestSTCoversIntegration(t *testing.T) {
	testDBURL := os.Getenv("TEST_DATABASE_URL")
	if testDBURL == "" {
		t.Skip("skipping integration test: TEST_DATABASE_URL environment variable not set")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, testDBURL)
	if err != nil {
		t.Fatalf("failed to connect to test database: %v", err)
	}
	defer pool.Close()

	store := NewStore(pool)

	// Create test polygon coordinates (Square)
	testCoords := []models.Coordinate{
		{37.7700, -122.4200},
		{37.7800, -122.4200},
		{37.7800, -122.4100},
		{37.7700, -122.4100},
		{37.7700, -122.4200},
	}
	wkt := buildWKT(testCoords)

	// 1. Verify geometry validity
	isValid, err := store.ValidateGeometry(ctx, wkt)
	if err != nil {
		t.Fatalf("failed to validate geometry: %v", err)
	}
	if !isValid {
		t.Fatalf("expected test polygon geometry to be valid")
	}

	// 2. Test spatial point containment (including boundary points)
	tests := []struct {
		name       string
		lat        float64
		lng        float64
		wantInside bool
	}{
		{"inside center", 37.7750, -122.4150, true},
		{"on boundary edge", 37.7700, -122.4150, true}, // ST_Covers includes boundary
		{"on vertex corner", 37.7700, -122.4200, true},
		{"outside north", 37.7900, -122.4150, false},
		{"outside east", 37.7750, -122.4000, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			query := `
				SELECT ST_Covers(
					ST_SetSRID(ST_GeomFromText($1), 4326),
					ST_SetSRID(ST_MakePoint($2, $3), 4326)
				);
			`
			var isInside bool
			err := pool.QueryRow(ctx, query, wkt, tt.lng, tt.lat).Scan(&isInside)
			if err != nil {
				t.Fatalf("ST_Covers query failed: %v", err)
			}
			if isInside != tt.wantInside {
				t.Errorf("ST_Covers(lat=%f, lng=%f) = %v, want %v", tt.lat, tt.lng, isInside, tt.wantInside)
			}
		})
	}
}
