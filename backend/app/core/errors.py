"""Errors that map to clear HTTP responses instead of bare 500s."""


class MemoryUnavailableError(RuntimeError):
    """Hindsight could not be reached or rejected the request."""


def describe_memory_error(exc: Exception) -> str:
    """
    Short, human-readable reason for a Hindsight failure. The SDK's own
    str() includes full HTTP headers; the useful part is the JSON detail.
    """
    import json

    status = getattr(exc, "status", None)
    body = getattr(exc, "body", None)
    detail = None
    if body:
        try:
            detail = json.loads(body).get("detail")
        except (ValueError, AttributeError):
            detail = str(body)[:200]
    if detail:
        return f"Hindsight {status}: {detail}" if status else f"Hindsight: {detail}"
    text = str(exc).strip().splitlines()[0] if str(exc).strip() else type(exc).__name__
    return f"Hindsight unreachable: {text[:200]}"
