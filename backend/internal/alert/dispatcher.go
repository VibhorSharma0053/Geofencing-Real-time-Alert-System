package alert

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/ids"
	"github.com/vibhorsharma/geofence-backend/internal/location"
	"github.com/vibhorsharma/geofence-backend/internal/models"
	"github.com/vibhorsharma/geofence-backend/internal/ws"
)

// Dispatcher processes detected geofence events, matches them against active alert rules,
// persists alert_events records, and broadcasts alerts over WebSockets.
type Dispatcher struct {
	store Store
	hub   *ws.Hub
}

// NewDispatcher constructs a new alert Dispatcher.
func NewDispatcher(store Store, hub *ws.Hub) *Dispatcher {
	return &Dispatcher{
		store: store,
		hub:   hub,
	}
}

// Notify evaluates detected events against active rules and broadcasts matched alerts.
// Implements location.EventNotifier.
func (d *Dispatcher) Notify(ctx context.Context, n location.EventNotification) {
	for _, ev := range n.Events {
		// 1. Find matching active rules in one query
		ruleIDs, err := d.store.FindMatchingRules(ctx, ev.GeofenceID, n.Vehicle.ID, ev.EventType)
		if err != nil {
			slog.Error("failed to find matching alert rules", "geofence_id", ev.GeofenceID, "vehicle_id", n.Vehicle.ID, "error", err)
			continue
		}

		// 2. If at least one rule matches, persist and broadcast exactly ONE alert event
		if len(ruleIDs) > 0 {
			eventID := ids.New(ids.PrefixEvent)
			timestampStr := ev.Timestamp.UTC().Format(time.RFC3339)

			wsPayload := models.WebSocketAlertPayload{
				EventID:   eventID,
				EventType: ev.EventType,
				Timestamp: timestampStr,
				Vehicle: models.WebSocketVehiclePayload{
					VehicleID:     n.Vehicle.ID,
					VehicleNumber: n.Vehicle.VehicleNumber,
					DriverName:    n.Vehicle.DriverName,
				},
				Geofence: models.WebSocketGeofencePayload{
					GeofenceID:   ev.GeofenceID,
					GeofenceName: ev.GeofenceName,
					Category:     ev.Category,
				},
				Location: models.WebSocketLocationPayload{
					Latitude:  n.Location.Latitude,
					Longitude: n.Location.Longitude,
				},
			}

			// Store in alert_events
			if err := d.store.RecordAlertEvent(ctx, eventID, ev.ViolationID, ruleIDs, wsPayload); err != nil {
				slog.Error("failed to record alert event", "event_id", eventID, "violation_id", ev.ViolationID, "error", err)
				continue
			}

			// Broadcast JSON bytes over WebSockets
			jsonBytes, err := json.Marshal(wsPayload)
			if err != nil {
				slog.Error("failed to marshal websocket alert payload", "event_id", eventID, "error", err)
				continue
			}

			if d.hub != nil {
				d.hub.Broadcast(jsonBytes)
			}
			slog.Info("broadcast alert event", "event_id", eventID, "event_type", ev.EventType, "vehicle_id", n.Vehicle.ID, "rules_matched", len(ruleIDs))
		}
	}
}
