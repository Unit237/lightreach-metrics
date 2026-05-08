from typing import Literal

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from app.models import ClientProfileSummary, ReleaseBranch, ReleaseBranchInventory
from app.services.release_readout import ReleaseReadoutService

app = FastAPI(
    title="Lightreach Metrics API",
    version="0.1.0",
    description="Release readout engine for The Loop growth system.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

readout_service = ReleaseReadoutService()


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/release-readout/latest")
def get_latest_release_readout(
    release_id: str = Query(default="r_2026_05_06"),
    client_id: str | None = Query(default=None),
    environment: Literal["production", "staging"] = Query(default="production"),
    segment: Literal["all_users", "new_users", "power_users", "enterprise"] = Query(
        default="all_users"
    ),
    window_days: Literal[1, 7, 14, 30] = Query(default=7),
):
    try:
        return readout_service.build_release_readout(
            release_id=release_id,
            client_id=client_id,
            environment=environment,
            segment=segment,
            window_days=window_days,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/v1/release-scope/branches")
def list_release_scope_branches(client_id: str | None = Query(default=None)) -> ReleaseBranchInventory:
    try:
        client_profile = readout_service.client_profile_store.get_client_profile(client_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    inventory = readout_service.scope_resolver.list_branch_inventory(client_profile=client_profile)
    branches = [
        ReleaseBranch(
            name=branch.name,
            commit_short=branch.commit_short,
            is_current=branch.is_current,
            role=branch.role,
            source=branch.source,
        )
        for branch in inventory.branches
    ]
    baseline_branches = [branch for branch in branches if branch.role == "baseline"]
    experiment_branches = [branch for branch in branches if branch.role == "experiment"]
    return ReleaseBranchInventory(
        client_id=client_profile.client_id,
        client_name=client_profile.client_name,
        source=inventory.source,
        branches=branches,
        baseline_branches=baseline_branches,
        experiment_branches=experiment_branches,
    )


@app.get("/api/v1/clients")
def list_client_profiles() -> list[ClientProfileSummary]:
    return readout_service.list_client_profiles()
