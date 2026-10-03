# Grid AAC Clone

SvelteKit 5 AAC application for opening `.gridset` boards, navigating and speaking,
editing cell captions and colors, and downloading an edited ZIP copy.

`/` offers licensed sample applications and file import. Selection opens `/board`.
`/grid` is a compatibility entry to the active board or the selector. The layout
retains the current runtime, output, visible WordList subpage and editor draft
across selector/board/settings visits. Imports and editing sessions live in memory;
a clean reload may lose them. Switching applications offers stay, discard or
download a copy first. Failed imports and copy preparation retain active edits.
`/settings` provides voice/provider/model, rate, pitch, theme and ARASAAC attribution.
The retired Board/sets screens are removed; stored legacy user data is preserved.

## Development

Use Node 22.23.2 and the official Bun 1.3.13 binary (packageManager pin).
Run commands in your own checkout with a private cache outside worktrees.

```sh
bun install --frozen-lockfile
bun run check
bun run test:unit -- --run
bun run build
bun run preview
```

Licensed `.gridset` examples (`org-1`, `org-2`, `org-3`, `b037`) are private inputs
placed in `static/` for local builds; they must never be committed. Users can also
open their own files. PCS assets are served by `/img/pcs/[id]` via the `PCS_ASSETS`
R2 binding. Keep the proxy configuration and symbol/media attribution intact.
Voice settings are read dynamically by the retained TTS providers and audio cache.

Playwright uses the production preview. For an existing Chrome GUI, set
`AAC_CDP_URL=http://127.0.0.1:9222`; tests create and close their own contexts.

## Deployment ownership

After independent acceptance, the orchestrator merges and pushes `grid-clone`,
builds the clean merged SHA and deploys Cloudflare Pages to branch `dev` with that
exact `--commit-hash`. `bun run deploy` requires a clean checkout and uses `dev`.
There is no Git merge to a `dev` branch. Preserve Cloudflare Access and all user data.
