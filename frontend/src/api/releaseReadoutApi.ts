import type { ClientProfileSummary, ReleaseBranchInventory, ReleaseReadout, Segment, WindowDays } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export async function getReleaseReadout(
  releaseId: string,
  clientId: string | null,
  environment: "staging" | "production",
  segment: Segment,
  windowDays: WindowDays
): Promise<ReleaseReadout> {
  const params = new URLSearchParams({
    release_id: releaseId,
    environment,
    segment,
    window_days: String(windowDays),
    ts: String(Date.now())
  });
  if (clientId) {
    params.set("client_id", clientId);
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/release-readout/latest?${params.toString()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Failed to load release readout (${response.status})`);
  }
  return response.json();
}

export async function getReleaseBranches(clientId: string | null): Promise<ReleaseBranchInventory> {
  const params = new URLSearchParams({ ts: String(Date.now()) });
  if (clientId) {
    params.set("client_id", clientId);
  }
  const response = await fetch(`${API_BASE_URL}/api/v1/release-scope/branches?${params.toString()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Failed to load release branches (${response.status})`);
  }
  return (await response.json()) as ReleaseBranchInventory;
}

export async function getClientProfiles(): Promise<ClientProfileSummary[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/clients?ts=${Date.now()}`, {
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error(`Failed to load client profiles (${response.status})`);
  }
  return (await response.json()) as ClientProfileSummary[];
}
