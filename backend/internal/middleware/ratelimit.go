package middleware

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/vibhorsharma/geofence-backend/internal/httpx"
	"golang.org/x/time/rate"
)

type ipLimiter struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// RateLimiter manages per-client-IP rate limits with periodic idle limiter eviction.
type RateLimiter struct {
	mu       sync.Mutex
	limiters map[string]*ipLimiter
	rps      rate.Limit
	burst    int
	quit     chan struct{}
}

// NewRateLimiter initializes a per-IP rate limiter with background eviction.
func NewRateLimiter(rps float64, burst int) *RateLimiter {
	rl := &RateLimiter{
		limiters: make(map[string]*ipLimiter),
		rps:      rate.Limit(rps),
		burst:    burst,
		quit:     make(chan struct{}),
	}
	go rl.cleanupLoop()
	return rl
}

// Close stops the background eviction ticker.
func (rl *RateLimiter) Close() {
	close(rl.quit)
}

func (rl *RateLimiter) cleanupLoop() {
	ticker := time.NewTicker(3 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			rl.mu.Lock()
			now := time.Now()
			for ip, entry := range rl.limiters {
				if now.Sub(entry.lastSeen) > 10*time.Minute {
					delete(rl.limiters, ip)
				}
			}
			rl.mu.Unlock()
		case <-rl.quit:
			return
		}
	}
}

func (rl *RateLimiter) getLimiter(ip string) *rate.Limiter {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	entry, exists := rl.limiters[ip]
	if !exists {
		limiter := rate.NewLimiter(rl.rps, rl.burst)
		rl.limiters[ip] = &ipLimiter{
			limiter:  limiter,
			lastSeen: time.Now(),
		}
		return limiter
	}

	entry.lastSeen = time.Now()
	return entry.limiter
}

// GetClientIP extracts the real client IP, prioritizing the first IP in X-Forwarded-For.
func GetClientIP(r *http.Request) string {
	xff := r.Header.Get("X-Forwarded-For")
	if xff != "" {
		parts := strings.Split(xff, ",")
		clientIP := strings.TrimSpace(parts[0])
		if clientIP != "" {
			return clientIP
		}
	}

	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// Limit applies rate limiting specifically to POST /vehicles/location requests.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && (r.URL.Path == "/vehicles/location" || r.URL.Path == "/vehicles/location/") {
			start := time.Now()
			ip := GetClientIP(r)
			limiter := rl.getLimiter(ip)

			if !limiter.Allow() {
				w.Header().Set("Retry-After", "1")
				httpx.WriteError(w, http.StatusTooManyRequests, "rate limit exceeded", start)
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}
