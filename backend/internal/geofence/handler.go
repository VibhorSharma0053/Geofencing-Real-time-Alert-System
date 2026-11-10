package geofence

import (
	"net/http"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Handler handles HTTP requests for the geofence endpoints.
type Handler struct {
	service Service
}

// NewHandler constructs a new geofence Handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Create handles POST /geofences to validate and create a new geofence.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req models.CreateGeofenceRequest
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

// List handles GET /geofences with optional category filter and optional limit/offset pagination.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	category := r.URL.Query().Get("category")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	geofences, totalCount, err := h.service.List(r.Context(), category, limitStr, offsetStr)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	if totalCount == nil {
		httpx.WriteJSON(w, http.StatusOK, models.ListGeofencesResponse{
			Geofences: geofences,
		}, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"geofences":   geofences,
		"total_count": *totalCount,
	}, start)
}
