package violation

import (
	"net/http"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
)

// Handler handles HTTP requests for violation history queries.
type Handler struct {
	service Service
}

// NewHandler constructs a new violation Handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// GetHistory handles GET /violations/history with filtering, date bounds, and pagination.
func (h *Handler) GetHistory(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	query := r.URL.Query()

	params := HistoryQueryParams{
		VehicleID:  query.Get("vehicle_id"),
		GeofenceID: query.Get("geofence_id"),
		StartDate:  query.Get("start_date"),
		EndDate:    query.Get("end_date"),
		Limit:      query.Get("limit"),
		Offset:     query.Get("offset"),
	}

	res, err := h.service.GetHistory(r.Context(), params)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, res, start)
}
