"""Structured logging helpers with redaction hooks."""

from __future__ import annotations

import logging
import re


REDACTION_PATTERNS = [
    re.compile(r"(refresh_token=)[^&\\s]+", re.IGNORECASE),
    re.compile(r"(access_token=)[^&\\s]+", re.IGNORECASE),
    re.compile(r"(client_secret=)[^&\\s]+", re.IGNORECASE),
]


class RedactingFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        message = super().format(record)
        for pattern in REDACTION_PATTERNS:
            message = pattern.sub(r"\\1[REDACTED]", message)
        return message


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(RedactingFormatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

