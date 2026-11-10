package ids

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	PrefixGeofence  = "geo"
	PrefixVehicle   = "veh"
	PrefixAlert     = "alert"
	PrefixViolation = "viol"
	PrefixEvent     = "evt"
)

// New generates an ID with the specified prefix followed by an underscore
// and 12 random hexadecimal characters. For example, New("geo") returns "geo_1a2b3c4d5e6f".
func New(prefix string) string {
	cleanPrefix := strings.TrimSuffix(prefix, "_")
	var b [6]byte // 6 bytes = 12 hex characters
	if _, err := rand.Read(b[:]); err != nil {
		panic(fmt.Sprintf("failed to read secure random bytes: %v", err))
	}
	return cleanPrefix + "_" + hex.EncodeToString(b[:])
}

// IsValid checks whether an ID conforms to the format <prefix>_<12 hex chars>.
func IsValid(id string, prefix string) bool {
	cleanPrefix := strings.TrimSuffix(prefix, "_")
	expectedPrefix := cleanPrefix + "_"
	if !strings.HasPrefix(id, expectedPrefix) {
		return false
	}
	hexPart := strings.TrimPrefix(id, expectedPrefix)
	if len(hexPart) != 12 {
		return false
	}
	for _, c := range hexPart {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}
