from dataclasses import dataclass
import fnmatch
import json
import os
from pathlib import Path
import subprocess
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.services.client_profiles import ClientProfile, DEFAULT_BASELINE_PATTERNS, DEFAULT_EXPERIMENT_PATTERNS

@dataclass(frozen=True)
class BranchCandidate:
    name: str
    commit_short: str
    commit_sha: str | None
    is_current: bool
    role: str
    source: str


@dataclass(frozen=True)
class BranchInventory:
    source: str
    branches: list[BranchCandidate]
    baseline_branches: list[BranchCandidate]
    experiment_branches: list[BranchCandidate]


@dataclass(frozen=True)
class ReleaseScope:
    requested_release_id: str
    branch: str | None
    commit_sha: str | None
    commit_short: str | None
    release_context_key: str


class ReleaseScopeResolver:
    def __init__(self, repo_path: Path | None = None) -> None:
        default_repo_path = Path(__file__).resolve().parents[3]
        self.repo_path = repo_path or default_repo_path
    def list_branch_inventory(self, client_profile: ClientProfile | None = None) -> BranchInventory:
        github_inventory = self._list_github_branches(client_profile=client_profile)
        if github_inventory is not None:
            return github_inventory

        local_branches = self._list_local_branches(client_profile=client_profile)
        return self._build_inventory(source="local", branches=local_branches)

    def list_branches(self, client_profile: ClientProfile | None = None) -> list[BranchCandidate]:
        return self.list_branch_inventory(client_profile=client_profile).branches

    def _list_local_branches(self, client_profile: ClientProfile | None = None) -> list[BranchCandidate]:
        if not self._is_git_repo():
            return []
        current_branch = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        output = self._run_git(
            "for-each-ref",
            "--sort=-committerdate",
            "--format=%(refname:short)|%(objectname:short)",
            "refs/heads",
        )
        if not output:
            return []
        branches: list[BranchCandidate] = []
        for line in output.splitlines():
            parts = line.strip().split("|")
            if len(parts) != 2:
                continue
            name, commit_short = parts
            branches.append(
                BranchCandidate(
                    name=name,
                    commit_short=commit_short,
                    commit_sha=None,
                    is_current=name == current_branch,
                    role=self._classify_branch_role(
                        name,
                        baseline_patterns=self._baseline_patterns(client_profile),
                        experiment_patterns=self._experiment_patterns(client_profile),
                    ),
                    source="local",
                )
            )
        return branches

    def _list_github_branches(self, client_profile: ClientProfile | None = None) -> BranchInventory | None:
        owner = client_profile.github_owner if client_profile else os.getenv("GITHUB_OWNER", "").strip()
        repo = client_profile.github_repo if client_profile else os.getenv("GITHUB_REPO", "").strip()
        token = client_profile.github_token if client_profile else os.getenv("GITHUB_TOKEN", "").strip()
        if not owner or not repo:
            return None
        repo_meta = self._fetch_github_json(f"/repos/{owner}/{repo}", github_token=token)
        branches_payload = self._fetch_github_json(
            f"/repos/{owner}/{repo}/branches?per_page=100",
            github_token=token,
        )
        if not isinstance(branches_payload, list):
            return None

        default_branch = ""
        if isinstance(repo_meta, dict):
            default_branch = str(repo_meta.get("default_branch", "")).strip()

        local_current = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        branches: list[BranchCandidate] = []
        for item in branches_payload:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name", "")).strip()
            commit_data = item.get("commit", {})
            commit_sha = ""
            if isinstance(commit_data, dict):
                commit_sha = str(commit_data.get("sha", "")).strip()
            if not name:
                continue
            commit_short = commit_sha[:8] if commit_sha else "unknown"
            is_current = bool(local_current and name == local_current)
            role = self._classify_branch_role(
                name,
                default_branch=default_branch,
                baseline_patterns=self._baseline_patterns(client_profile),
                experiment_patterns=self._experiment_patterns(client_profile),
            )
            branches.append(
                BranchCandidate(
                    name=name,
                    commit_short=commit_short,
                    commit_sha=commit_sha or None,
                    is_current=is_current,
                    role=role,
                    source="github",
                )
            )

        return self._build_inventory(source="github", branches=branches)

    def resolve_release_scope(
        self, release_reference: str, client_profile: ClientProfile | None = None
    ) -> ReleaseScope:
        trimmed_reference = release_reference.strip()
        branches = self.list_branch_inventory(client_profile=client_profile).branches
        branch_names = {branch.name: branch for branch in branches}

        if trimmed_reference in branch_names:
            branch = branch_names[trimmed_reference]
            commit_sha = branch.commit_sha or self._run_git("rev-parse", branch.name)
            commit_short = commit_sha[:8] if commit_sha else branch.commit_short
            release_context_key = f"{branch.name}@{commit_short}"
            return ReleaseScope(
                requested_release_id=release_reference,
                branch=branch.name,
                commit_sha=commit_sha,
                commit_short=commit_short,
                release_context_key=release_context_key,
            )

        sanitized = trimmed_reference.replace(" ", "_")
        return ReleaseScope(
            requested_release_id=release_reference,
            branch=None,
            commit_sha=None,
            commit_short=None,
            release_context_key=sanitized,
        )

    def _is_git_repo(self) -> bool:
        output = self._run_git("rev-parse", "--is-inside-work-tree")
        return output == "true"

    def _run_git(self, *args: str) -> str:
        try:
            completed = subprocess.run(
                ["git", "-C", str(self.repo_path), *args],
                check=True,
                capture_output=True,
                text=True,
            )
            return completed.stdout.strip()
        except (FileNotFoundError, subprocess.CalledProcessError):
            return ""

    def _classify_branch_role(
        self,
        branch_name: str,
        default_branch: str = "",
        baseline_patterns: list[str] | None = None,
        experiment_patterns: list[str] | None = None,
    ) -> str:
        normalized = branch_name.lower()
        baseline_patterns = baseline_patterns or DEFAULT_BASELINE_PATTERNS
        experiment_patterns = experiment_patterns or DEFAULT_EXPERIMENT_PATTERNS
        if default_branch and normalized == default_branch.lower():
            return "baseline"
        if any(fnmatch.fnmatch(normalized, pattern.lower()) for pattern in baseline_patterns):
            return "baseline"
        if any(fnmatch.fnmatch(normalized, pattern.lower()) for pattern in experiment_patterns):
            return "experiment"
        return "other"

    def _build_inventory(self, source: str, branches: list[BranchCandidate]) -> BranchInventory:
        sorted_branches = sorted(
            branches,
            key=lambda branch: (
                0 if branch.is_current else 1,
                0 if branch.role == "experiment" else 1,
                branch.name,
            ),
        )
        baseline = [branch for branch in sorted_branches if branch.role == "baseline"]
        experiments = [branch for branch in sorted_branches if branch.role == "experiment"]
        return BranchInventory(
            source=source,
            branches=sorted_branches,
            baseline_branches=baseline,
            experiment_branches=experiments,
        )

    def _fetch_github_json(self, path: str, github_token: str = "") -> dict | list | None:
        url = f"https://api.github.com{path}"
        headers = {
            "Accept": "application/vnd.github+json",
            "User-Agent": "lightreach-metrics-release-scope",
        }
        if github_token:
            headers["Authorization"] = f"Bearer {github_token}"
        request = Request(url, headers=headers)
        try:
            with urlopen(request, timeout=6) as response:
                payload = response.read().decode("utf-8")
                return json.loads(payload)
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
            return None

    def _baseline_patterns(self, client_profile: ClientProfile | None) -> list[str]:
        if client_profile:
            return client_profile.baseline_patterns
        return DEFAULT_BASELINE_PATTERNS

    def _experiment_patterns(self, client_profile: ClientProfile | None) -> list[str]:
        if client_profile:
            return client_profile.experiment_patterns
        return DEFAULT_EXPERIMENT_PATTERNS
