import argparse
import csv
import json
import os
import sys
import time
from dataclasses import dataclass, fields
from email.message import Message
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

GITHUB_API = "https://api.github.com"

TARGET_REPOS: List[Tuple[str, str]] = [
    ("GrandCharter", "grand-charter"),
    ("GrandCharter", "outlook-integration"),
    ("GrandCharter", "email-integrations"),
    ("casexchange", "case-xchange"),
]


@dataclass(frozen=True)
class CommitRow:
    org: str
    repo: str
    repo_full_name: str
    sha: str
    html_url: str
    api_url: str
    author_login: Optional[str]
    committer_login: Optional[str]
    commit_author_name: Optional[str]
    commit_author_email: Optional[str]
    commit_author_date: Optional[str]
    commit_committer_name: Optional[str]
    commit_committer_email: Optional[str]
    commit_committer_date: Optional[str]
    message: str

    def as_dict(self) -> Dict[str, Optional[str]]:
        return {
            "org": self.org,
            "repo": self.repo,
            "repo_full_name": self.repo_full_name,
            "sha": self.sha,
            "html_url": self.html_url,
            "api_url": self.api_url,
            "author_login": self.author_login,
            "committer_login": self.committer_login,
            "commit_author_name": self.commit_author_name,
            "commit_author_email": self.commit_author_email,
            "commit_author_date": self.commit_author_date,
            "commit_committer_name": self.commit_committer_name,
            "commit_committer_email": self.commit_committer_email,
            "commit_committer_date": self.commit_committer_date,
            "message": self.message,
        }


def _load_env_file(path: Path) -> None:
    try:
        content = path.read_text(encoding="utf-8")
    except OSError:
        return

    for raw in content.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        key = k.strip()
        value = v.strip()
        if not key:
            continue
        if (value.startswith('"') and value.endswith('"')) or (
            value.startswith("'") and value.endswith("'")
        ):
            value = value[1:-1]
        if key not in os.environ:
            os.environ[key] = value


def _parse_next_link(link_header: Optional[str]) -> Optional[str]:
    if not link_header:
        return None
    parts = [p.strip() for p in link_header.split(",")]
    for part in parts:
        if 'rel="next"' in part:
            left = part.split(";")[0].strip()
            if left.startswith("<") and left.endswith(">"):
                return left[1:-1]
    return None


def _sleep_if_rate_limited(headers: Message) -> bool:
    remaining = headers.get("X-RateLimit-Remaining")
    reset = headers.get("X-RateLimit-Reset")
    if remaining == "0" and reset:
        try:
            reset_ts = int(reset)
        except ValueError:
            return False
        now = int(time.time())
        wait_s = max(0, reset_ts - now) + 1
        time.sleep(wait_s)
        return True
    return False


def _make_request(url: str, token: Optional[str], user_agent: str) -> Request:
    headers = {"Accept": "application/vnd.github+json", "User-Agent": user_agent}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return Request(url, headers=headers, method="GET")


def _read_body_bytes(resp) -> bytes:
    try:
        return resp.read() or b""
    except OSError:
        return b""


def _request_json(
    url: str,
    token: Optional[str],
    user_agent: str,
    timeout_s: int,
    max_retries: int,
    retry_backoff_s: float,
) -> Tuple[Message, object]:
    last_exc: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        req = _make_request(url=url, token=token, user_agent=user_agent)
        try:
            with urlopen(req, timeout=timeout_s) as resp:
                headers = resp.headers
                body = _read_body_bytes(resp)
                data = json.loads(body.decode("utf-8")) if body else None
                return headers, data
        except HTTPError as e:
            headers = e.headers
            if (
                int(getattr(e, "code", 0)) == 403
                and headers
                and _sleep_if_rate_limited(headers)
            ):
                continue
            if int(getattr(e, "code", 0)) in (500, 502, 503, 504):
                last_exc = e
                if attempt < max_retries:
                    time.sleep(retry_backoff_s * (2**attempt))
                    continue
            body = _read_body_bytes(e)
            payload: object
            try:
                payload = json.loads(body.decode("utf-8")) if body else {"message": ""}
            except ValueError:
                payload = {"message": body.decode("utf-8", errors="replace")}
            raise RuntimeError(f"GitHub API error {e.code} for {url}: {payload}") from e
        except URLError as e:
            last_exc = e
            if attempt < max_retries:
                time.sleep(retry_backoff_s * (2**attempt))
                continue
            raise
        except TimeoutError as e:
            last_exc = e
            if attempt < max_retries:
                time.sleep(retry_backoff_s * (2**attempt))
                continue
            raise

    if last_exc:
        raise last_exc
    raise RuntimeError("Unexpected request failure")


def iter_commits_for_repo(
    repo_full_name: str,
    author: str,
    since: Optional[str],
    until: Optional[str],
    token: Optional[str],
    user_agent: str,
    timeout_s: int,
    max_retries: int,
    retry_backoff_s: float,
) -> Iterable[Dict]:
    params: Dict[str, str] = {"per_page": "100", "author": author}
    if since:
        params["since"] = since
    if until:
        params["until"] = until
    url = f"{GITHUB_API}/repos/{repo_full_name}/commits?{urlencode(params)}"
    while url:
        headers, data = _request_json(
            url=url,
            token=token,
            user_agent=user_agent,
            timeout_s=timeout_s,
            max_retries=max_retries,
            retry_backoff_s=retry_backoff_s,
        )
        if not isinstance(data, list):
            raise RuntimeError(f"Unexpected response for commits: {repo_full_name}")
        for item in data:
            if isinstance(item, dict):
                yield item
        url = _parse_next_link(headers.get("Link") if headers else None)


