# ==============================================================================
# Stage 1: Build the static Go binary
# ==============================================================================
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Install ca-certificates and git for dependency retrieval
RUN apk add --no-cache ca-certificates git

# Cache go modules in a dedicated docker layer
COPY go.mod go.sum ./
RUN go mod download && go mod verify

# Copy remaining source code and embedded migrations
COPY . .

# Compile a static, stripped binary without CGO
RUN CGO_ENABLED=0 GOOS=linux go build \
    -ldflags="-s -w" \
    -trimpath \
    -o /app/bin/server \
    ./cmd/server

# ==============================================================================
# Stage 2: Minimal, secure runtime container
# ==============================================================================
FROM alpine:3.20

# Install runtime utilities for ca root certs, tzdata, and health check
RUN apk add --no-cache ca-certificates wget tzdata && \
    adduser -D -u 10001 -s /sbin/nologin appuser

WORKDIR /app

# Copy the statically compiled binary from the builder stage
COPY --from=builder /app/bin/server /app/server

# Run as non-root user
USER appuser:appuser

EXPOSE 8080

# Health check against /health endpoint
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["/app/server"]
