package location

import (
	"net/http"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Handler handles HTTP requests for vehicle location tracking and retrieval.
type Handler struct {
	service Service
}

// NewHandler constructs a new location Handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// PostLocation handles POST /vehicles/location to update vehicle location and evaluate geofences.
func (h *Handler) PostLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req models.PostLocationRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	res, err := h.service.RecordLocation(r.Context(), req)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res, start)
}

// GetLocation handles GET /vehicles/location/{vehicle_id} to query current position and geofence containment.
func (h *Handler) GetLocation(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	vehicleID := r.PathValue("vehicle_id")

	res, err := h.service.GetVehicleLocation(r.Context(), vehicleID)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res, start)
}
