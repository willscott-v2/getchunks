# getchunks v3.1 — SI design system + hardening

**Goal:** Adopt the Search Influence design system just launched on AI Website Grader and Ontologizer, and fix the bugs/security issues found in the 2026-07-21 full code review.

**Provenance note:** The grader's stylesheet is literally titled "GetChunks Design System — AI Website Grader" and ontologizer's tokens cite the grader as the canonical source. The theme started here and matured there; this brings it home. The grader kept getchunks' class names (`.header-content`, `.form-card`, `.view-toggle`, `.results-header`…), so this is a CSS swap, not a markup rewrite.

**Structure:** Two branches / two PRs so review stays clean:
1. `feature/si-design-system` — visual only, no behavior change
2. `fix/hardening-and-bugs` — security + bug fixes, no visual change

---

## Questions needing Will's decision before/while executing

- [ ] **GTM ID:** Committed ID is `GTM-4G43` (public/index.html:18) — 4 chars is short for a container ID. Confirm it's the real, complete ID. If yes, proposal: hardcode it and delete scripts/build.js + the vercel buildCommand entirely (GTM IDs are public; the injection step is what caused the source-mutation mess).
- [ ] **Rate limiting:** Approve enabling a Vercel WAF rate-limit rule on `/api/*` (dashboard config, zero code)? Code-level limiting in serverless is per-instance and mostly theater.
- [ ] **Legacy design files:** `getchunks-patterns.js`, `getchunks-styles.css`, `search-influence-*.{html,css}`, the two GUIDE.md files (~1,900 lines, unused by the app). Move to `docs/legacy/` or delete?

---

## PR 1 — `feature/si-design-system`

Source of truth: `ai-website-grader/app/globals.css` + `ontologizer-next/app/styles/tokens.css` (identical palettes).

### Tokens & typography
- [ ] Add the canonical SI `:root` token block to the inline `<style>` (si-dark-navy `#012c3a`, si-navy `#014a61`, si-orange `#f07a18`, si-slate `#34495e`, hero gradient `#43566d→#3c4e63`, report-green `#24ab59`, header-accent `#f28a22`, content/border/muted grays — copy verbatim from tokens.css)
- [ ] Add Open Sans (400/700/800) via Google Fonts `<link>` with preconnect; set `--font-stack` to match the other apps
- [ ] Replace all hardcoded legacy colors (`#2c3e50`, `#34495e`, `#e67e22`, `#f39c12`, `#3498db`, `#27ae60` gradients) with token references

