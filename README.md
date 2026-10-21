# OmniRoute Model Lab

Project repository: [https://github.com/mhamidawad/moe-model-eva](https://github.com/mhamidawad/moe-model-eva).

A private model-evaluation gallery for cloud APIs, self-hosted servers, and local runtimes. Production is a dependency-free static frontend with no build step. Sites provides owner-only authentication; UI privacy labels are informational.

## Working features

- Search, provider/suite/source filters, card/table layouts, sorting, three-model comparisons, individual reports, case assertions, and CSV/JSON exports.
- Provider metadata management and manual model registration. New models are **Not evaluated**, with no invented metrics.
- Explicit catalog synchronization using OpenAI-compatible `GET {baseUrl}/models`; an OmniRoute base URL normally ends in `/v1`. The request uses no cookies, blocks redirects, has a 15-second timeout, and never persists its API key. The destination must be HTTPS, browser-reachable, and allow this site's origin through CORS.
- Catalog JSON file/paste import for private HTTP, localhost, or Tailscale-only endpoints. The downloadable Node helper `out/helpers/export-catalog.mjs` runs on a machine that can reach OmniRoute, reads `OMNIROUTE_API_KEY` from its environment, and saves a metadata file. It makes no inference request.
- Real report JSON file/paste import with validation and review before committing. Supports one report or a `runs` array, registered model IDs or model metadata, built-in or custom suites, and per-case outcomes. Source must be `real`, `isSample` must be `false`, case IDs must be unique, timestamps must include a timezone, latency must be numeric, and summary-only reports are rejected. A downloadable placeholder template cannot be mistaken for measured evidence.
- Source separation: the six models and 24 original fixture runs remain in the synthetic view. User reports are labeled **Real · imported**, with their authenticity explicitly described as user-declared and not independently verified.
- Historical run preservation and idempotent imports. Catalog scores use the latest report per model/suite. Real comparisons use only suites shared by all selected models with matching suite versions, case assertions, temperature, maximum output tokens, and request timeout.
- Browser-local persistence and portable workspace backup/restore, including unevaluated models. There is no account-wide database or background synchronization. Keys used for sync are never exported or saved. Provider/model registration in the gallery does not configure OmniRoute itself.

## Development and verification

Serve `out` with a static HTTP server; there is no compilation step. `pnpm test` runs data, validation, transport, and private-catalog-helper tests. `pnpm test:dom` runs application event integration checks using the development-only LinkeDOM dependency. An existing compatible DOM module can be selected with `DOM_TEST_MODULE=file:///absolute/path/linkedom.mjs`.

`tests/browser.cjs` is an additional Playwright desktop/mobile suite for a browser-enabled environment, using `BASE_URL` (default `http://127.0.0.1:4173`). Browser executables were unavailable in this session, so that suite was not run. Native dialogs are polyfilled in DOM tests; those tests do not validate CSS layout or native focus trapping.

## Deployment

The identity and static directory are in `.openai/hosting.json`. Push source, package the exact committed `.openai/hosting.json` and `out` directory, and privately deploy that commit. Preserve owner-only access. Do not make the site public without the owner's approval.

No live OmniRoute instance has been contacted or configured as part of this implementation. Connection tests use injected transports or a loopback test server. No real evaluation was performed and no test reports were preloaded into the deployed workspace.
