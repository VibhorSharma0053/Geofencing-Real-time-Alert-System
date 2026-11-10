package httpx

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/apperror"
)

// MaxRequestBodyBytes limits JSON request bodies to 1MB.
const MaxRequestBodyBytes = 1048576 // 1MB

// WriteJSON writes a JSON payload to the ResponseWriter, injecting "time_ns" as a string
// representing handler execution time in nanoseconds measured from the start time.
func WriteJSON(w http.ResponseWriter, status int, payload any, start time.Time) {
	timeNs := strconv.FormatInt(time.Since(start).Nanoseconds(), 10)

	var responseMap map[string]any
	switch v := payload.(type) {
	case nil:
		responseMap = make(map[string]any)
	case map[string]any:
		responseMap = v
	default:
		data, err := json.Marshal(v)
		if err != nil {
			WriteError(w, http.StatusInternalServerError, "failed to marshal response payload", start)
			return
		}
		responseMap = make(map[string]any)
		if err := json.Unmarshal(data, &responseMap); err != nil {
			WriteError(w, http.StatusInternalServerError, "failed to construct response payload", start)
			return
		}
	}

	responseMap["time_ns"] = timeNs

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(responseMap)
}

// WriteError writes a standardized JSON error response:
// {"error": "human readable message", "time_ns": "..."}
// If optional details are provided, they are included under the "details" key.
func WriteError(w http.ResponseWriter, status int, message string, start time.Time, details ...any) {
	resp := map[string]any{
		"error": message,
	}
	if len(details) > 0 && details[0] != nil {
		resp["details"] = details[0]
	}
	WriteJSON(w, status, resp, start)
}

// DecodeJSON decodes a JSON request body into dst.
// Enforces a 1MB body limit, allows lenient decoding (unknown fields allowed),
// and returns user-friendly error messages for malformed JSON or empty bodies.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) error {
	if r.Body == nil {
		return errors.New("request body is empty")
	}

	r.Body = http.MaxBytesReader(w, r.Body, MaxRequestBodyBytes)
	decoder := json.NewDecoder(r.Body)

	if err := decoder.Decode(dst); err != nil {
		var syntaxError *json.SyntaxError
		var unmarshalTypeError *json.UnmarshalTypeError
		var maxBytesError *http.MaxBytesError

		switch {
		case errors.As(err, &syntaxError):
			return fmt.Errorf("malformed JSON at position %d", syntaxError.Offset)
		case errors.Is(err, io.ErrUnexpectedEOF):
			return errors.New("malformed JSON: unexpected end of input")
		case errors.As(err, &unmarshalTypeError):
			if unmarshalTypeError.Field != "" {
				return fmt.Errorf("invalid type for field %q (expected %s)", unmarshalTypeError.Field, unmarshalTypeError.Type)
			}
			return fmt.Errorf("invalid type at position %d (expected %s)", unmarshalTypeError.Offset, unmarshalTypeError.Type)
		case errors.Is(err, io.EOF):
			return errors.New("request body must not be empty")
		case errors.As(err, &maxBytesError):
			return fmt.Errorf("request body exceeds limit of %d bytes", maxBytesError.Limit)
		default:
			return fmt.Errorf("invalid request body: %w", err)
		}
	}

	return nil
}

// WriteAppError inspects standard application errors (validation, conflict, bad request, not found)
// and maps them directly to the appropriate HTTP status code and JSON structure with time_ns.
func WriteAppError(w http.ResponseWriter, err error, start time.Time) {
	var valErr *apperror.ValidationError
	var conflictErr *apperror.ConflictError
	var badReqErr *apperror.BadRequestError
	var notFoundErr *apperror.NotFoundError

	switch {
	case errors.As(err, &valErr):
		if len(valErr.Details) > 0 {
			WriteError(w, http.StatusBadRequest, valErr.Message, start, valErr.Details)
		} else {
			WriteError(w, http.StatusBadRequest, valErr.Message, start)
		}
	case errors.As(err, &conflictErr):
		WriteError(w, http.StatusConflict, conflictErr.Message, start)
	case errors.As(err, &badReqErr):
		WriteError(w, http.StatusBadRequest, badReqErr.Message, start)
	case errors.As(err, &notFoundErr):
		WriteError(w, http.StatusNotFound, notFoundErr.Message, start)
	default:
		slog.Error("unhandled internal error", "error", err)
		WriteError(w, http.StatusInternalServerError, "internal server error", start)
	}
}

