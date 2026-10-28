# Book-specific adventure and reward guidance

The [Director of Realms adapter](director-of-realms.md) offers GM-only adventure seeds and source-linked preparation and reward prompts, filtered by the campaign's owned books. This page is for GMs who use Director of Realms (DoR) and for DoR maintainers. Nothing described here applies rewards or changes the world.

Both interfaces follow the owned-book selection. When owned-book mode is active, the source book must be among the campaign's selected books; selecting no books returns no entries.

## Adventure seeds

The creator-authorized reference catalogue contains 421 adventure seeds across 17 books. Every seed has a source book and printed page; 78 have no description. Similarly named seeds are kept as separate source records.

```js
getAdventureSeeds({ query, book, page, pageSize })
```

This returns a GM-only, campaign-filtered page of seed ingredients. A seed is a starting point, not a prepared encounter, and it is not a source for unrecorded dice pools.

## Preparation and reward guidance

```js
getBookPlayGuidance({ book, kind })
```

This returns GM-only, campaign-filtered preparation and reward prompts. `kind` can be `adventure-guidance` or `reward-guidance`. Each entry keeps its exact book and printed page.

The public registry holds eight original summaries, each checked against page images:

| Entry | Kind | Book | Pages |
| --- | --- | --- | --- |
| Spy campaign guidance | `adventure-guidance` | *Cyphers & Masks* | p. 86 |
| Mystic adventure guidance | `adventure-guidance` | *Unlimited Power* | p. 75 |
| Seeker companion guidance | `adventure-guidance` | *Savage Spirits* | pp. 80–81 |
| Spy XP review | `reward-guidance` | *Cyphers & Masks* | p. 93 |
| Spy non-XP rewards | `reward-guidance` | *Cyphers & Masks* | pp. 94–95 |
| Hired Gun rewards | `reward-guidance` | *Dangerous Covenants* | pp. 89–91 |
| Ace rewards | `reward-guidance` | *Stay on Target* | pp. 92–93 |
| Seeker rewards | `reward-guidance` | *Savage Spirits* | pp. 92–94 |

### Adventure guidance

Each prompt is labelled `prepare` or `during-play`, so DoR can use it at the right point. The entries do not contain the book's adventure text, scenes, NPC statistics or a fixed plot.

DoR should combine a selected entry with the actual party, the GM's campaign material and any privately imported adventure, then ask the GM to review encounter mechanics and transitions.

### Reward guidance

Reward entries record decision points with an unknown numeric amount. They do not award XP, grant equipment, change Duty or commit any world state.

- **Spy:** review quiet successes, choose session or mission XP timing while accounting for all sessions, and treat an exceptional mid-mission spend as a GM decision. The later pages discuss resource access, training responsibilities and gear choices.
- **Hired Gun:** tie combat-heavy XP and pay to the mission's context, and distinguish loaned gear from lasting rewards.
- **Ace:** consider occasional bonus XP and choose suitable cash, gear, reputation, Duty or promotion rewards.
- **Seeker:** consider companions or mounts, training, insight and standing alongside the ordinary XP baseline.

## How coverage grows

Coverage expands one book at a time. A private scan of held PDFs flags candidate pages for reward, adventure-running and seed material, but those pages are search pointers, not verified instructions; PDF content and OCR stay private. Each summary is checked against the printed page before it is added to the public registry.

Candidate instructions from the separate rules scan have not been added to this registry. Each book remains a distinct source, even when its advice resembles another book's.

## Limitations

- Only the eight entries above are available. Most books have no reviewed guidance yet.
- Reward amounts are never set, and no reward is applied. The session wrap-up workflow remains open on the roadmap.
- The adapter exposes these methods now, but automatic invocation from DoR's Campaign Studio and a live DoR adventure check are still pending.
