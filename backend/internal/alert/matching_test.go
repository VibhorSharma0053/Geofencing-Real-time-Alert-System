package alert

import (
	"context"
	"testing"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/location"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// MatchesRule implements the exact SQL matching condition in Go for independent verification:
// geofence_id = event.geofence AND (vehicle_id IS NULL OR vehicle_id = event.vehicle)
// AND (event_type = event.type OR event_type = 'both')
func MatchesRule(ruleGeofenceID string, ruleVehicleID *string, ruleEventType string, eventGeofenceID, eventVehicleID, eventType string) bool {
	if ruleGeofenceID != eventGeofenceID {
		return false
	}
	if ruleVehicleID != nil && *ruleVehicleID != eventVehicleID {
		return false
	}
	if ruleEventType != models.EventTypeBoth && ruleEventType != eventType {
		return false
	}
	return true
}

func ptr(s string) *string {
	return &s
}

func TestRuleMatchingCombinations(t *testing.T) {
	tests := []struct {
		name            string
		ruleGeofenceID  string
		ruleVehicleID   *string
		ruleEventType   string
		eventGeofenceID string
		eventVehicleID  string
		eventType       string
		wantMatch       bool
	}{
		// 1. Rule: vehicle=NULL (all vehicles), event_type=entry
		{"all vehicles, entry rule - entry matches", "geo_1", nil, "entry", "geo_1", "veh_1", "entry", true},
		{"all vehicles, entry rule - exit does not match", "geo_1", nil, "entry", "geo_1", "veh_1", "exit", false},
		{"all vehicles, entry rule - different vehicle matches", "geo_1", nil, "entry", "geo_1", "veh_2", "entry", true},

		// 2. Rule: vehicle=NULL (all vehicles), event_type=exit
		{"all vehicles, exit rule - exit matches", "geo_1", nil, "exit", "geo_1", "veh_1", "exit", true},
		{"all vehicles, exit rule - entry does not match", "geo_1", nil, "exit", "geo_1", "veh_1", "entry", false},

		// 3. Rule: vehicle=NULL (all vehicles), event_type=both
		{"all vehicles, both rule - entry matches", "geo_1", nil, "both", "geo_1", "veh_1", "entry", true},
		{"all vehicles, both rule - exit matches", "geo_1", nil, "both", "geo_1", "veh_1", "exit", true},

		// 4. Rule: specific vehicle (veh_1), event_type=entry
		{"specific veh_1, entry rule - veh_1 entry matches", "geo_1", ptr("veh_1"), "entry", "geo_1", "veh_1", "entry", true},
		{"specific veh_1, entry rule - veh_2 entry does not match", "geo_1", ptr("veh_1"), "entry", "geo_1", "veh_2", "entry", false},
		{"specific veh_1, entry rule - veh_1 exit does not match", "geo_1", ptr("veh_1"), "entry", "geo_1", "veh_1", "exit", false},

		// 5. Rule: specific vehicle (veh_1), event_type=exit
		{"specific veh_1, exit rule - veh_1 exit matches", "geo_1", ptr("veh_1"), "exit", "geo_1", "veh_1", "exit", true},
		{"specific veh_1, exit rule - veh_2 exit does not match", "geo_1", ptr("veh_1"), "exit", "geo_1", "veh_2", "exit", false},
		{"specific veh_1, exit rule - veh_1 entry does not match", "geo_1", ptr("veh_1"), "exit", "geo_1", "veh_1", "entry", false},

		// 6. Rule: specific vehicle (veh_1), event_type=both
		{"specific veh_1, both rule - veh_1 entry matches", "geo_1", ptr("veh_1"), "both", "geo_1", "veh_1", "entry", true},
		{"specific veh_1, both rule - veh_1 exit matches", "geo_1", ptr("veh_1"), "both", "geo_1", "veh_1", "exit", true},
		{"specific veh_1, both rule - veh_2 entry does not match", "geo_1", ptr("veh_1"), "both", "geo_1", "veh_2", "entry", false},
		{"specific veh_1, both rule - veh_2 exit does not match", "geo_1", ptr("veh_1"), "both", "geo_1", "veh_2", "exit", false},

		// 7. Different geofence
		{"different geofence does not match", "geo_1", nil, "both", "geo_2", "veh_1", "entry", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := MatchesRule(tt.ruleGeofenceID, tt.ruleVehicleID, tt.ruleEventType, tt.eventGeofenceID, tt.eventVehicleID, tt.eventType)
			if got != tt.wantMatch {
				t.Errorf("MatchesRule() = %v, want %v", got, tt.wantMatch)
			}
		})
	}
}

type mockAlertStore struct {
	matchingRuleIDs []string
	recordedEvents  []string
}

func (m *mockAlertStore) CreateRule(ctx context.Context, rule *models.AlertRule) error {
	return nil
}

func (m *mockAlertStore) ListRules(ctx context.Context, geofenceID, vehicleID string) ([]models.AlertRuleDetail, error) {
	return nil, nil
}

func (m *mockAlertStore) DeleteRule(ctx context.Context, alertID string) error {
	return nil
}

func (m *mockAlertStore) FindMatchingRules(ctx context.Context, geofenceID, vehicleID, eventType string) ([]string, error) {
	return m.matchingRuleIDs, nil
}

func (m *mockAlertStore) RecordAlertEvent(ctx context.Context, eventID, violationID string, ruleIDs []string, payload any) error {
	m.recordedEvents = append(m.recordedEvents, eventID)
	return nil
}

func TestDispatcherMatchesAndDispatches(t *testing.T) {
	t.Run("matching rule records alert event", func(t *testing.T) {
		store := &mockAlertStore{
			matchingRuleIDs: []string{"alert_1", "alert_2"}, // multiple matching rules
		}
		dispatcher := NewDispatcher(store, nil)

		notification := location.EventNotification{
			Vehicle: location.VehicleInfo{
				ID:            "veh_1",
				VehicleNumber: "KA-01",
				DriverName:    "John",
			},
			Events: []location.DetectedEvent{
				{
					ViolationID:  "viol_1",
					GeofenceID:   "geo_1",
					GeofenceName: "Zone 1",
					Category:     "delivery_zone",
					EventType:    "entry",
					Timestamp:    time.Now().UTC(),
				},
			},
			Location: location.LocationInfo{
				Latitude:  37.77,
				Longitude: -122.41,
			},
		}

		dispatcher.Notify(context.Background(), notification)

		// Must record exactly ONE alert event even when multiple rules match
		if len(store.recordedEvents) != 1 {
			t.Fatalf("expected 1 recorded alert event, got %d", len(store.recordedEvents))
		}
	})

	t.Run("no matching rule does nothing", func(t *testing.T) {
		store := &mockAlertStore{
			matchingRuleIDs: []string{}, // no rules matched
		}
		dispatcher := NewDispatcher(store, nil)

		notification := location.EventNotification{
			Vehicle: location.VehicleInfo{ID: "veh_1"},
			Events: []location.DetectedEvent{
				{
					ViolationID:  "viol_1",
					GeofenceID:   "geo_1",
					GeofenceName: "Zone 1",
					Category:     "delivery_zone",
					EventType:    "entry",
					Timestamp:    time.Now().UTC(),
				},
			},
			Location: location.LocationInfo{Latitude: 37.77, Longitude: -122.41},
		}

		dispatcher.Notify(context.Background(), notification)

		if len(store.recordedEvents) != 0 {
			t.Errorf("expected 0 recorded events, got %d", len(store.recordedEvents))
		}
	})
}
