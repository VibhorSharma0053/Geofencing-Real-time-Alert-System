package location

import (
	"reflect"
	"testing"
)

func TestDiffGeofences(t *testing.T) {
	tests := []struct {
		name         string
		previous     []string
		current      []string
		wantEntered  []string
		wantExited   []string
	}{
		{
			name:        "empty / empty",
			previous:    []string{},
			current:     []string{},
			wantEntered: []string{},
			wantExited:  []string{},
		},
		{
			name:        "nil slices",
			previous:    nil,
			current:     nil,
			wantEntered: []string{},
			wantExited:  []string{},
		},
		{
			name:        "first-ever location (entered one geofence)",
			previous:    []string{},
			current:     []string{"geo_1"},
			wantEntered: []string{"geo_1"},
			wantExited:  []string{},
		},
		{
			name:        "first-ever location (entered multiple geofences)",
			previous:    []string{},
			current:     []string{"geo_1", "geo_2"},
			wantEntered: []string{"geo_1", "geo_2"},
			wantExited:  []string{},
		},
		{
			name:        "no change",
			previous:    []string{"geo_1", "geo_2"},
			current:     []string{"geo_1", "geo_2"},
			wantEntered: []string{},
			wantExited:  []string{},
		},
		{
			name:        "entry only",
			previous:    []string{"geo_1"},
			current:     []string{"geo_1", "geo_2"},
			wantEntered: []string{"geo_2"},
			wantExited:  []string{},
		},
		{
			name:        "exit only",
			previous:    []string{"geo_1", "geo_2"},
			current:     []string{"geo_1"},
			wantEntered: []string{},
			wantExited:  []string{"geo_2"},
		},
		{
			name:        "simultaneous entry and exit",
			previous:    []string{"geo_1", "geo_2"},
			current:     []string{"geo_2", "geo_3"},
			wantEntered: []string{"geo_3"},
			wantExited:  []string{"geo_1"},
		},
		{
			name:        "overlapping with duplicates",
			previous:    []string{"geo_1", "geo_1", "geo_2"},
			current:     []string{"geo_2", "geo_3", "geo_3"},
			wantEntered: []string{"geo_3"},
			wantExited:  []string{"geo_1"},
		},
		{
			name:        "complete departure (exited all)",
			previous:    []string{"geo_1", "geo_2"},
			current:     []string{},
			wantEntered: []string{},
			wantExited:  []string{"geo_1", "geo_2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotEntered, gotExited := DiffGeofences(tt.previous, tt.current)

			if !reflect.DeepEqual(gotEntered, tt.wantEntered) {
				t.Errorf("entered mismatch: got %v, want %v", gotEntered, tt.wantEntered)
			}
			if !reflect.DeepEqual(gotExited, tt.wantExited) {
				t.Errorf("exited mismatch: got %v, want %v", gotExited, tt.wantExited)
			}
		})
	}
}
