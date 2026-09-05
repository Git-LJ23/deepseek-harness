# Agent Note: Live-first model discovery with snapshot fallback

Status: implemented

English | [中文](2026-09-05-catalog-live-discovery.zh.md)

## Problem

Model discovery for catalog routes answered from the build-time snapshot, so newly released models stayed invisible until the next harness release: the live endpoint serves 35 OpenCode Go models while the snapshot lags behind (`muse-spark-1.3-contributor`, `omen-alpha`, and others missing). Separately, a model absent from the bundled catalog failed the whole route's validation (`invalid()` — no route-wide protocol to inherit on mixed-protocol routes), so adding a new id to a route refused the entire section instead of serving it.

## Decision

`discoverModels` in [discovery.ts](../../../../packages/llm/llm-pi-ai/src/discovery.ts) tries the network before the snapshot: an explicitly configured endpoint first, then each distinct catalog listable endpoint (deduplicated by protocol and base URL, unauthenticated), falling back to the snapshot on any failure — the previous offline behavior is the fallback, not a special case. A live attempt is an inner discovery call with the provider cleared, so the fetch, parse, and error taxonomy stay in one place; distinct endpoints bound the attempts, not models.

`resolveRouteModels` in [catalog.ts](../../../../packages/llm/llm-pi-ai/src/catalog.ts) resolves catalog-unknown ids from a docs-attested per-model protocol table, then any listable catalog sibling, before refusing: unknown ids no longer fail routes whose catalog cannot describe them.

## Alternatives considered

**Merging live ids into snapshot capacities.** Returning the union with catalog capacities for known ids would preserve context windows the endpoint does not disclose. Rejected for now: it doubles the listing semantics the Models page consumes, and the materializer already falls back to route defaults for undisclosed capacities. Recorded as follow-up if the picker shows capacity gaps on live-only ids.

**Explicit-endpoint-only freshness.** Trying the network only when the draft names a baseURL would have kept catalog routes fully offline. Rejected because catalog routes are exactly where staleness bites: no deployment configures a baseURL for a catalog provider, so the fix would have reached no one.

**A config field for discovery freshness.** No: freshness is provider behavior, not a deployment choice; a deployment cannot meaningfully choose a stale listing.

## Consequences

Discovery for catalog routes now spends up to a few unauthenticated GETs (bounded by distinct endpoints) before answering from cache-equivalent data. Live rows can lack capacities the snapshot carries; the route materializer falls back to route defaults there. Three `discovery.spec.ts` cases were rewritten to the new contract — an explicitly configured endpoint wins, and the offer/withdraw mechanics now run against a protocol with no readable listing so they stay hermetic — because behavior changes ship with their tests. The pre-existing [draft-provider note](../architecture/2026-08-04-draft-provider-endpoint-interrogation.md) still owns the discovery seam; its catalog-route facts now read through this note.

## Testing

`packages/llm/llm-pi-ai/tests/discovery-live.spec.ts` pins explicit-endpoint enumeration and failure survival against a mock server, including a hermetic snapshot fallback (explicit endpoint fails, provider has no listable models). The rewritten `discovery.spec.ts` cases pin the precedence rule and the hermetic offer/withdraw mechanics. The endpoint's 35-model live listing and an ablation (removing hand-declared entries changes `listModels` 18→16 while chat on an undeclared id still succeeds) verified the behavior outside unit tests during development.
