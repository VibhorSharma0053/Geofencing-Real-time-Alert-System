package location

// DiffGeofences computes the difference between previous and current geofence ID sets.
// Returns entered (in current but not in previous) and exited (in previous but not in current).
// Guarantees order stability, handles duplicates and empty/nil slices, returning non-nil empty slices.
func DiffGeofences(previous, current []string) (entered, exited []string) {
	prevSet := make(map[string]bool, len(previous))
	for _, id := range previous {
		if id != "" {
			prevSet[id] = true
		}
	}

	currSet := make(map[string]bool, len(current))
	for _, id := range current {
		if id != "" {
			currSet[id] = true
		}
	}

	entered = make([]string, 0)
	seenEntered := make(map[string]bool)
	for _, id := range current {
		if id != "" && !prevSet[id] && !seenEntered[id] {
			entered = append(entered, id)
			seenEntered[id] = true
		}
	}

	exited = make([]string, 0)
	seenExited := make(map[string]bool)
	for _, id := range previous {
		if id != "" && !currSet[id] && !seenExited[id] {
			exited = append(exited, id)
			seenExited[id] = true
		}
	}

	return entered, exited
}
