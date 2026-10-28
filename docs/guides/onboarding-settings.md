# First launch and settings

This guide explains what GMs and players see the first time they open a world, how the campaign's book selection is saved, and how the system arranges Foundry's settings, windows and sheets. The welcome flow is part of the 0.4.2 Beta; the stable 0.3.0 release does not include it.

## The welcome window

Each user gets their own welcome, which appears after Foundry's own new-world tour has finished or been closed. It contains:

- a copyright reminder;
- for the GM only, a campaign bookshelf for choosing the books available at the table;
- an invitation to an optional interface tour built on Foundry's native tours.

Players see the reminder and the tour invitation, but no controls that change the books.

The tutorial only explains. It imports nothing, rolls no dice and changes no actors, and the world stays fully playable if you put setup off. To open the welcome again later, use **Welcome & interface tour** in the system settings.

### Skip or postpone

- **Skip tutorial** or **Set up later** records that choice, with the tutorial version, on your Foundry user for this world.
- Closing the welcome window without choosing leaves it to appear again at the next launch.
- Foundry's **Tour Management** keeps track of tour progress separately.

## Choose the campaign's books

The bookshelf saves into the world's existing campaign setting, alongside the rule lines, adventure state and other campaign choices, which are left untouched.

- **All references** shows everything. It is an explicit choice and does not state that you own every book.
- If you choose owned books but tick none, every source-linked entry is hidden.
- Searching the shelf hides rows without clearing the books you have ticked.
- The existing **Owned books** form in the settings does the same job, and can also update or clear the remembered preference described below.

No PDF, scan, book text, artwork or credential is saved by this workflow.

### Remember the selection for future worlds

You can let the browser remember your choice. Only a version number, the book titles, the all/owned filter and the preference for entries without a source reference are stored, in the same browser profile and for the same Foundry address.

A later world offers to reuse that selection; it is never applied silently. **Forget** removes the browser's copy and nothing else.

## How settings are grouped

The system arranges Foundry's settings into six groups, in this order:

1. Campaign setup
2. Appearance & accessibility
3. Combat & turn automation
4. Play tools & references
5. Imports & private sources
6. Help & diagnostics (this includes **Rule data review**)

The groups reuse Foundry's own settings rows, which keep their values, listeners, permissions, search and saving. Groups with no matching rows are hidden while you search, and re-opening the window does not create duplicate groups.

## Window and journal appearance

- Foundry's core configuration windows, and the campaign rules, owned books and GM source-key backup forms, keep Foundry's styling.
- The system's play windows and ordinary dialogs use its own paper, ink, headings and window frames.
- Journal pages use paper throughout, with a dark navigation sidebar. Journal styling follows the interface theme; choose the Foundry default theme to opt out. Sidebar directories keep their normal appearance.

The interface tour gives its **Exit**, **Previous**, **Next** and **Finish** buttons keyboard names and focus. If a control the tour points at is missing or hidden, that step is shown centred with an explanation instead. Tour pop-ups close properly at the end, including under a reduced-motion theme.

## Default backdrop

The interface background is the credited NASA artwork. A scene you are viewing, whether it has an image or a solid background, covers it.

On a completely new world, the system replaces only Foundry's untouched automatic welcome scene with the NASA scene, at the artwork's original aspect ratio and without the stock logo or animated light. Existing scenes, blank tactical play areas and custom maps are never changed. Choosing the Foundry default theme opts out. Credits and terms are in [NASA artwork rights](../sources/nasa-artwork-rights.md).

## Resize actor sheets

Actor sheets keep Foundry's resize handle and adapt to their own width:

- the header and portrait shrink and spacing tightens;
- tabs wrap;
- skills are shown in three, two or one column;
- talent trees scroll inside their panel rather than shrinking their nodes.

Inputs and roll buttons stay available at every size. The window stays within the screen, down to a 640 by 480 display. Resizing changes only the layout: it does not update the actor or add continuous resize listeners.

## Limitations

- Remembered books live in one browser profile for one Foundry address. This is not cloud synchronisation.
- If another window changed the books while the bookshelf was open, saving is refused rather than overwriting that change. Foundry's GM permissions remain the authority; this is not a guarantee of simultaneous-edit safety across clients.
- The copyright reminder marks a content boundary. It is not a copyright licence.

## Online wiki

The [GitHub wiki](https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/wiki) covers installation, books and campaign rules, the interface, characters, combat and vehicles, integrations, troubleshooting, contribution and credits. It labels the stable 0.3.0 release and the 0.5.0 Beta separately.
