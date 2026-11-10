package vehicle

import (
	"net/http"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Handler handles HTTP requests for vehicle endpoints.
type Handler struct {
	service Service
}

// NewHandler constructs a new vehicle Handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Create handles POST /vehicles to validate and register a new vehicle.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req models.CreateVehicleRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	res, err := h.service.Create(r.Context(), req)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res, start)
}

// List handles GET /vehicles to retrieve all registered vehicles, with optional limit/offset pagination.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	vehicles, totalCount, err := h.service.List(r.Context(), limitStr, offsetStr)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	if totalCount == nil {
		httpx.WriteJSON(w, http.StatusOK, models.ListVehiclesResponse{
			Vehicles: vehicles,
		}, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"vehicles":    vehicles,
		"total_count": *totalCount,
	}, start)
}
