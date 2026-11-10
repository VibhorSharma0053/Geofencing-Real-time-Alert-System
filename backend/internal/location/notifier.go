package location

import (
	"context"
	"time"
)

// DetectedEvent describes a single entry or exit event detected during location processing.
type DetectedEvent struct {
	ViolationID  string    `json:"violation_id"`
	GeofenceID   string    `json:"geofence_id"`
	GeofenceName string    `json:"geofence_name"`
	Category     string    `json:"category"`
	EventType    string    `json:"event_type"` // "entry" | "exit"
	Timestamp    time.Time `json:"timestamp"`
}

// VehicleInfo encapsulates vehicle metadata in a notification.
type VehicleInfo struct {
	ID            string `json:"id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

// LocationInfo encapsulates spatial coordinates in a notification.
type LocationInfo struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// EventNotification bundles vehicle, events, and location details for asynchronous notification.
type EventNotification struct {
	Vehicle  VehicleInfo     `json:"vehicle"`
	Events   []DetectedEvent `json:"events"`
	Location LocationInfo    `json:"location"`
}

// EventNotifier abstracts asynchronous notification delivery (e.g. WebSocket alert matching).
type EventNotifier interface {
	Notify(ctx context.Context, n EventNotification)
}

// NoopNotifier is a default EventNotifier implementation that discards notifications.
type NoopNotifier struct{}

// NewNoopNotifier creates a NoopNotifier instance.
func NewNoopNotifier() EventNotifier {
	return &NoopNotifier{}
}

// Notify discards the notification without error.
func (n *NoopNotifier) Notify(ctx context.Context, notification EventNotification) {
	// No-op
}
