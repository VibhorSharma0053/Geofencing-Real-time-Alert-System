package ids

import (
	"strings"
	"testing"
)

func TestNew(t *testing.T) {
	prefixes := []string{PrefixGeofence, PrefixVehicle, PrefixAlert, PrefixViolation, PrefixEvent, "geo_"}

	seen := make(map[string]bool)

	for _, prefix := range prefixes {
		cleanPrefix := strings.TrimSuffix(prefix, "_")
		id := New(prefix)

		expectedPrefix := cleanPrefix + "_"
		if !strings.HasPrefix(id, expectedPrefix) {
			t.Errorf("expected id %q to start with prefix %q", id, expectedPrefix)
		}

		hexPart := strings.TrimPrefix(id, expectedPrefix)
		if len(hexPart) != 12 {
			t.Errorf("expected 12 hex chars, got %d for id %q", len(hexPart), id)
		}

		if !IsValid(id, cleanPrefix) {
			t.Errorf("expected id %q to be valid for prefix %q", id, cleanPrefix)
		}

		if seen[id] {
			t.Fatalf("collision detected for id %q", id)
		}
		seen[id] = true
	}
}

func TestIsValid(t *testing.T) {
	tests := []struct {
		name     string
		id       string
		prefix   string
		expected bool
	}{
		{"valid geo", "geo_0123456789ab", "geo", true},
		{"valid geo with prefix underscore", "geo_0123456789ab", "geo_", true},
		{"too short hex", "geo_012345", "geo", false},
		{"too long hex", "geo_0123456789abcd", "geo", false},
		{"non-hex character", "geo_0123456789ag", "geo", false},
		{"wrong prefix", "veh_0123456789ab", "geo", false},
		{"missing underscore", "geo0123456789ab", "geo", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsValid(tt.id, tt.prefix); got != tt.expected {
				t.Errorf("IsValid(%q, %q) = %v; want %v", tt.id, tt.prefix, got, tt.expected)
			}
		})
	}
}
