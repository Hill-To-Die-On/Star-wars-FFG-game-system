# Director of Realms acceptance

This record separates source/build checks, native Foundry behavior, and an actual automated campaign. Passing one does not imply the others pass.

## Reproducible build

The isolated test uses Foundry 14.368, Star Wars FFG 0.3.0 based on system commit `108d432d0e2eca758a17f19e9babd1ce09e47f58`, and Director of Realms 0.10.1219 built from `f28cb4a` on its `develop` branch. The native-roll run included the candidate path guard before its actor-binding follow-up. A separate fresh-client check loaded and verified the final adapter below; it did not rerun narration.

| DoR artifact | SHA-256 |
| --- | --- |
| Production JavaScript entry | `eb48124c912b14964d5b8512ff426f4306e7a4522ae069759e065161c66e1e64` |
| Module manifest | `c2a129f7d98b292be3cd93666f3f27ea1d6665427768660c6e5bd74457d02c27` |

Final system `src/director-adapter.mjs` SHA-256, checked against the actual served response: `86b388f6adb9901af65634b46cdb0a4370a41033b0dfb6fb10b8be103791b5b9`.

The initial installed artifact labelled 0.10.1232 reported that version in both its manifest and API, but exposed neither `openCampaignStudio` nor the `campaignWorkspace` setting. Its first full Director turn returned `The narrate phase timed out after 45014ms.` That snapshot is not treated as evidence for the verified source build. The latter restores Studio and uses a 180-second local request deadline within a 210-second narration phase.

Both runtime copies used a dedicated server/data directory. The existing shared Foundry server and source checkout were not overwritten. An inherited encrypted workspace in the disposable copy was reset to create a fresh private project; the original campaign was preserved.

## Automated verification

- Cartographer TypeScript compilation and the production webpack build passed. Webpack reported two bundle-size warnings.
- Eight focused DoR suites passed, with 25 tests and one Jest worker: native Star Wars adapter, narration deadlines, PDF catalogue, background queue, review/derivative workflow, Studio controls, Painter integration, and private-asset boundaries.
- All 374 Star Wars tests passed, including seven adapter tests. Targeting regressions were demonstrated failing before the fixes. Coverage includes blocked and unknown sight, an explicit GM-ruling requirement despite an otherwise clear result, unrelated source actors, distinct unlinked actor identities, and binding vehicle crew lookup to the measured vehicle token.
- System syntax/template/data checks and the 274-file public package build passed. No PDFs, private adventure imports or extracted artwork were included.
- No full DoR test suite was run. These checks do not certify the rest of DoR or a complete campaign.

## Native Foundry results

The GM and two independently authenticated player clients received the same genuine Negotiation roll from Nara: **4 net successes and 1 Advantage**, with the other narrative axes zero. All clients parsed the same actor identity, skill, complete result vector and pool (2 Ability, 2 Proficiency, 1 Difficulty). The prompt entering DoR's model manager contained that exact summary, actor and skill. There were no JavaScript page errors. This verifies delivery to the narration boundary, not model interpretation.

The final adapter was then checked in a fresh native GM client using real token documents and instrumented range/roll boundaries. Four unsafe path cases and an unrelated actor were rejected without a roll; actor mismatch was rejected before measurement. The verified-clear control reached the instrumented roll once. A separate real range query returned clear, engaged range. These checks do not substitute for the spatial branch's native vertical-geometry tests.

Targeted execution now requires the rolled actor to match the source token's full actor UUID. Vehicle callers pass the vehicle actor and its source token; the existing vehicle roll workflow resolves assigned crew. The adapter binds that lookup to the measured vehicle instance, preventing a different linked copy from supplying its crew. It adds no new crew-role rules.

## Campaign acceptance still required

| Scenario | Completion condition |
| --- | --- |
| Edge beginner | Imported-source decisions, personal encounter, Krayt Fang identity, escape and vehicle checks |
| Age beginner | Imported mission progression, group decisions, personal combat, explicitly enabled Duty rules |
| Force beginner | Imported progression, lightsaber/Force checks, light/dark pips, explicitly enabled Morality/Conflict rules |
| Mixed campaign | Three rule lines together, shared Destiny, independent story resources, one XP ledger per actor |

Each scenario requires two independent player clients and two GM-controlled party members, conversation before an agreed decision and roll, visible scene transitions, and source-grounded narration. Navigation, evasion, ship combat, each narrative-result axis, and unscripted decisions must be recorded across the completed run. Missing sources or unsupported mechanics require an explicit GM ruling.

The initial three-client setup verified that both players saw the active scene and the same five party conversation messages before the declared decision. Its timed-out narration did not complete the opening beat. No campaign scenario is marked complete from that result.

On the verified source build, the bounded Director turn was refused after 2.45 seconds with `Foundry frame pressure is red (p95 17 ms); no pressure-safe model is available for this turn.` The refusal occurred before provider inference. DoR measures animation-frame intervals, not CPU execution time: green is at most 25 ms, amber at most 50 ms, and recovery requires 30 healthy seconds. A retained red state at 17 ms is therefore not evidence of sustained low frame rate or a 17 ms red threshold. No resource guard was overridden and no local model was loaded, switched or unloaded.

A subsequent 50-second observation kept the GM document visible and focused throughout. The load spike reported 100 ms at five seconds, settled to 17 ms by ten seconds, and recovered naturally to green at 40 seconds, remaining green through 50 seconds at roughly 60 FPS. The remaining setup limitation is provider availability, not sustained frame pressure: the configured Ollama endpoint had zero resident models; LM Studio's only loaded model was a 9B vision model belonging to a concurrent workflow. Its larger text models were present but unloaded. The existing DoR local fallback policy requires 20B for Director work and excludes vision models for narrative fallback. No cloud provider key was configured. No current-source provider inference request was made, and no complete campaign or cinematic interpretation was established.

## Artwork acceptance boundary

The current DoR source already implements generic PDF extraction, a background queue, world-private catalogue entries, source/page provenance, classification, GM review, non-destructive variants and Surveyor quality checking. This work belongs to DoR and is independent of the Star Wars system.

The actual Studio intake processed a privately held map PDF into 25 catalogue candidates: initially 23 awaiting review and two rejected. One GM approval persisted after closing and reopening Studio, leaving 22 awaiting review and one approved. The queue paused for Foundry pressure and resumed to completion. Preview paths stayed under the private world. This is extraction/catalogue/review acceptance for one PDF, not every book or every preview. No source text or art was added to public code.

The configured local image service did not answer its ComfyUI/Stable Diffusion health endpoints. No remaster, upscale, label-removal or image-generation request was made. Optional debug-helper endpoint failures were recorded separately from JavaScript page errors.

Remaining acceptance must distinguish ordinary image extraction from actual remastering and scene survey. A visible Upscale or Player map button is not proof of a successful provider request, a spoiler-free derivative, or correctly placed walls, doors, windows, lights, traps and zones. Pixel files and extracted source passages remain private local evidence and are excluded from this repository.
