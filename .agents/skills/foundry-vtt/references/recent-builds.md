# Recent Foundry stable builds

Newest first; keep about five. Each line: what a package developer needs from that build. Full
notes: `https://foundryvtt.com/releases/<build>`. The build each project last verified live is in its
`references/project.md`, not here.

- **14.370** (2026-11-02, Full). node.js security fixes. **Breaking:** `CalendarData#onUpdateWorldTime`
  now receives `deltaTime`. World time is stored as an integer. New: core settings readable before
  `init`; Levels carry `_stats`; `Token#_createMesh` and the `createTokenMesh` hook; Tiles named from
  their texture when created unnamed; Region "Draw Grid Spaces" tool (grid-space shapes, holes);
  `CONFIG.Region.templateModeConfig` and `.gridBased`; `DiceTerm#minValue`, `#minResult`, `#maxResult`;
  players set their own passwords; Adventure Importer V2 is the default for new Adventures. Fixes:
  players owning two or more tokens saw hidden tokens; `Combatant#_preDeleteOperation` used the
  wrong turn; pack indexes polluted by embedded fields; `toCompendium()` cleared the wrong fields;
  `LIMITED` compendium journals rendered blank; fog not saved after a Scene resize.
- **14.369** (2026-10-08). Native HTTPS (Let's Encrypt for a bare IP, else self-signed);
  `ContextMenu` CSS class; Placeables tab filters. Fixes: placeables and Region shapes reposition
  when a Scene is resized; `Combat#previous` restored; `NumberField` change deltas keep `null`;
  `ObjectField#clean` migrates legacy deletion keys; `ForcedReplacement` fixes; `setProperty` and
  `expandObject` keep `undefined`; darkness lights in Chromium and Firefox; multi-Scene teleport
  Regions with player choice.
- **14.368** (2026-09-16). Update.
- **14.367** (2026-08-18) and **14.366** (2026-08-14): updates.
