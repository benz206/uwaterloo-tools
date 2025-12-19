"use client";

import { useMemo, useState } from "react";
import type { CommitRow } from "@/lib/commits";

type Props = {
  commits: CommitRow[];
};

function formatDateUtc(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm} UTC`;
}

function firstLine(msg: string): string {
  const i = msg.indexOf("\n");
  return i === -1 ? msg : msg.slice(0, i);
}

export function CommitsClient({ commits }: Props) {
  const [q, setQ] = useState("");
  const [repo, setRepo] = useState<string>("all");

  const repos = useMemo(() => {
    const s = new Set<string>();
    for (const c of commits) {
      if (c.repo_full_name) s.add(c.repo_full_name);
    }
    return ["all", ...Array.from(s).sort((a, b) => a.localeCompare(b))];
  }, [commits]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return commits.filter((c) => {
      if (repo !== "all" && c.repo_full_name !== repo) return false;
      if (!query) return true;
      return (
        c.sha.toLowerCase().includes(query) ||
        c.repo_full_name.toLowerCase().includes(query) ||
        (c.message || "").toLowerCase().includes(query)
      );
    });
  }, [commits, q, repo]);

  const grouped = useMemo(() => {
    const m = new Map<string, CommitRow[]>();
    for (const c of filtered) {
      const key = c.repo_full_name || "(unknown repo)";
      const arr = m.get(key);
      if (arr) arr.push(c);
      else m.set(key, [c]);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search message, sha, repo..."
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-black/20"
          />
        </div>
        <div className="sm:w-80">
          <select
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            className="w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none"
          >
            {repos.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-sm text-black/60">
        Showing <span className="font-medium text-black">{filtered.length}</span>{" "}
        of <span className="font-medium text-black">{commits.length}</span>
      </div>

      <div className="space-y-8">
        {grouped.map(([repoName, list]) => {
          const latest = list[0]?.commit_author_date ?? null;
          const oldest = list[list.length - 1]?.commit_author_date ?? null;
          return (
            <section key={repoName} className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-black">
                    {repoName}
                  </h2>
                  <div className="text-xs text-black/60">
                    <span className="font-medium text-black">{list.length}</span>{" "}
                    commits
                    {latest ? (
                      <>
                        {" "}
                        · latest {formatDateUtc(latest)}
                      </>
                    ) : null}
                    {oldest ? (
                      <>
                        {" "}
                        · oldest {formatDateUtc(oldest)}
                      </>
                    ) : null}
                  </div>
                </div>
              </div>

              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((c) => {
                  const authorLabel =
                    c.author_login ||
                    c.commit_author_name ||
                    c.commit_author_email ||
                    "";
                  const committerLabel =
                    c.committer_login ||
                    c.commit_committer_name ||
                    c.commit_committer_email ||
                    "";
                  return (
                    <li
                      key={`${c.repo_full_name}:${c.sha}`}
                      className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-base font-semibold leading-6 text-black">
                            {firstLine(c.message || "(no message)")}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/60">
                            <span className="font-mono text-black/70">
                              {c.sha.slice(0, 7)}
                            </span>
                            {c.commit_author_date ? (
                              <span>{formatDateUtc(c.commit_author_date)}</span>
                            ) : null}
                            {authorLabel ? (
                              <span>
                                author <span className="text-black/80">{authorLabel}</span>
                              </span>
                            ) : null}
                            {committerLabel ? (
                              <span>
                                committer{" "}
                                <span className="text-black/80">{committerLabel}</span>
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="shrink-0">
                          <a
                            href={c.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full border border-black/10 bg-black px-3 py-1 text-xs font-medium text-white hover:bg-black/90"
                          >
                            Open
                          </a>
                        </div>
                      </div>

                      <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs text-black/80">
                        {c.message || ""}
                      </pre>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}


