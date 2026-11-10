package models

import "time"

// Category constants for Geofences.
const (
	CategoryDeliveryZone   = "delivery_zone"
	CategoryRestrictedZone = "restricted_zone"
	CategoryTollZone       = "toll_zone"
	CategoryCustomerArea   = "customer_area"
)

// EventType constants for alerts and violations.
const (
	EventTypeEntry = "entry"
	EventTypeExit  = "exit"
	EventTypeBoth  = "both"
)

// Status constants.
const (
	StatusActive   = "active"
	StatusInactive = "inactive"
	StatusInside   = "inside"
)

// Coordinate represents a [latitude, longitude] pair as per API specification.
type Coordinate [2]float64

func (c Coordinate) Latitude() float64  { return c[0] }
func (c Coordinate) Longitude() float64 { return c[1] }

// Geofence domain model.
type Geofence struct {
	ID          string       `json:"id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Category    string       `json:"category"`
	Coordinates []Coordinate `json:"coordinates"`
	Status      string       `json:"status"`
	CreatedAt   time.Time    `json:"created_at"`
}

// Vehicle domain model.
type Vehicle struct {
	ID            string    `json:"id"`
	VehicleNumber string    `json:"vehicle_number"`
	DriverName    string    `json:"driver_name"`
	VehicleType   string    `json:"vehicle_type"`
	Phone         string    `json:"phone"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"created_at"`
}

// VehicleLocation domain model.
type VehicleLocation struct {
	ID         int64     `json:"id"`
	VehicleID  string    `json:"vehicle_id"`
	Latitude   float64   `json:"latitude"`
	Longitude  float64   `json:"longitude"`
	RecordedAt time.Time `json:"recorded_at"`
	CreatedAt  time.Time `json:"created_at"`
}

// VehicleGeofenceState tracks current containment per vehicle.
type VehicleGeofenceState struct {
	VehicleID  string    `json:"vehicle_id"`
	GeofenceID string    `json:"geofence_id"`
	EnteredAt  time.Time `json:"entered_at"`
}

// AlertRule domain model.
type AlertRule struct {
	ID         string    `json:"id"`
	GeofenceID string    `json:"geofence_id"`
	VehicleID  *string   `json:"vehicle_id,omitempty"`
	EventType  string    `json:"event_type"`
	Status     string    `json:"status"`
	CreatedAt  time.Time `json:"created_at"`
}

// ViolationEvent represents every detected entry/exit event.
type ViolationEvent struct {
	ID            string    `json:"id"`
	VehicleID     string    `json:"vehicle_id"`
	VehicleNumber string    `json:"vehicle_number,omitempty"`
	GeofenceID    string    `json:"geofence_id"`
	GeofenceName  string    `json:"geofence_name,omitempty"`
	EventType     string    `json:"event_type"`
	Latitude      float64   `json:"latitude"`
	Longitude     float64   `json:"longitude"`
	Timestamp     time.Time `json:"timestamp"`
	CreatedAt     time.Time `json:"created_at"`
}

// AlertEvent stores alerts matched against active rules.
type AlertEvent struct {
	ID          string         `json:"id"`
	ViolationID string         `json:"violation_id"`
	RuleIDs     []string       `json:"rule_ids"`
	Payload     map[string]any `json:"payload"`
	CreatedAt   time.Time      `json:"created_at"`
}

// WebSocketAlertPayload defines the exact real-time message contract pushed to clients.
type WebSocketAlertPayload struct {
	EventID   string                    `json:"event_id"`
	EventType string                    `json:"event_type"` // "entry" | "exit"
	Timestamp string                    `json:"timestamp"`
	Vehicle   WebSocketVehiclePayload   `json:"vehicle"`
	Geofence  WebSocketGeofencePayload  `json:"geofence"`
	Location  WebSocketLocationPayload  `json:"location"`
}

type WebSocketVehiclePayload struct {
	VehicleID     string `json:"vehicle_id"`
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
}

type WebSocketGeofencePayload struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

type WebSocketLocationPayload struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
}

// CreateGeofenceRequest defines the expected payload for POST /geofences.
type CreateGeofenceRequest struct {
	Name        string       `json:"name"`
	Description string       `json:"description,omitempty"`
	Coordinates []Coordinate `json:"coordinates"`
	Category    string       `json:"category"`
}

// CreateGeofenceResponse defines the response payload for POST /geofences.
type CreateGeofenceResponse struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// ListGeofencesResponse defines the response payload for GET /geofences.
type ListGeofencesResponse struct {
	Geofences []Geofence `json:"geofences"`
}

// CreateVehicleRequest defines the expected payload for POST /vehicles.
type CreateVehicleRequest struct {
	VehicleNumber string `json:"vehicle_number"`
	DriverName    string `json:"driver_name"`
	VehicleType   string `json:"vehicle_type"`
	Phone         string `json:"phone"`
}

// CreateVehicleResponse defines the response payload for POST /vehicles.
type CreateVehicleResponse struct {
	ID            string `json:"id"`
	VehicleNumber string `json:"vehicle_number"`
	Status        string `json:"status"`
}

// ListVehiclesResponse defines the response payload for GET /vehicles.
type ListVehiclesResponse struct {
	Vehicles []Vehicle `json:"vehicles"`
}

// PostLocationRequest defines payload for POST /vehicles/location.
type PostLocationRequest struct {
	VehicleID string   `json:"vehicle_id"`
	Latitude  *float64 `json:"latitude"`
	Longitude *float64 `json:"longitude"`
	Timestamp string   `json:"timestamp"`
}

// CurrentGeofenceStatus defines a geofence with inside status in POST /vehicles/location.
type CurrentGeofenceStatus struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Status       string `json:"status"` // "inside"
}

// PostLocationResponse defines response for POST /vehicles/location.
type PostLocationResponse struct {
	VehicleID        string                  `json:"vehicle_id"`
	LocationUpdated  bool                    `json:"location_updated"`
	CurrentGeofences []CurrentGeofenceStatus `json:"current_geofences"`
}

// CurrentLocationInfo defines coordinates and timestamp in GET /vehicles/location/{vehicle_id}.
type CurrentLocationInfo struct {
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Timestamp time.Time `json:"timestamp"`
}

// VehicleGeofenceDetail defines a geofence with category in GET /vehicles/location/{vehicle_id}.
type VehicleGeofenceDetail struct {
	GeofenceID   string `json:"geofence_id"`
	GeofenceName string `json:"geofence_name"`
	Category     string `json:"category"`
}

// GetVehicleLocationResponse defines response for GET /vehicles/location/{vehicle_id}.
type GetVehicleLocationResponse struct {
	VehicleID        string                  `json:"vehicle_id"`
	VehicleNumber    string                  `json:"vehicle_number"`
	CurrentLocation  *CurrentLocationInfo    `json:"current_location"`
	CurrentGeofences []VehicleGeofenceDetail `json:"current_geofences"`
}

// ListViolationsResponse defines response for GET /violations/history.
type ListViolationsResponse struct {
	Violations []ViolationEvent `json:"violations"`
	TotalCount int64            `json:"total_count"`
}
