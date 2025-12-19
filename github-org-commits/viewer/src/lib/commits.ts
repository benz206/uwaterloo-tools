import { readFile } from "node:fs/promises";
import path from "node:path";

export type CommitRow = {
  org: string;
  repo: string;
  repo_full_name: string;
  sha: string;
  html_url: string;
  api_url: string;
  author_login: string | null;
  committer_login: string | null;
  commit_author_name: string | null;
  commit_author_email: string | null;
  commit_author_date: string | null;
  commit_committer_name: string | null;
  commit_committer_email: string | null;
  commit_committer_date: string | null;
  message: string;
};

function _asStringOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return String(v);
}

function _asString(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function _parseCommitRow(obj: unknown): CommitRow | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const sha = _asString(o.sha);
  if (!sha) return null;
  return {
    org: _asString(o.org),
    repo: _asString(o.repo),
    repo_full_name: _asString(o.repo_full_name),
    sha,
    html_url: _asString(o.html_url),
    api_url: _asString(o.api_url),
    author_login: _asStringOrNull(o.author_login),
    committer_login: _asStringOrNull(o.committer_login),
    commit_author_name: _asStringOrNull(o.commit_author_name),
    commit_author_email: _asStringOrNull(o.commit_author_email),
    commit_author_date: _asStringOrNull(o.commit_author_date),
    commit_committer_name: _asStringOrNull(o.commit_committer_name),
    commit_committer_email: _asStringOrNull(o.commit_committer_email),
    commit_committer_date: _asStringOrNull(o.commit_committer_date),
    message: _asString(o.message),
  };
}

export async function loadCommitsFromRepoJsonl(): Promise<CommitRow[]> {
  const jsonlPath = path.resolve(process.cwd(), "..", "out.jsonl");
  const raw = await readFile(jsonlPath, "utf-8");
  const rows: CommitRow[] = [];

  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try {
      const parsed = JSON.parse(s) as unknown;
      const row = _parseCommitRow(parsed);
      if (row) rows.push(row);
    } catch {
      continue;
    }
  }

  rows.sort((a, b) =>
    (b.commit_author_date || "").localeCompare(a.commit_author_date || "")
  );
  return rows;
}


