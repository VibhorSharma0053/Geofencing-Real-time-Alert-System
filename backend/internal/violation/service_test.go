package violation

import (
	"context"
	"testing"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/models"
)

type mockStore struct {
	capturedFilter Filter
	result         []models.ViolationEvent
	totalCount     int64
	err            error
}

func (m *mockStore) GetHistory(ctx context.Context, filter Filter) ([]models.ViolationEvent, int64, error) {
	m.capturedFilter = filter
	return m.result, m.totalCount, m.err
}

func TestViolationGetHistoryValidation(t *testing.T) {
	store := &mockStore{}
	svc := NewService(store)
	ctx := context.Background()

	t.Run("default limit and offset applied", func(t *testing.T) {
		res, err := svc.GetHistory(ctx, HistoryQueryParams{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if store.capturedFilter.Limit != 50 {
			t.Errorf("expected default limit 50, got %d", store.capturedFilter.Limit)
		}
		if store.capturedFilter.Offset != 0 {
			t.Errorf("expected default offset 0, got %d", store.capturedFilter.Offset)
		}
		if res.Violations == nil {
			t.Errorf("expected non-nil violations slice")
		}
	})

	t.Run("limit clamped to 500 when greater", func(t *testing.T) {
		_, err := svc.GetHistory(ctx, HistoryQueryParams{Limit: "1000"})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if store.capturedFilter.Limit != 500 {
			t.Errorf("expected limit clamped to 500, got %d", store.capturedFilter.Limit)
		}
	})

	t.Run("invalid limit rejected", func(t *testing.T) {
		invalidLimits := []string{"0", "-5", "abc"}
		for _, l := range invalidLimits {
			_, err := svc.GetHistory(ctx, HistoryQueryParams{Limit: l})
			if err == nil {
				t.Errorf("expected error for limit %q, got nil", l)
			}
		}
	})

	t.Run("invalid offset rejected", func(t *testing.T) {
		invalidOffsets := []string{"-1", "abc"}
		for _, o := range invalidOffsets {
			_, err := svc.GetHistory(ctx, HistoryQueryParams{Offset: o})
			if err == nil {
				t.Errorf("expected error for offset %q, got nil", o)
			}
		}
	})

	t.Run("invalid date format rejected", func(t *testing.T) {
		_, err := svc.GetHistory(ctx, HistoryQueryParams{StartDate: "2026-11-10"})
		if err == nil {
			t.Fatal("expected error for non-RFC3339 date")
		}
	})

	t.Run("start_date after end_date rejected", func(t *testing.T) {
		_, err := svc.GetHistory(ctx, HistoryQueryParams{
			StartDate: "2026-11-10T15:00:00Z",
			EndDate:   "2026-11-10T14:00:00Z",
		})
		if err == nil {
			t.Fatal("expected error when start_date > end_date")
		}
	})

	t.Run("valid dates accepted and converted to UTC", func(t *testing.T) {
		start := "2026-11-10T10:00:00+05:30"
		end := "2026-11-10T12:00:00+05:30"
		_, err := svc.GetHistory(ctx, HistoryQueryParams{
			StartDate: start,
			EndDate:   end,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if store.capturedFilter.StartDate.Location() != time.UTC {
			t.Errorf("expected UTC start date, got %v", store.capturedFilter.StartDate.Location())
		}
	})
}
