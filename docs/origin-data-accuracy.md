# Origin data accuracy

The public origin audit checks the structured identities used during character creation and advancement. It compares species, careers, career specializations, signature abilities, source references and the published advancement overlay. It does not reproduce sourcebook prose or artwork.

Run it with:

```powershell
npm run audit:origins -- --output=test-results/origin-data-audit.json
```

The same audit runs as part of `npm run check` and has a focused regression suite at `tests/origin-data-audit.test.mjs`.

## Current coverage

| Area | Checked | Total | Remaining |
|---|---:|---:|---:|
| Catalogue species | 174 | 174 | 0 structural rows |
| Playable species with a usable source | 99 | 104 | 5 without a source |
| Species ability entries compared with printed pages | 39 | 104 playable | 65 pending |
| Sourced careers | 20 | 24 careers | 4 intentional selection categories |
| Career specializations with a full chart comparison | 132 | 135 | 3 pending |
| Signature abilities with a full chart comparison | 36 | 38 | 2 pending |

All 135 specialization identities map to a career, a registered book and an advancement item. The four specializations with no bonus career skills are the universal Force Sensitive Emergent, Force Sensitive Exile, Force Sensitive Outcast and Padawan Survivor entries. Retired Clone Trooper has six bonus skills; Republic Representative preserves its flexible “any one Knowledge” choice while the advancement overlay stores its three fixed skills.

## Open source work

Five playable rows have no usable catalogue source: Arkanian, Drall, Gungan, Human - Corellian and Sathari. The 65 pending species rows include those five and 60 cited rows whose ability blocks have not yet been compared with a held printed page. Their recorded `Special` field remains visible as catalogue data and is not treated as an automated rule.

Three specialization charts from **Age of Rebellion - Fully Operational** still need a full comparison: Droid Specialist (p. 24), Sapper (p. 26) and Shipwright (p. 28). The two signature charts from the same book are also pending: The Harder They Fall (p. 34) and Unmatched Ingenuity (p. 35). Their structured graphs remain usable, but the audit keeps the source status visible.

The catalogue contains two Gand rows with the same source identity and different creation profiles. The audit keeps this as a warning so a selection retains its row identity rather than silently collapsing the variants.

## Corrections applied

The source-backed advancement overlay exposed six stale raw catalogue skill lists. The public reference database and matching Foundry Items now agree with the corrected overlay:

- Clone Trooper: Ranged (Heavy) replaces Ranged (Light).
- Courier: Deception replaces Discipline.
- Juyo Beserker: Lightsaber replaces Leadership.
- Makashi Duelist: Coordination replaces Coercion.
- Padawan: Coordination replaces Coercion.
- Tactician: Discipline replaces Deception.

The audit includes a mutation test for the first correction, so a future catalogue edit that reintroduces the mismatch fails before release. It also caught and corrected the public signature-ability spelling mismatch between **Unmatched Devastation** and the source database row.
