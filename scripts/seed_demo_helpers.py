#!/usr/bin/env python3
"""
Seed demo helpers (agents + runtime instances) into atoll-state.json.

This script is intentionally standalone so it can be reused for walkthrough prep.
"""

from __future__ import annotations

import argparse
import json
import random
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any


NAME_POOL = [
    "Maya",
    "Noah",
    "Zoe",
    "Ethan",
    "Lia",
    "Kai",
    "Ava",
    "Leo",
    "Nora",
    "Iris",
    "Milo",
    "Rina",
    "Owen",
    "Tara",
    "Jules",
    "Sami",
    "Dani",
    "Rafa",
    "Alma",
    "Yara",
    "Nico",
    "Elin",
    "Arlo",
    "Mina",
]

AVATAR_COLORS = [
    "a0c4ff",
    "bdb2ff",
    "ffc6ff",
    "caffbf",
    "ffd6a5",
    "9bf6ff",
    "fdffb6",
    "ffadad",
    "8ecae6",
    "bde0fe",
]

MODEL_POOL = [
    "anthropic/claude-sonnet-4.6",
    "openai/gpt-4.1",
    "google/gemini-2.5-pro",
    "openai/gpt-4o-mini",
]

STATUS_POOL = ["running", "stopped", "provisioning", "error"]


@dataclass
class AgentPreset:
    preset_id: str
    name: str
    summary: str
    role_title: str
    source_path: str | None
    identity: str | None
    soul: str | None
    tools: str | None
    recommended_skills: list[str]


def utc_now() -> datetime:
    return datetime.now(UTC)


def to_iso(ts: datetime) -> str:
    return ts.isoformat().replace("+00:00", "Z")


def load_state(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        state = json.load(f)
    if state.get("version") != 1:
        raise ValueError(f"Unsupported state version in {path}")
    for key in ("tenants", "agents", "runtimeInstances"):
        if key not in state or not isinstance(state[key], list):
            raise ValueError(f"State file missing '{key}' list")
    return state


def select_tenant_id(state: dict[str, Any], tenant_id: str | None) -> str:
    tenants = state["tenants"]
    if not tenants:
        raise ValueError("State has no tenants")
    if tenant_id:
        for tenant in tenants:
            if tenant.get("id") == tenant_id:
                return tenant_id
        raise ValueError(f"Tenant '{tenant_id}' not found")
    default_tenant = next((t for t in tenants if t.get("isDefault") is True), None)
    return (default_tenant or tenants[0])["id"]


def collect_presets(state: dict[str, Any]) -> list[AgentPreset]:
    presets_raw = state.get("agentPresets", [])
    presets: list[AgentPreset] = []
    for raw in presets_raw:
        if raw.get("active") is False:
            continue
        preset_id = str(raw.get("id", "")).strip()
        if not preset_id:
            continue
        presets.append(
            AgentPreset(
                preset_id=preset_id,
                name=str(raw.get("name", "")).strip() or preset_id,
                summary=str(raw.get("summary", "")).strip(),
                role_title=str(raw.get("suggestedRoleTitle", "")).strip()
                or f"{str(raw.get('name', 'Helper')).strip()} operator",
                source_path=str(raw.get("sourcePath", "")).strip() or None,
                identity=str(raw.get("identity", "")).strip() or None,
                soul=str(raw.get("soul", "")).strip() or None,
                tools=str(raw.get("tools", "")).strip() or None,
                recommended_skills=[
                    str(skill).strip()
                    for skill in raw.get("recommendedSkills", [])
                    if str(skill).strip()
                ],
            )
        )
    if not presets:
        raise ValueError("State has no active agent presets")
    return presets


def unique_names(existing_names: set[str], count: int) -> list[str]:
    names: list[str] = []
    pool_cycle = NAME_POOL.copy()
    index = 1
    while len(names) < count:
        if not pool_cycle:
            pool_cycle = NAME_POOL.copy()
        base = pool_cycle.pop(0)
        candidate = base
        while candidate in existing_names:
            candidate = f"{base} {index}"
            index += 1
        existing_names.add(candidate)
        names.append(candidate)
    return names


def next_gateway_port(state: dict[str, Any]) -> int:
    ports = [
        int(instance.get("gatewayPort", 0))
        for instance in state["runtimeInstances"]
        if isinstance(instance.get("gatewayPort"), int)
    ]
    current = max(ports) if ports else 42616
    return max(42617, current + 1)


def make_avatar_seed(name: str) -> str:
    stem = "".join(ch for ch in name.lower() if ch.isalnum())[:12] or "helper"
    return f"{stem}-{uuid.uuid4().hex[:8]}"


def make_agent_payload(
    tenant_id: str,
    name: str,
    preset: AgentPreset,
    created_at: datetime,
) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "tenantId": tenant_id,
        "name": name,
        "avatar": {
            "style": "notionists",
            "seed": make_avatar_seed(name),
            "backgroundColor": random.choice(AVATAR_COLORS),
        },
        "agentType": "general",
        "skills": preset.recommended_skills,
        "roleTitle": preset.role_title,
        "presetId": preset.preset_id,
        "presetName": preset.name,
        "presetSourcePath": preset.source_path,
        "presetSummary": preset.summary,
        "presetIdentityMarkdown": preset.identity,
        "presetSoulMarkdown": preset.soul,
        "presetToolsMarkdown": preset.tools,
        "channel": "custom",
        "status": "running",
        "createdAt": to_iso(created_at),
    }


