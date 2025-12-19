# GitHub Org Commit Retriever

Fetch **every commit authored by a specific GitHub user** across a **hardcoded list of repositories**.

## Setup

1. Create a GitHub token (recommended to avoid tight rate limits).
    - For public orgs only: no scopes required is usually fine.
    - For private org repos: you’ll need access + appropriate token permissions (often `repo`, and sometimes `read:org`).
2. Set your token (recommended):

```bash
export GITHUB_TOKEN="..."
```

Or create `github-org-commits/.env`:

```bash
GITHUB_TOKEN="..."
```

## Usage

Fetch commits and write both JSONL + CSV:

```bash
python get_org_commits.py --user YOUR_GITHUB_USERNAME --jsonl out.jsonl --csv out.csv
```

Optional time window (ISO 8601):

```bash
python get_org_commits.py --user YOUR_GITHUB_USERNAME --since 2020-01-01T00:00:00Z --jsonl out.jsonl
```

## Notes / accuracy

-   This uses the GitHub REST API commits endpoint with the `author=...` filter, which returns commits attributed to that GitHub user.
-   If you have commits that are **not attributed** to your GitHub account (e.g., mismatched email, not linked), the API may not return them with `author=...`.
