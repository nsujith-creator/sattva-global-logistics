"""API application stub."""

from __future__ import annotations

from fastapi import FastAPI

app = FastAPI(title="books-recon-api")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}

