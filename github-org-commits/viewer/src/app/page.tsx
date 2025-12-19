import { CommitsClient } from "@/app/CommitsClient";
import { loadCommitsFromRepoJsonl } from "@/lib/commits";

export default async function Home() {
  try {
    const commits = await loadCommitsFromRepoJsonl();
    return (
      <div className="min-h-screen bg-zinc-50 font-sans text-black">
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              GitHub commits
            </h1>
            <p className="text-sm text-black/60">
              Loaded from{" "}
              <span className="font-medium">github-org-commits/out.jsonl</span>
            </p>
          </div>

          {commits.length === 0 ? (
            <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
              <p className="text-sm text-black/70">
                No commits found in <span className="font-medium">out.jsonl</span>
                .
              </p>
              <p className="mt-1 text-sm text-black/60">
                Re-run <span className="font-mono">get_org_commits.py</span> to
                regenerate the data.
              </p>
            </div>
          ) : (
            <CommitsClient commits={commits} />
          )}
        </main>
      </div>
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return (
      <div className="min-h-screen bg-zinc-50 font-sans text-black">
        <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
          <div className="mb-8 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              GitHub commits
            </h1>
            <p className="text-sm text-black/60">
              Loaded from{" "}
              <span className="font-medium">github-org-commits/out.jsonl</span>
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-red-700">
              Failed to load commits
            </p>
            <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs text-black/80">
              {msg}
            </pre>
          </div>
        </main>
      </div>
    );
  }
}
