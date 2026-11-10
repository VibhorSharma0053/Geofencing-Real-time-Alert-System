package alert

import (
	"net/http"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"github.com/vibhorsharma/geofence-backend/internal/models"
)

// Handler handles HTTP requests for alert rule configuration, retrieval, and deletion.
type Handler struct {
	service Service
}

// NewHandler constructs a new alert Handler.
func NewHandler(service Service) *Handler {
	return &Handler{service: service}
}

// Configure handles POST /alerts/configure to create a new alert rule.
func (h *Handler) Configure(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	var req models.ConfigureAlertRequest
	if err := httpx.DecodeJSON(w, r, &req); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, err.Error(), start)
		return
	}

	res, err := h.service.CreateRule(r.Context(), req)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusCreated, res, start)
}

// List handles GET /alerts to retrieve alert rules with optional geofence or vehicle filters.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	geofenceID := r.URL.Query().Get("geofence_id")
	vehicleID := r.URL.Query().Get("vehicle_id")

	rules, err := h.service.ListRules(r.Context(), geofenceID, vehicleID)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, models.ListAlertsResponse{
		Alerts: rules,
	}, start)
}

// Delete handles DELETE /alerts/{alert_id} to remove an active alert rule.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	alertID := r.PathValue("alert_id")

	if err := h.service.DeleteRule(r.Context(), alertID); err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, models.DeleteAlertResponse{
		Deleted: true,
		AlertID: alertID,
	}, start)
}
