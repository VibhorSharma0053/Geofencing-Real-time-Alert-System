package config

import (
	"os"
	"strings"
)

// Config holds runtime configuration loaded from environment variables.
type Config struct {
	Port           string
	DatabaseURL    string
	AllowedOrigins string
}

// Load loads configuration from environment variables with sensible defaults.
func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/geofence_db?sslmode=disable"
	}

	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173,http://localhost:3000"
	}

	return &Config{
		Port:           port,
		DatabaseURL:    dbURL,
		AllowedOrigins: allowedOrigins,
	}
}

// AllowedOriginsList returns the allowed origins split into a string slice.
func (c *Config) AllowedOriginsList() []string {
	if c.AllowedOrigins == "" {
		return []string{"*"}
	}
	parts := strings.Split(c.AllowedOrigins, ",")
	origins := make([]string, 0, len(parts))
	for _, p := range parts {
		trimmed := strings.TrimSpace(p)
		if trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	if len(origins) == 0 {
		return []string{"*"}
	}
	return origins
}
