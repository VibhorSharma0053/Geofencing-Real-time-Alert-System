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

// List handles GET /alerts with optional filters and optional limit/offset pagination.
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	start := time.Now()

	geofenceID := r.URL.Query().Get("geofence_id")
	vehicleID := r.URL.Query().Get("vehicle_id")
	limitStr := r.URL.Query().Get("limit")
	offsetStr := r.URL.Query().Get("offset")

	rules, totalCount, err := h.service.ListRules(r.Context(), geofenceID, vehicleID, limitStr, offsetStr)
	if err != nil {
		httpx.WriteAppError(w, err, start)
		return
	}

	if totalCount == nil {
		httpx.WriteJSON(w, http.StatusOK, models.ListAlertsResponse{
			Alerts: rules,
		}, start)
		return
	}

	httpx.WriteJSON(w, http.StatusOK, map[string]any{
		"alerts":      rules,
		"total_count": *totalCount,
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
