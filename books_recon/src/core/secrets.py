"""Secret access placeholders.

Secrets must not be committed in source. The initial implementation supports:
- environment variables
- future OS keyring integration
- future encrypted local secret store integration
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SecretReference:
    provider: str
    key: str


def describe_secret_strategy() -> dict[str, str]:
    return {
        "env": "Use environment variables for local development.",
        "keyring": "Planned OS keyring support for local secure token storage.",
        "encrypted_local": "Planned encrypted local file strategy for workstation deployments.",
    }

