.PHONY: db-up db-down run tidy test

# Spin up PostGIS database container
db-up:
	docker compose up -d db

# Stop and remove database container
db-down:
	docker compose down

# Run the Go backend server locally
run:
	cd backend && go run ./cmd/server

# Tidy Go module dependencies
tidy:
	cd backend && go mod tidy

# Run all backend unit and integration tests
test:
	cd backend && go test -v ./...
