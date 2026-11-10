package apperror

// ValidationError represents one or more input validation failures.
type ValidationError struct {
	Message string
	Details []string
}

func (e *ValidationError) Error() string {
	return e.Message
}

// NewValidationError constructs a ValidationError with a message and detail list.
func NewValidationError(message string, details ...string) *ValidationError {
	return &ValidationError{
		Message: message,
		Details: details,
	}
}

// ConflictError represents a state conflict (e.g. duplicate unique key).
type ConflictError struct {
	Message string
}

func (e *ConflictError) Error() string {
	return e.Message
}

// NewConflictError constructs a ConflictError.
func NewConflictError(message string) *ConflictError {
	return &ConflictError{Message: message}
}

// BadRequestError represents a malformed or invalid request error.
type BadRequestError struct {
	Message string
}

func (e *BadRequestError) Error() string {
	return e.Message
}

// NewBadRequestError constructs a BadRequestError.
func NewBadRequestError(message string) *BadRequestError {
	return &BadRequestError{Message: message}
}

// NotFoundError represents a missing entity.
type NotFoundError struct {
	Message string
}

func (e *NotFoundError) Error() string {
	return e.Message
}

// NewNotFoundError constructs a NotFoundError.
func NewNotFoundError(message string) *NotFoundError {
	return &NotFoundError{Message: message}
}
