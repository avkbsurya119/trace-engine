"""Errors that map to clear HTTP responses instead of bare 500s."""


class MemoryUnavailableError(RuntimeError):
    """Hindsight could not be reached or rejected the request."""
