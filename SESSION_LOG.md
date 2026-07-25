# getchunks Session Log

## 2026-07-25 — Phase 2 (v3.3): flags + Chunkability score, on `feature/chunk-quality-v3.3` (stacked on v3.2)

**Trigger:** Will asked (twice) for the "actionable layer — now what?" after approving v3.2. That's Phase 2 of the approved plan; executed it.

**API (`api/chunk.js`):** `analyzeChunks()` — pure/deterministic, zero AI. Per-chunk `flags[]` (code/label/severity/message/fix) + `chunk_score`, top-level `chunkability {score, grade, top_fixes}`. Flags: dangling-reference, near-duplicate (5-gram Jaccard ≥ 0.6 on de-overlapped text), no-entity-anchor (title+site+JSON-LD org names+H1, plus initialisms so "RAG" anchors "Retrieval-augmented generation"), thin-section (floor = min(target.min, 100)), oversized-section, generic-heading (~40 stoplist), answer-buried (needs ≥2 heading content words), readability (FK > 12, info-only). **Scoring model:** per-chunk 100-minus-flag-weights, page = average (flat deductions punished many-chunk pages — Wikipedia scored F). Weights: dangling/dupe 30, no-anchor 25, thin/oversized/generic 20, answer-buried 15.

**Bonus root-cause fix:** the near-duplicate flag exposed the long-deferred nested-content extraction bug — containers wrapping nested `<section>`s were swallowed wholesale into the parent chunk (Wikipedia "Improvements" contained all of "Encoder"). Fixed in `stopCondition` (boundary when a container holds the next heading) + `extractContentPieces` (skip containers holding uncollected headings). That open item can come off the backlog.

**UI:** score card (color-banded score+grade, top 3 fixes with "up to +N pts"), red/amber/info flag chips per chunk card with fix tooltips, green "✓ No flags" chip, "show only flagged" toggle, legend bullets for score + chips.

**Tuning (5 pages):** Wikipedia RAG 79/C (control, highest ✓) · Liberty 73/C · seasidefl 68/D (answers Will's "it seems to chunk well" — 9 sections, all under 100 words) · SI home 65/D · Hayes (Chuck's page) 51/F with fixes "merge thin sections, replace pronoun openers, answer the heading first."

**Next:** Will reviews v3.3 → then Phase 3 (v3.4): BM25 retrieval simulator, query coverage matrix, markdown optimization-report export.

## 2026-07-25 (cont.) — Phase 3 (v3.4) executed; Chunk Quality plan COMPLETE

**Will said "get through all the outstanding work."** Built v3.4 on `feature/chunk-quality-v3.4` (stacked on v3.3), PR #12:
- Client-side BM25 (k1=1.2/b=0.75, no deps) over sections — heading indexed with text, overlap included, mirroring what the JSONL export feeds a real pipeline. All in-browser.
- "Test retrieval" panel: single query → top-5 ranked sections with scores/bars/matched terms; winner highlighted with its flag chips and a stands-alone verdict (Hayes: "Chunk 2 · section 1 wins but is flagged (Dangling reference)").
- Coverage check: one query per line → matrix (query / status / best section / score / terms), covered = ≥60% of query terms matched, weak, or gap. Summary counts + Copy CSV.
- "Copy optimization report": markdown deliverable — score/grade, top fixes, flags grouped Fix first / Then improve / Worth knowing, coverage table, content-gaps list, settings. Verified via clipboard read in Playwright (Hayes: 4k chars, "dog boarding rates" correctly a gap, "cost per month" correctly weak).
- State: coverageRows reset per extraction; all buttons delegated (view re-renders per run); Enter submits the single query.

**Backlog cleanup:** `feature/enhanced-chunking` turned out to be already deleted (backlog item was stale); pruned leftover local tracking refs for the merged `chore/remove-dead-css` + `feature/marketing-shell-parity` branches. Branch list is now just main + the three chunk-quality branches.

## 2026-07-25 (cont. 2) — Fixture/snapshot test suite (backlog item since v3.1) DONE