def commit_to_row(org: str, repo: Dict, commit: Dict) -> CommitRow:
    repo_name = str(repo.get("name") or "")
    repo_full_name = str(repo.get("full_name") or f"{org}/{repo_name}")

    sha = str(commit.get("sha") or "")
    html_url = str(commit.get("html_url") or "")
    api_url = str(commit.get("url") or "")

    author_login = None
    if isinstance(commit.get("author"), dict):
        author_login = commit["author"].get("login")

    committer_login = None
    if isinstance(commit.get("committer"), dict):
        committer_login = commit["committer"].get("login")

    c = commit.get("commit") or {}
    author_obj = (c.get("author") or {}) if isinstance(c, dict) else {}
    committer_obj = (c.get("committer") or {}) if isinstance(c, dict) else {}
    message = ""
    if isinstance(c, dict) and c.get("message") is not None:
        message = str(c.get("message"))

    def _get(obj: Dict, key: str) -> Optional[str]:
        v = obj.get(key)
        if v is None:
            return None
        return str(v)

    return CommitRow(
        org=org,
        repo=repo_name,
        repo_full_name=repo_full_name,
        sha=sha,
        html_url=html_url,
        api_url=api_url,
        author_login=str(author_login) if author_login is not None else None,
        committer_login=str(committer_login) if committer_login is not None else None,
        commit_author_name=_get(author_obj, "name"),
        commit_author_email=_get(author_obj, "email"),
        commit_author_date=_get(author_obj, "date"),
        commit_committer_name=_get(committer_obj, "name"),
        commit_committer_email=_get(committer_obj, "email"),
        commit_committer_date=_get(committer_obj, "date"),
        message=message,
    )


def read_orgs_from_file(path: str) -> List[str]:
    orgs: List[str] = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s:
                continue
            if s.startswith("#"):
                continue
            orgs.append(s)
    return orgs


def write_jsonl(rows: Iterable[CommitRow], path: str) -> int:
    n = 0
    with open(path, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r.as_dict(), ensure_ascii=False) + "\n")
            n += 1
    return n


def write_csv(rows: Iterable[CommitRow], path: str) -> int:
    n = 0
    fieldnames = [f.name for f in fields(CommitRow)]
    with open(path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for r in rows:
            w.writerow(r.as_dict())
            n += 1
    return n


def parse_args(argv: List[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Retrieve every commit authored by a user across a fixed set of GitHub org/repo targets."
    )
    p.add_argument(
        "--user",
        required=True,
        help="GitHub username to filter commits by (author=...).",
    )
    p.add_argument(
        "--since",
        help="Only commits after this date-time (ISO 8601, e.g. 2020-01-01T00:00:00Z).",
    )
    p.add_argument("--until", help="Only commits before this date-time (ISO 8601).")
    p.add_argument("--jsonl", help="Write results to JSONL at this path.")
    p.add_argument("--csv", help="Write results to CSV at this path.")
    p.add_argument("--token", help="GitHub token (or set GITHUB_TOKEN env var).")
    p.add_argument("--timeout", type=int, default=30, help="HTTP timeout in seconds.")
    p.add_argument(
        "--max-retries", type=int, default=5, help="Retries for transient failures."
    )
    p.add_argument(
        "--retry-backoff",
        type=float,
        default=1.0,
        help="Backoff base seconds for retries.",
    )
    p.add_argument(
        "--user-agent",
        default="uwaterloo-tools/github-org-commits",
        help="User-Agent header value.",
    )
    return p.parse_args(argv)


def main(argv: List[str]) -> int:
    args = parse_args(argv)

    if not args.jsonl and not args.csv:
        raise SystemExit("Provide at least one output: --jsonl and/or --csv.")

    _load_env_file(Path(__file__).resolve().parent / ".env")

    token = args.token or os.environ.get("GITHUB_TOKEN")

    rows: List[CommitRow] = []
    for org, repo_name in TARGET_REPOS:
        full_name = f"{org}/{repo_name}"
        repo = {"name": repo_name, "full_name": full_name}
        try:
            for commit in iter_commits_for_repo(
                repo_full_name=full_name,
                author=str(args.user),
                since=args.since,
                until=args.until,
                token=token,
                user_agent=str(args.user_agent),
                timeout_s=int(args.timeout),
                max_retries=int(args.max_retries),
                retry_backoff_s=float(args.retry_backoff),
            ):
                rows.append(commit_to_row(org=org, repo=repo, commit=commit))
        except RuntimeError as e:
            msg = str(e)
            if "GitHub API error 404" in msg:
                print(f"Skipping {full_name}: {msg}", file=sys.stderr)
                continue
            raise

    rows.sort(key=lambda r: (r.commit_author_date or "", r.repo_full_name, r.sha))

    if args.jsonl:
        write_jsonl(rows, args.jsonl)
    if args.csv:
        write_csv(rows, args.csv)

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