def make_runtime_payload(
    tenant_id: str,
    agent_id: str,
    port: int,
    status: str,
    created_at: datetime,
    updated_at: datetime,
) -> dict[str, Any]:
    suffix = uuid.uuid4().hex[:12]
    payload: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "tenantId": tenant_id,
        "agentId": agent_id,
        "runtimeType": "openclaw",
        "containerName": f"atoll-rt-{suffix}",
        "volumeName": f"atoll_rt_{suffix}",
        "networkName": "atoll-network",
        "baseUrl": f"http://127.0.0.1:{port}",
        "gatewayPort": port,
        "requirePairing": False,
        "allowPublicBind": True,
        "llmProvider": "openrouter",
        "llmModel": random.choice(MODEL_POOL),
        "llmApiKey": "demo-key",
        "telegramEnabled": False,
        "telegramAllowFrom": [],
        "telegramReplyInPrivate": True,
        "slackEnabled": False,
        "slackAllowedChannelIds": [],
        "slackAllowedUserIds": [],
        "slackReplyInThread": True,
        "discordEnabled": False,
        "discordAllowedGuildIds": [],
        "discordAllowedChannelIds": [],
        "discordReplyInThread": True,
        "discordRequireMention": True,
        "runtimeOptions": {},
        "status": status,
        "createdAt": to_iso(created_at),
        "updatedAt": to_iso(updated_at),
        "bearerToken": uuid.uuid4().hex,
    }
    if status == "error":
        payload["lastError"] = "Demo seed: runtime failed to boot (simulated)."
    return payload


def seed_helpers(state: dict[str, Any], tenant_id: str, count: int) -> tuple[int, int]:
    presets = collect_presets(state)
    existing_names = {str(agent.get("name", "")).strip() for agent in state["agents"]}
    names = unique_names(existing_names, count)
    base_port = next_gateway_port(state)
    now = utc_now()

    agents_added = 0
    runtimes_added = 0
    for i, name in enumerate(names):
        preset = presets[i % len(presets)]
        created_at = now - timedelta(minutes=(count - i) * 3)
        runtime_updated_at = created_at + timedelta(minutes=1)
        status = STATUS_POOL[i % len(STATUS_POOL)]

        agent = make_agent_payload(
            tenant_id=tenant_id,
            name=name,
            preset=preset,
            created_at=created_at,
        )
        runtime = make_runtime_payload(
            tenant_id=tenant_id,
            agent_id=agent["id"],
            port=base_port + i,
            status=status,
            created_at=created_at,
            updated_at=runtime_updated_at,
        )

        state["agents"].append(agent)
        state["runtimeInstances"].append(runtime)
        agents_added += 1
        runtimes_added += 1

    return agents_added, runtimes_added


def write_state(path: Path, state: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(state, f, indent=2)
        f.write("\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed demo helpers into atoll-state.json")
    parser.add_argument(
        "--state-file",
        default="atoll-state.json",
        help="Path to Atoll state file (default: atoll-state.json)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=8,
        help="Number of helpers to add (default: 8)",
    )
    parser.add_argument(
        "--tenant-id",
        default=None,
        help="Optional target tenant id (default: default tenant)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.count <= 0:
        raise ValueError("--count must be > 0")

    state_path = Path(args.state_file).resolve()
    state = load_state(state_path)
    tenant_id = select_tenant_id(state, args.tenant_id)
    agents_added, runtimes_added = seed_helpers(state, tenant_id, args.count)
    write_state(state_path, state)

    print(
        f"Seeded {agents_added} helpers and {runtimes_added} runtime instances "
        f"into {state_path} (tenant={tenant_id})."
    )


if __name__ == "__main__":
    main()
