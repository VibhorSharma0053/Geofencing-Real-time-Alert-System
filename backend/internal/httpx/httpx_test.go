package httpx

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"
)

func TestWriteJSONWithMap(t *testing.T) {
	start := time.Now()
	rec := httptest.NewRecorder()

	payload := map[string]any{
		"id":     "geo_123456789abc",
		"status": "active",
	}

	WriteJSON(rec, http.StatusCreated, payload, start)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if res["id"] != "geo_123456789abc" {
		t.Errorf("expected id geo_123456789abc, got %v", res["id"])
	}

	timeNsVal, ok := res["time_ns"].(string)
	if !ok {
		t.Fatalf("expected time_ns to be string, got %T (%v)", res["time_ns"], res["time_ns"])
	}

	if _, err := strconv.ParseInt(timeNsVal, 10, 64); err != nil {
		t.Errorf("time_ns string could not be parsed to int: %v", err)
	}
}

func TestWriteJSONWithStruct(t *testing.T) {
	start := time.Now()
	rec := httptest.NewRecorder()

	type sample struct {
		Name string `json:"name"`
	}

	WriteJSON(rec, http.StatusOK, sample{Name: "zone-1"}, start)

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to unmarshal: %v", err)
	}

	if res["name"] != "zone-1" {
		t.Errorf("expected name zone-1, got %v", res["name"])
	}
	if _, ok := res["time_ns"].(string); !ok {
		t.Fatalf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestWriteError(t *testing.T) {
	start := time.Now()
	rec := httptest.NewRecorder()

	WriteError(rec, http.StatusBadRequest, "invalid vehicle coordinates", start, []string{"lat out of range"})

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", rec.Code)
	}

	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode error body: %v", err)
	}

	if res["error"] != "invalid vehicle coordinates" {
		t.Errorf("unexpected error message: %v", res["error"])
	}
	if res["details"] == nil {
		t.Errorf("expected details to be present")
	}
	if _, ok := res["time_ns"].(string); !ok {
		t.Fatalf("expected time_ns string, got %v", res["time_ns"])
	}
}

func TestDecodeJSON(t *testing.T) {
	t.Run("valid body", func(t *testing.T) {
		body := bytes.NewBufferString(`{"name":"test"}`)
		req := httptest.NewRequest(http.MethodPost, "/", body)
		rec := httptest.NewRecorder()

		var dst struct {
			Name string `json:"name"`
		}

		err := DecodeJSON(rec, req, &dst)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if dst.Name != "test" {
			t.Errorf("expected test, got %s", dst.Name)
		}
	})

	t.Run("empty body", func(t *testing.T) {
		body := bytes.NewBufferString("")
		req := httptest.NewRequest(http.MethodPost, "/", body)
		rec := httptest.NewRecorder()

		var dst map[string]any
		err := DecodeJSON(rec, req, &dst)
		if err == nil || !strings.Contains(err.Error(), "must not be empty") {
			t.Fatalf("expected empty body error, got %v", err)
		}
	})

	t.Run("malformed body", func(t *testing.T) {
		body := bytes.NewBufferString(`{"name":`)
		req := httptest.NewRequest(http.MethodPost, "/", body)
		rec := httptest.NewRecorder()

		var dst map[string]any
		err := DecodeJSON(rec, req, &dst)
		if err == nil {
			t.Fatalf("expected error for malformed json")
		}
	})
}