### Component restyle (match grader 1:1)
- [ ] Body → si-dark-navy; main-section → si-slate
- [ ] Header → 90° hero gradient, 2px header-accent bottom border, drop the `::before` overlay; h1 3rem/800; tagline header-accent
- [ ] Form card → flat `--surface-slate` (#405466) with subtle border; drop glassmorphism blur + hover lift
- [ ] Inputs → white/6 bg, white/16 border, orange focus ring (grader's exact focus treatment)
- [ ] Extract button → flat si-orange, hover `--orange-dark` (#d96610), weight 800; drop gradient
- [ ] Results header → flat report-green (#24ab59); drop gradient
- [ ] Summary cards → repaint from blue gradient to grader surface treatment (si-medium-blue for info accents)
- [ ] Chunk badges, blockquote accents, small-chunk index → si-orange
- [ ] Feedback widget → `--orange-accent` now resolves to si-orange; modal bg → surface-slate
- [ ] Features + FAQ sections → grader treatment (flat cards on si-slate, 800-weight headings)
- [ ] Footer → si-dark-navy, orange links
- [ ] Serve the SI logo locally in `public/` instead of hotlinking searchinfluence.com wp-content (copy asset from grader)
- [ ] Version comments → 3.1.0
- [ ] Visual QA at 375px / 768px / desktop; verify all three views (Webpage/Chunks/JSON) + modal

## PR 2 — `fix/hardening-and-bugs`

### Security (ranked)
- [ ] **SSRF guards** in api/chunk.js: allow only `http:`/`https:`; resolve hostname and reject private/reserved ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7); cap response at ~5MB; require `text/html`-ish content-type
- [ ] **Rate limiting** via Vercel WAF rule on `/api/*` (pending approval above)
- [ ] **escapeHtml quote fix** (index.html:1998): escape `"` too; audit the two attribute sinks (`title=` at :1943 — scraped-page XSS vector, `href=` at :1880)
- [ ] **Slack injection** (feedback.js): escape `&`, `<`, `>` in message/email/pageUrl before building blocks (kills `<!channel>` pings and link spoofing)
- [ ] **Error leak** (chunk.js:57): stop returning raw `error.message`; log server-side, return generic message + safe category
- [ ] **Input validation**: allowlist `chunkSize`/`strategy`/`tokenizer`/`format`; reject bad values with 400 instead of 500

### Bugs
- [ ] **Overlap slider stuck on Auto** (index.html:1528-1537): unreachable else branch — rework so dragging to a nonzero value exits auto mode, 0 returns to it
- [ ] **Dead fetch timeout** (chunk.js:84): node-fetch v3 ignores `timeout:` — replace with `AbortSignal.timeout(25000)`; drop node-fetch for native fetch (engines already >=18), removing a dependency
- [ ] **"Defuddle only" honored** (chunk.js:136): when `extract=defuddle`, fail with a clear error instead of silently falling back to cheerio

## PR 2 (or fold into 1) — Housekeeping
- [ ] README: license MIT (matches package.json), repo URLs → searchinfluence/getchunks, remove stale v1.2 sections, add v3 field reference
- [ ] index.html footer GitHub link → searchinfluence/getchunks
- [ ] FAQ "Is my data secure?" — reword: URLs appear in analytics events and server logs; don't claim zero storage
- [ ] GTM: hardcode confirmed ID, delete scripts/build.js + vercel buildCommand (pending answer above)
- [ ] Legacy design files → docs/legacy/ or delete (pending answer above)

## Explicitly NOT doing this round
- Tests/lint scaffolding (worth doing, but separate PR — fixture snapshot tests for split/merge/overlap)
- Nested-content extraction fix for the cheerio fallback path (real but invasive; Defuddle covers the common case)
- Headless rendering, batch mode, auth — unchanged known limitations

## Review section

**Decisions made (2026-07-21):**
- GTM `GTM-4G43` verified against grader + ontologizer `.env.local` — it's the shared SI container (legacy short ID). Hardcoded; build-injection machinery deleted.
- Rate limiting via Vercel WAF rule (dashboard config) — no code-level limiter. Still to be applied in the Vercel dashboard.
- Legacy design files deleted (recoverable from git history).

**PR 1 — `feature/si-design-system` (#5):** CSS-only token swap in public/index.html to the canonical SI palette; Open Sans; flat orange CTAs; report-green results header; light summary/source cards inside the white content area; logo served locally. Playwright QA at 1440px/375px across landing, advanced options, both result views, feedback modal — all pass.

**PR 2 — `fix/hardening-and-bugs` (stacked on #5):**

Security:
- api/chunk.js SSRF guards: scheme allowlist (http/https); DNS resolve + private/reserved range block (127/10/172.16/192.168 + 169.254 metadata + 100.64 CGNAT + IPv6 ULA/link-local/loopback); per-hop redirect re-validation via manual redirect loop (max 5); 5MB response cap; content-type allowlist. Verified: localhost/127/metadata/10.x/ftp/file all rejected 400; wikipedia http→https redirect followed to a real 12/29-chunk result.
- escapeHtml escapes `"` and `'` — closes the `title="${fragment}"` attribute-injection XSS from scraped heading ids. Verified: payload stays inside the title attr, no onmouseover created, hover doesn't fire.
- Slack mrkdwn escaping in feedback.js (`&<>`) on message/email/pageUrl/user-agent — kills `<!channel>` pings + `<url|label>` spoofing; pageUrl scheme-checked + length-capped.
- Input validation: allowlist chunkSize/strategy/extract/format/tokenizer → 400 not 500; overlap bounded 0–200.
- Error leak closed: ChunkError carries safe client text; generic 500s; feedback no longer echoes err.message.

Bugs:
- Overlap slider Auto-lock fixed — dragging to nonzero exits auto and the value reaches the request body (verified 25→request, 0→Auto).
- Dead node-fetch `timeout` replaced with native fetch + `AbortSignal.timeout(25s)`; node-fetch removed (6 packages pruned).
- `extract=defuddle` fails 422 instead of silently falling back to cheerio.

Housekeeping:
- Deleted scripts/build.js + vercel buildCommand + node-fetch; GTM hardcoded; GTM_SETUP.md rewritten.
- Deleted ~1,900 lines of unused root design files.
- README: MIT, searchinfluence/getchunks URLs, stale v1.2 section removed, v3/v3.1 history added; footer link fixed; FAQ "data secure" reworded to acknowledge analytics/logs.

**Rate limiting — DONE (2026-07-21, via Vercel Firewall API):** Two additive custom rules live on prj_wOIeC5... (team will-scotts-projects, Pro). `chunk-rate-limit`: path pre `/api/chunk`, 20 req/60s/IP → deny. `feedback-rate-limit`: path pre `/api/feedback`, 5 req/600s/IP → deny. firewallEnabled=true, config version 2. Managed WAF ruleset untouched. Applied via `PATCH /v1/security/firewall/config` (rules.insert) after `vercel login` refresh; the CLI has no firewall command. To tune later: edit in the dashboard Firewall tab or re-PATCH.

**Deferred:** fixture/snapshot tests for split/merge/overlap; nested-content extraction fix for the cheerio fallback path.

## Plan: Chunk Quality upgrade (v3.2 → v3.4) — 2026-07-24

**Origin:** Chuck Wilkins feedback — he couldn't interpret the Chunks view (mistook overlap for duplicate content, asked what "good" looks like and how to turn output into page optimizations). Goal: move the tool from "is this page chunkable?" to "here's what to change" — 100% deterministic, zero AI tokens.

**Constraint:** all analysis is pure code (regex, word counts, stoplists, token overlap, BM25, Jaccard shingles, Flesch-Kincaid). No LLM calls anywhere.

### Phase 1 — Comprehension (v3.2): make current output self-explanatory
Branch: `feature/chunk-quality-v3.2`

- [x] `api/chunk.js`: `addOverlap()` records `overlap_word_count` on each small chunk it modifies (words prepended from the previous chunk) — carried through `enhanceChunks()`; also added `settings.target_words` ({min,max,target}) so the UI reads size ranges live instead of mirroring `CHUNK_SIZES`
- [x] UI: render the overlap prefix dimmed/underlined inside the section text, with a `↔ Nw overlap` badge + tooltip ("Repeated from the previous chunk on purpose so this chunk stands alone if retrieved by itself")
- [x] UI: collapsible "How to read this" legend at the top of Chunks view — defines Chunk (heading section), L# (heading level), sections (retrieval units), w/t, target size ranges (pull live from `settings`), and overlap. Also swapped the Content Summary stat labels (big=Chunks, small=Sections) — they were reversed vs the chunk cards
- [x] Smoke test on the Hayes Barton Place page (the exact page Chuck screenshotted) — Chunk 2 sec 2 reports `overlap_word_count: 29`, renders badged + dimmed; 7 overlap badges total (2w–35w). Playwright-verified. Plus 3 known URLs (searchinfluence.com, Wikipedia RAG article, getchunks itself): 0 prefix-regex mismatches, target_words tracks auto-detected size, zero-overlap case clean.

### Phase 2 — Diagnosis (v3.3): flags + Chunkability score
Branch: `feature/chunk-quality-v3.3`

- [x] `api/chunk.js`: new pure function `analyzeChunks(bigChunks, source, settings)` → per-chunk `flags[]` (`{code, label, severity, message, fix}`) + top-level `chunkability: {score, grade, top_fixes[]}`; also attaches `chunk_score` per chunk
- [x] Anchor-term set: tokenized page title + H1 + `og:site_name` + JSON-LD Organization/LocalBusiness names — plus initialisms ("Retrieval-augmented generation" → "rag", "University of Wisconsin-Milwaukee" → "uwm") after tuning showed acronym-usage false positives
- [x] Flags (all deterministic):
  - [x] `no-entity-anchor` — no anchor term appears in chunk title+text
  - [x] `dangling-reference` — chunk opens with a pronoun (`^(our|we|this|these|those|it|its|they|their|he|she)\b`)
  - [x] `thin-section` — under `min(target.min, 100)` de-overlapped words (absolute 100w floor added in tuning: 500w min on "large" pages flagged every Wikipedia section)
  - [x] `oversized-section` — over target max with no subheading
  - [x] `generic-heading` — heading in ~40-entry stoplist
  - [x] `answer-buried` — zero stemmed content-word overlap between heading and first sentence; requires ≥2 heading content words (single-word headings like "History" were pure noise)
  - [x] `near-duplicate` — word 5-gram Jaccard ≥ 0.6 between de-overlapped chunk pairs. Caught a REAL extraction bug: containers wrapping nested sections were swallowed wholesale into the parent chunk (the long-deferred nested-content fix) — fixed in `extractContentPieces`/`stopCondition`, not muted in the analyzer
  - [x] `readability` — Flesch-Kincaid per chunk, info-only flag when grade > 12, no deduction
- [x] Score — reworked during tuning: flat per-instance deductions punished many-chunk pages, so each chunk starts at 100, loses its flags' weights (dangling/dupe 30, no-anchor 25, thin/oversized/generic 20, answer-buried 15), page score = average. Proportional by construction, per-chunk explainable, still deterministic
- [x] UI: score card at top of Chunks view (score + grade color-banded, top 3 fixes with "up to +N pts")
- [x] UI: color-coded flag chips on chunk cards (red/amber/info/green "No flags"), fix shown via the CSS tooltip
- [x] UI: "show only flagged" filter toggle (delegated listener, resets per run)
- [x] Tuned against 5 real pages: Wikipedia RAG 79/C (control, highest ✓), Liberty Senior Living 73/C, seasidefl.com 68/D (looks clean, but 9 sections all under 100w), SI home 65/D, Hayes Barton Place 51/F (Chuck's page, worst ✓)

### Phase 3 — Action (v3.4): retrieval simulator + report export
Branch: `feature/chunk-quality-v3.4`

- [ ] Client-side BM25 (~60 lines, no deps) over small chunks
- [ ] "Test retrieval" panel: single question → ranked chunks with scores, winner highlighted with its flags shown (does the winning chunk stand alone?)
- [ ] Multi-query textarea (one per line — from GSC, keyword tools, or an Ontologizer fan-out run) → coverage matrix: query → best chunk → score → covered / weak / gap
- [ ] "Copy optimization report" — markdown export: URL, score, flags grouped by severity with specific edits, coverage gaps. This is the SEO-facing deliverable; JSON stays for devs
- [ ] CSV copy for the coverage matrix

### Phase 4 — Later / optional
- [ ] Template query generator (entity × heading permutations) to prefill the simulator — zero-AI fan-out approximation
- [ ] `?queries=` URL param so Ontologizer's fan-out tab can deep-link into the chunker
- [ ] Compare mode: re-run same URL, show score delta
- [ ] Docs: README section explaining every flag and the score formula (determinism = explainability; publish the rubric)

### Review
_(fill in after execution)_
