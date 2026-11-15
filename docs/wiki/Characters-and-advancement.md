# Characters and advancement

The full guided creation and tabletop features described here belong to the 0.5.0 Beta; consult the release notes for the installed version.

The 0.5.3 Beta adds **Status** to Overview. It lists active effects and their configured sheet adjustments. Recorded critical injuries identify the source when one is available. A record-only injury leaves the consequence for the GM to apply from that rule. The Vitals section shows accumulated wounds and strain.

With a compatible Director of Realms module, routine organic wounds use a wound marker. Blood effects show when a recorded Bleeding condition is active. Inventory groups Weapons, Armour, and Tools and gear. Equipment keeps its own artwork where available.

Create a Character actor, then choose **Manual creation** or **Guide me**. Both use the same starting-resource and XP validation. The guide narrows the choices to a concept; it does not waive prerequisites.

1. Choose a database-backed species, career and starting specialization allowed by the campaign.
2. Review characteristics, free ranks, Force rating where applicable, and cited exceptions.
3. Choose the starting story/resource benefit for that character's rule line.
4. Review equipment, credits and XP. Finish the one-time starting pocket-money step where required.
5. Buy starting talents and resolve outstanding source decisions before Ready for play.

In the 0.5.0 Beta release, drag the sheet's lower-right resize handle to keep it beside the canvas. Narrow sheets automatically use a compact header, wrapping section tabs and fewer skill columns; skill buttons still open the editable pool. Talent trees keep a readable minimum width and scroll within their panel. The layout follows the sheet width, not the monitor, and expands again when enlarged.

The sheet exposes skill pools, custom skills, motivations, multiple specialization trees and signature abilities. Clicking an eligible talent node spends XP through the authority workflow and records the purchase. Only supported, configured effects apply automatically; check Help & rules coverage for the actual effect and verification status.

A verified chart layout is different from a fully automated talent. Active or situational effects may require a choice or explicit GM ruling. Do not infer an effect from an icon or an empty description.

Species and original career are creation choices. Later advancement adds specializations and connected talent purchases instead of replacing the starting identity. Keep the cited book available to interpret entries.

In the 0.5.3 Beta, **Add specialization** on the Advancement tab browses the imported Equipment & advancement library. It excludes owned specializations and sources disabled by the campaign, shows the native XP cost, and asks for purchase confirmation. Dragging a specialization onto the sheet uses the same confirmation and transaction. Additional career skills do not grant free ranks or replace the original career. The free first specialization still belongs to character creation.

The GM can separately use **Restore starter advancement from owned JSON** for a missing, unpurchased starter chart. Select one native specialization JSON with `system.metadata.starterCareerTree` provenance: schema `1`, source character, PDF filename and SHA-256, physical chart page, and folio identity page. The chart must match the actor's character and career; the GM reviews the source and explicitly confirms the current sheet. Existing, conflicting or partly attached records are refused. This attaches only the missing tree and leaves XP, purchases and actor statistics unchanged. A chart marked `verified: false` remains read-only, including disconnected nodes, until source connections receive separate verification. Source material stays in the local owned world; no published starter data is distributed with the system.


**0.5.3 Beta:** Compatible integrations can open a character-owned native skill pool with a supplied difficulty, challenge, and setback pool. The player reviews and edits the dice before confirming the roll; availability depends on the installed integration and system versions.
