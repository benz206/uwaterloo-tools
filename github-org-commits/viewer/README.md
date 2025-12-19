## GitHub org commits viewer

This is a small Next.js (TypeScript + Tailwind) app that displays the output from `../out.jsonl`.

### Run

From this directory:

```bash
npm run dev
```

Then open `http://localhost:3000`.

### Update data

Re-run the scraper from the parent folder:

```bash
python get_org_commits.py --user YOUR_GITHUB_USERNAME --jsonl out.jsonl --csv out.csv
```

The viewer reads `../out.jsonl` on the server, so refreshing the page will show updated results.