Will approved the fresh-scope recommendation. `feature/fixture-tests` (stacked on v3.4), 30 tests green in ~0.6s via `npm test` (node:test, zero new deps):
- **Named exports added** at the bottom of `api/chunk.js` for the test surface (runtime unaffected — Vercel only uses the default handler; verified API still healthy afterward).
- `tests/chunking.test.js` — recursiveSplit (limit, word preservation, paragraph boundaries, force-split), mergeSmallChunks, addOverlap (prefix content, recorded count, the exact 29-word clamp case from Chuck's page, no-op paths), initialism, Flesch-Kincaid ordering.
- `tests/analyzer.test.js` — one isolated scenario per flag (incl. single-word-heading skip, UWM initialism anchoring, near-duplicate counted once per pair, overlap-prefix exclusion), per-chunk-average score math (85/B case), determinism, empty→null. Gotcha found: synthetic filler words are accidentally polysyllabic → FK grade >12, so the "simple prose" case is hand-written.
- `tests/fixture-snapshot.test.js` — two committed HTML fixtures run through the full offline pipeline (extractSourceMetadata → buildChunks → enhanceChunks → analyzeChunks, tokenizer 'estimate' so snapshots don't churn with gpt-tokenizer versions); full-result deep-equal vs committed `*.snapshot.json`; regenerate intentionally with `UPDATE_SNAPSHOTS=1 npm test`. `nested-sections.html` is the regression fixture for the v3.3 extraction fix (parent must not swallow child `<section>` content; explicit asserts + snapshot).
- `.github/workflows/test.yml` — npm ci + npm test on PRs and main pushes, Node 22.
- Note: `node --test tests/` (directory form) fails silently on Node 22.22 — script uses the `'tests/*.test.js'` glob.

**Open at day's end:**
1. **Merge chain awaiting Will:** #10 (v3.2, base main) → #11 (v3.3) → #12 (v3.4) → #13 (tests) — retarget each to main as its base lands. Merging to main auto-deploys.
2. Phase 4 optional: template query generator, `?queries=` Ontologizer deep-link, compare mode, README rubric docs.

## 2026-07-24 — Chunk Quality plan (from Chuck's feedback) + repo moved out of archive

**Session ran from ontologizer-next; planning only, no code changes here yet.**

**Origin:** Chuck Wilkins Slack feedback — he couldn't interpret the Chunks view on the Hayes Barton Place assisted-living page and mistook the overlap prefix for duplicate content. Verified root cause: the sentence appears exactly once on the live page (`https://www.hayesbartonplace.com/bloomsbury-at-hayes-barton-place/assisted-living`); the "duplicate" is `addOverlap()` prepending the entire 29-word prior section because the overlap window (35w, 10% of medium target) exceeds the section length. `addOverlap()` doesn't record what it prepended, so the UI can't label it. Will's framing: keep everything deterministic — zero AI tokens.

**Plan written (NOT yet executed):** "Chunk Quality upgrade (v3.2 → v3.4)" at the bottom of `tasks/todo.md`. Summary: v3.2 = overlap labeling + "how to read this" legend (needs `overlap_word_count` from the API); v3.3 = deterministic per-chunk flags (entity anchor, dangling reference, thin/oversized, generic heading, answer-buried, near-duplicate via Jaccard shingles, Flesch-Kincaid) + 0–100 Chunkability score; v3.4 = client-side BM25 retrieval simulator, paste-queries coverage matrix, markdown optimization-report export. Phase 4 parked: template query generator, `?queries=` deep-link from Ontologizer fan-out, compare mode.

**Repo moved:** `~/Development/Development Archive/getchunks` → `~/Development/getchunks`. Git and Vercel unaffected (deploys from GitHub `searchinfluence/getchunks`). Working tree has exactly one modification: the plan appended to `tasks/todo.md`.

**Next session:** get Will's approval on the plan, then branch `feature/chunk-quality-v3.2` off `main`. Smoke-test v3.2 against the Hayes Barton Place URL above (the exact page Chuck screenshotted).

**2026-07-24 (cont.) — Phase 1 (v3.2) EXECUTED on `feature/chunk-quality-v3.2`, uncommitted, awaiting Will's review before PR:**
- `api/chunk.js`: `addOverlap()` now records `overlap_word_count` per small chunk (carried through `enhanceChunks()`); `settings.target_words` ({min,max,target}) added so the UI reads size ranges live instead of mirroring `CHUNK_SIZES`.
- `public/index.html`: overlap prefix rendered dimmed + dotted-underline with `↔ Nw overlap` badge and "intentional RAG carry-over" tooltip (UI splits the prefix with `^(?:\S+\s+){N}` against the reported count); collapsible "How to read this" legend at top of Chunks view (Chunk/L#/Sections/w-t/live size range/overlap); Content Summary stat labels swapped (they were reversed vs the chunk cards: big=Chunks, small=Sections).
- Smoke-tested via `vercel dev --listen 3001` + Playwright: Hayes Barton Place Chunk 2 sec 2 = `overlap_word_count: 29`, renders badged/dimmed exactly as planned; 7 badges total (2w–35w). 3 more URLs (SI home, Wikipedia RAG, getchunks) — 0 prefix mismatches, no warnings, zero-overlap case clean. Screenshots in session scratchpad.
- Will's review feedback, addressed same-branch: (1) tooltip on the chunk meta pill spelling out each part ("Chunk 1 of 4 on this page • starts at a level-2 heading (an <h2>) • …") + fixed "1 sections" plural; (2) breadcrumb now labeled "PATH" with a tooltip + legend bullet explaining it's the heading path (parent headings above the chunk, starting with the page title) stored for retrieval context. (3) His "actionable layer / score" ask = Phase 2 (v3.3 flags + Chunkability score) — confirmed as next.
- More review feedback, same branch (PR #10): URL input now accepts bare domains (type="text" + inputmode="url", submit handler prepends https:// when schemeless; API validation untouched). Native title="" tooltips weren't showing for Will (help cursor but no tip — native titles need a long hover and never render in some embedded browsers), so replaced with a pure-CSS [data-tip] ::after tooltip component (instant, styled, .tip-right modifier for the meta pill; big-chunk-meta lost its overflow:hidden ellipsis so the pseudo-element isn't clipped). overlap-prefix keeps native title only — CSS tooltips don't position reliably on multi-line inline spans; the adjacent badge carries the working tooltip.

## 2026-07-21 (cont. 2) — Dead-CSS cleanup, cross-links, Ontologizer preview fix

**getchunks dead-CSS cleanup (#9, merged):** Removed 235 lines of orphaned rules whose classes left the DOM in the marketing-shell rebuild (.header/.header-content/.logo-*/.tagline/.header-description/.main-section/.form-card/.features/.feature*/old .faq-*/.footer + their @media entries). Verified render pixel-identical at 1440px; `<style>` braces balanced 243/243. Auto-deployed.

**Sibling-tool cross-links — all live:** getchunks already linked out to AI Website Grader + Ontologizer (nav + footer). Added the reverse:
- **AI Website Grader** footer link to getchunks (PR #24). Note: that repo was ALSO transferred to the `searchinfluence` org — its local git remote is a stale `willscott-v2` redirect (same pattern as getchunks). PR landed on `searchinfluence/ai-website-grader#24`.
- **Ontologizer** footer link to getchunks (PR #1, still `willscott-v2/ontologizer-next`). Confirmed both live in production footers (`getchunks.searchinfluence.com`).

**Ontologizer preview builds — fixed + verified:** PR previews were failing at `/_not-found` prerender ("@supabase/ssr: URL and API key required"). Root cause: the 3 Supabase vars were **branch-scoped to `feature/ai-content-clarity`**, so only that branch's previews got them. Added `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` as **preview / all-branches** (values mirrored from production via API, never printed). Verified by redeploying the previously-failed preview → built **READY**.

**Correction logged:** I initially reported Ontologizer's local `main` as "divergent unpushed WIP" and worried it would clobber the cross-links. That was WRONG — a stale-checkout misread. `origin/main..main` was empty and the merge-base = local HEAD, proving local main was a plain **ancestor, 11 commits behind** (the `a2c8dff` token/cost-tracking + GPT-5.4/Gemini-3.x commit is already in origin/main). Fast-forwarded local main to `6b6c0be`; nothing to reconcile, nothing lost.

**Open items:**
- Branch-scoped Ontologizer preview vars (`feature/ai-content-clarity`) now redundant alongside the all-branch ones — safe to delete if simplifying.
- AI Website Grader local remote should be repointed: `git remote set-url origin https://github.com/searchinfluence/ai-website-grader.git`.
- getchunks: still-deferred fixture/snapshot tests for split/merge/overlap; nested-content extraction fix for the cheerio fallback path.

## 2026-07-21 (cont.) — Marketing-shell parity + deploy fix

**Problem found:** After the v3.1 token swap (#5/#7), the user reported getchunks still didn't look like the grader/ontologizer. Two separate issues:
1. **Deploy was stale** — the GitHub repo transfer (willscott-v2 → searchinfluence/getchunks) had severed Vercel's Git integration, so #5/#7 merges never deployed. User reconnected Git in the dashboard, but the "Redeploy" button rebuilt the old commit (Redeploy pins to a commit; it doesn't pull HEAD). Got current work live with `vercel --prod`.
2. **Design was only recolored, not re-laid-out** — the token swap kept getchunks' original single-column structure. The grader/ontologizer share a marketing shell (nav bar, split hero, white form card, near-black navy, white sections) that getchunks lacked.

**Fix (#8, merged):** Rebuilt public/index.html on the SI marketing shell — nav with SI monogram, split hero + white form card, orange stripe, white process section (sticky-heading two-column), grader-style FAQ accordion, marketing footer. Form/advanced-options moved into the white card and restyled for light context; all tool ids preserved. Verified 1440/375px in browser and live on both domains.

**Git integration now healed:** merging #8 auto-deployed HEAD (4e53ff9) correctly — confirms the reconnect works and future merges deploy on their own. The stale-commit issue was only the manual Redeploy button.

**Follow-up:** ~150 lines of dead CSS from the old layout (.header/.features/old .faq-*/.footer) remain harmless (classes gone from DOM); sweep in a later pass.

## 2026-07-21 — Sync, full code review, SI theme + hardening (v3.1)

**Started:** repo was 12 commits behind origin/main (org-wide gitleaks rollout, workflow-only). Fast-forwarded; deleted merged branches `feature/v3-modernization` + `fix/ui-polish-v3`. Confirmed `feature/enhanced-chunking` is fully merged (leftover pointer, not open work).

**Full code review** of api/chunk.js, api/feedback.js, public/index.html, configs. Found: SSRF/open-proxy on /api/chunk, attribute-injection XSS via scraped heading ids (escapeHtml didn't escape quotes), Slack mrkdwn injection in feedback, permanently-stuck overlap slider, dead node-fetch timeout, dishonest `extract=defuddle` fallback, README/license drift, source-mutating build script.

**Two stacked PRs opened:**
- **#5 `feature/si-design-system`** — adopted the canonical SI design system from AI Website Grader + Ontologizer (the grader's stylesheet is literally titled "GetChunks Design System" — theme came home). CSS-only, class names unchanged. Full token block, Open Sans, hero gradient, flat orange CTAs, report-green results header, local logo. Playwright QA at 1440/375px.
- **#6 `fix/hardening-and-bugs`** (stacked on #5) — SSRF guards (scheme allowlist, DNS + private-range block incl. metadata/CGNAT/IPv6, per-hop redirect validation, 5MB cap, content-type check), escapeHtml quote fix, Slack escaping, input validation (400s not 500s), native fetch + AbortSignal.timeout, extract=defuddle 422, removed node-fetch + build script + ~1,900 lines legacy files, README/GTM cleanup. Verified locally via harness + Playwright. Both PRs pass gitleaks + GitGuardian.

**Decisions:** GTM `GTM-4G43` = shared SI container (verified vs grader/ontologizer .env). Legacy files deleted (git-recoverable). Rate limiting → Vercel WAF rule (dashboard, not yet applied).

**Next steps / open items:**
- Merge #5 then #6 (order matters — #6 retargets to main after #5 lands).
- ~~Apply Vercel WAF rate-limit rule~~ **DONE** — two custom rules live via the Firewall API (`/api/chunk` 20/60s/IP, `/api/feedback` 5/600s/IP, both deny-on-exceed, keyed by IP). Applied with `PATCH /v1/security/firewall/config` after refreshing `vercel login`; the CLI has no firewall command. Managed WAF ruleset untouched.
- Follow-ups: fixture/snapshot tests for split/merge/overlap; nested-content extraction fix for the cheerio fallback path.
- `feature/enhanced-chunking` still exists locally + on origin (fully merged) — safe to delete when convenient.

## 2026-04-14 — Research session: code-only improvements

**Goal:** Determine whether the current `getchunks` solution (cheerio + heading-based chunking) is still a strong approach, or whether code-only improvements (no AI tokens) could make it more useful.

**Project state at start of session:**
- v2.0.0 in `package.json`, but README still references v1.2.0
- Stack: Vercel serverless function, `node-fetch` + `cheerio`, vanilla JS frontend
- API: `POST /api/chunk` with `{ url, mode, chunkSize, overlap, strategy }`
- Strategies: `heading`, `recursive`, `fixed` with auto-detection based on heading density and word count
- Returns big_chunks/small_chunks with word counts, char counts, and token estimates (rough 0.75 multiplier)
- Live at https://getchunks.vercel.app and https://getchunks.searchinfluence.com
- Open feature branch noted in ENHANCEMENT_STATUS.md: `feature/enhanced-chunking`

**Known limitations (per README):**
- No JavaScript rendering (cheerio is static HTML only)
- No support for password-protected pages
- May not parse highly customized layouts

**Research underway:** parallel agents investigating (1) current state of web chunking for RAG, (2) top GitHub repos for content extraction + chunking, (3) tokenizer/semantic improvements that don't require AI inference.

## Research findings (2026-04-14)

**Verdict on heading-based chunking:** Yes, still reasonable in 2026. Structural/markdown-header chunking outperforms naive fixed-size by 5-10pp and matches or beats embedding-based semantic chunking on well-structured docs per NAACL 2025 (Vectara) and Vecta Feb 2026 benchmarks.

**Top code-only improvements identified:**
1. Swap cheerio traversal for Defuddle (active JS library, successor to Readability/Postlight) for main-content extraction
2. Add accurate token counting via gpt-tokenizer or js-tiktoken (0.75 word ratio holds ~±5% but real tokenizers are cheap now)
3. Parent/child hierarchical output (3-level cap per research) to enable AutoMergingRetriever patterns
4. Better sentence boundary detection (compromise or wink-nlp on node) instead of regex for recursive strategy
5. Tighter overlap guardrails (10-20% target, warn on excessive) - duplicate saturation is documented failure mode

**Libraries obviously missing from cheerio-only stack:** Defuddle, gpt-tokenizer, chonkie-ts (reference implementation), compromise/wink-nlp for sentence detection.

## Open items / next steps
- Synthesize research into recommendations — DONE
- Get user buy-in on which improvements (if any) to prioritize
- Update README to reflect actual v2.0.0 state if we proceed with changes

## 2026-04-14 — Sub-research: GitHub repo landscape audit

Pulled live GitHub stars + last-push dates and confirmed:
- **Defuddle (kepano):** 6,725 stars, pushed 2026-04-14 — actively maintained, has Node bundle
- **@mozilla/readability:** 11,099 stars but last push 2026-01-21 — barely maintained (kepano's stated reason for building Defuddle)
- **postlight/parser (Mercury):** 5,781 stars, last push 2024-07-10 — effectively abandoned
- **chonkie (Python):** 3,917 stars, daily commits. **chonkie-ts:** 325 stars, March 2026 — only credible JS port
- **gpt-tokenizer (niieani):** 766 stars, Feb 2026 — fastest sync JS BPE tokenizer
- **js-tiktoken (dqbd):** 1,040 stars, Aug 2025 — pure JS, edge-runtime safe but bigger bundle
- **anthropic-tokenizer-typescript:** 100 stars, last push **March 2024** — stale, do not rely on for Claude token counts
- **@sparticuz/chromium:** 1,583 stars, very active; chromium-min variant + Vercel Fluid Compute (default since Apr 2025) makes serverless Chromium viable but heavy
- **wink-nlp:** 1,364 stars, March 2026 — best maintained quality option for sentence segmentation
- **sbd:** 224 stars, last push 2023 — works but stagnant

Full structured report delivered to user inline.

## 2026-04-14 — Third-pass deep research (this session)

Ran deeper verification searches on tokenizers, TextTiling viability, Defuddle vs Readability, sentence segmentation, language detection, simhash/minhash, trafilatura port status, and LangChain/LlamaIndex output schemas. Delivered focused <1500-word opinionated report to user.

Key opinionated calls (additive to prior rounds):
- **Ship Phase 1:** Defuddle swap, gpt-tokenizer (niieani — single model, not ensemble), breadcrumb heading path, JSON-LD + OpenGraph capture, LangChain Document output mode, sbd for recursive-mode sentence splitting
- **Skip:** TextTiling/C99 (no maintained JS port, and heading-split already captures topic shifts on structured web content where the target users live), multi-tokenizer ensembles (overkill — one accurate counter is enough), language detection (franc-min 540KB isn't worth the bundle for an English-first tool), Flesch-Kincaid readability scores (vanity metric for RAG use cases)
- **Maybe Phase 2:** SimHash dedup (only useful for batch/multi-URL mode, which doesn't exist yet), content-type tagging (prose/list/code/table — trivial to add during cheerio traversal, low cost)

## 2026-04-14 — Feedback widget ported from ontologizer-next

### What was done
- Added `api/feedback.js` — Vercel serverless function that validates `{ type, message, email, pageUrl }`, posts Slack block payload matching the ontologizer-next format. Uses `FEEDBACK_PROJECT_NAME` (default `getchunks`) so the Slack header differentiates projects when the webhook is shared.
- Vanilla-JS + CSS widget in `public/index.html` (no React/Next — getchunks is static HTML + serverless). Floating orange pill bottom-right, modal with 4 types (Bug/Feature/Improvement/Other), optional email field, textarea capped at 4000 chars, Escape-to-close, backdrop-click-to-close, success state auto-closes after 1.8s.
- `vercel.json` now registers `api/feedback.js` with `maxDuration: 5`.
- README got a "Feedback Widget" section documenting `SLACK_FEEDBACK_WEBHOOK_URL` and `FEEDBACK_PROJECT_NAME` env vars.

### Decisions made
- **Reuse ontologizer's Slack webhook** — one channel, `FEEDBACK_PROJECT_NAME` differentiates the header. Can split later if the channel gets noisy.
- **Optional email field** (not in ontologizer's signed-in version) — getchunks has no auth, so this is the only way to enable follow-up on bug reports. Loose validation (no regex); Slack gets whatever the user typed.
- **Widget shown on every state** (landing, results, JSON view) — matches ontologizer behavior.
- **No Supabase / persistence** — Slack webhook is the audit trail, same as ontologizer.

### Open items / next steps
- Set `SLACK_FEEDBACK_WEBHOOK_URL` in Vercel (production + preview) — pull the value from the ontologizer Vercel project, or create a new webhook pointing at a separate channel if desired.
- Set `FEEDBACK_PROJECT_NAME=getchunks` in Vercel (optional; defaults in code).
- Ship to production and verify end-to-end delivery to Slack.

### Context for next session
- Files touched: `api/feedback.js` (new), `public/index.html` (widget markup + styles + script), `vercel.json`, `README.md`.
- Reference implementation still lives at `~/Development/ontologizer-next/` (`components/feedback/FeedbackWidget.tsx`, `app/api/feedback/route.ts`) if parity questions come up.
- Smoke-tested: `api/feedback.js` imports cleanly under Node ESM. HTML tag balance intact (5/5 script, 1/1 style).

## 2026-04-14 — v3.0 modernization executed

### What was done
- Branch `feature/v3-modernization` off clean main (feedback-widget WIP from main stashed as "WIP feedback widget (pre-v3)").
- Installed `defuddle`, `linkedom`, `gpt-tokenizer`, `sbd` (all MIT/ISC, zero AI/paid deps).
- Rewrote `api/chunk.js` end-to-end:
  - Pipeline: fetch → source-metadata scrape (JSON-LD, OG, Twitter, basic meta via cheerio on raw HTML) → Defuddle extraction via linkedom DOM, with cheerio fallback when Defuddle returns thin/empty content → heading walk with breadcrumb stack seeded by the document title (3-level cap per research) → strategy split (heading/recursive/fixed) → per-piece size cap + forceSplitByWords fallback for pathological inputs → per-chunk metadata (tokens via gpt-tokenizer o200k_base/cl100k_base, word_count, char_count, char_range, percent_through_doc, content_type, fragment) → format conversion (json/markdown/jsonl/langchain) → warnings array.
  - Backward-compat aliases kept: `token_estimate` and `total_tokens_estimate`.
- Updated `public/index.html`: v3.0.0 comments, added Extraction Engine + Output Format selectors to Advanced Options, surfaced Source block + Warnings + breadcrumb paths + content-type badges in Chunks view, added client-side conversion for copy/download so the selected format drives clipboard/file output without an extra API roundtrip.
- Bumped `package.json` to 3.0.0 with an updated description.
- Updated `README.md` header to reflect v3 (full rewrite deferred per plan).
- Plan + review captured in `tasks/todo.md`.

### Decisions made (beyond the original plan)
- **Defuddle's stripped H1**: seeded the heading stack with `source.title` as level 0 so breadcrumbs include the page title for Defuddle-extracted content. Added a consecutive-dup filter so pages where H1 == title don't render `[title, title]` paths.
- **Size cap in `heading` strategy**: NYT homepage exposed a 135KB JSON blob Defuddle extracted as one piece between headings. Heading strategy now splits any piece exceeding `target.max` via `recursiveSplit`. Added `forceSplitByWords` ultimate fallback so no chunk ever exceeds the target cap even when paragraph/sentence boundaries are absent.
- **Skipped `turndown`**: Defuddle's output + heading-breadcrumb markdown conversion was enough; client-side converter handles the download case without another dep.

### Test results
Smoke-tested 11 URL scenarios locally (example.com, Wikipedia RAG in all 4 formats, Wikipedia cheerio-only, searchinfluence.com, SI blog index, Hacker News, GitHub README, NYT homepage). All return status 200. Defuddle worked on 8/11 URLs, correctly fell back on example.com and cheerio-only mode, and HN returned 0 chunks as expected (table-only layout, no semantic headings — documented limitation). NYT test confirmed the size-cap fix works — the Videos section that was 1 massive chunk is now 4 properly-sized chunks.

### Files touched
- `api/chunk.js` (full rewrite, 451 → ~520 lines)
- `public/index.html` (version comments, two new selectors in Advanced Options, Source+Warnings+Breadcrumbs in Chunks view, client-side format converter replaces the old copy/download handlers)
- `package.json` (version + description + deps)
- `README.md` (header only; full rewrite deferred)
- `tasks/todo.md` (plan + review section filled in)

### Open items / next steps
- Unstash `WIP feedback widget (pre-v3)` and merge that work separately (`git stash list` to find it).
- Push `feature/v3-modernization` and open PR when ready.
- Full README rewrite to include v3 API reference (new fields: source, heading_path, fragment, content_type, tokens, char_range, percent_through_doc, warnings; new options: extract, format, tokenizer).
- Consider surfacing Source block in Webpage view (currently only Chunks view).
- If downstream consumers ask for it: LlamaIndex Node output shape (deferred from plan).

## 2026-04-14 — Feedback widget reapplied on top of v3

### What was done
- Reapplied the full feedback widget on `feature/v3-modernization` (stash was obsolete given the v3 index.html rewrite; cleaner to reapply fresh):
  - `api/feedback.js` — Vercel serverless function, posts Slack block payload via `SLACK_FEEDBACK_WEBHOOK_URL`, honors `FEEDBACK_PROJECT_NAME` (defaults to `getchunks`). Now returns `{ success, delivered }` so the frontend can distinguish webhook outages.
  - `vercel.json` — registers `api/feedback.js` with `maxDuration: 5`.
  - `public/index.html` — vanilla-JS floating button + modal (same anchors as before: style block near `--orange-accent`, widget markup before `</body>`). 4 types (Bug/Feature/Improvement/Other), optional email, 4000-char cap, Esc-to-close, backdrop-click-to-close.
  - `README.md` — Feedback Widget section above Error Handling documenting the two envs.
- Local smoke test passed end-to-end: signed + anonymous + empty-message + invalid-type all behave correctly; Slack returned 200 OK on both live posts (`delivered: true`).

### Root cause of earlier local-test failure
- `vercel dev` on a linked project does not reliably read `.env.local`. Fix: `set -a && source .env.local && set +a && vercel dev` — loads envs into the shell before Vercel CLI launches the function host.

### Open items / next steps
- **User paused here to pull in research updates from a separate chat before committing.** When ready: commit v3 + feedback widget together, push, open PR from `feature/v3-modernization`.
- Add envs to Vercel (production + preview) once on a deploy cadence: `vercel env add SLACK_FEEDBACK_WEBHOOK_URL` and `vercel env add FEEDBACK_PROJECT_NAME` (both interactive).
- Drop the `WIP feedback widget (pre-v3)` stash — now redundant (`git stash drop stash@{0}`). Waiting on user go-ahead.

### Context for next session
- Branch: `feature/v3-modernization` (uncommitted diff spans v3 chunk.js rewrite + feedback widget)
- Dev server stopped. Last-known-good launch: `set -a && source .env.local && set +a && vercel dev --listen 3001`
- `.env.local` at the repo root has `SLACK_FEEDBACK_WEBHOOK_URL` (pulled from ontologizer-next's .env.local) + `FEEDBACK_PROJECT_NAME=getchunks`. Gitignored.
- Reference feedback impl in ontologizer-next: `components/feedback/FeedbackWidget.tsx`, `app/api/feedback/route.ts`.
