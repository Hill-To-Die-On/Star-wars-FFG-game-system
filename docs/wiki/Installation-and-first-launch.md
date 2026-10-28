# Installation and first launch

Use Foundry VTT **14**. The 0.3.0 stable release was verified on **14.368**; the 0.4.2 Beta runtime has passed native checks on **14.368** and **14.369**. Do not assume compatibility with another major version.

Star Wars FFG is not in Foundry's package browser. Foundry has not permitted this system to be listed in its official package directory because of the extent of the data sources it can import from external documents, such as homebrew PDF rules and adventures. Install it from a manifest URL instead.

1. In Foundry Setup, choose Install System and paste the latest release manifest below.
2. Create a new world using Star Wars FFG.
3. Log in as GM and check sheets and chat before adding optional modules.

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/latest/download/system.json
```

This is the best way to install and stay current: Foundry checks the same address for updates, so each new stable release appears in Foundry's normal update flow. It currently installs **0.3.0**. Back up an existing world before upgrading.

To evaluate the 0.4.2 Beta instead, use its version-specific manifest:

```text
https://github.com/Hill-To-Die-On/Star-wars-FFG-game-system/releases/download/v0.4.2/system.json
```

## First-launch setup — 0.4.2 Beta release

The Beta packages English only. Back up worlds before evaluation. The stable and Beta manifests are separate, so choosing Beta does not change the stable download.

After Foundry's own new-world tour finishes or is exited, Welcome aboard offers a short copyright reminder. The GM can choose the campaign's bookshelf, save it, and start or skip the Star Wars interface tour. Players see the reminder and tour invitation; they cannot edit campaign books.

The welcome decision is stored on the Foundry user in that world. Skip tutorial or Set up later prevents another automatic welcome for that user. Closing the window with its X leaves setup available on the next launch. Reopen it anytime from Configure Settings → Star Wars FFG → Welcome & interface tour.

The optional remembered bookshelf stays in local browser storage for the same Foundry address. A future world offers **Use remembered selection**; it never silently overwrites that world's filter. Another browser, private browsing, a different server address or cleared site data may not retain that preference. The current world's saved book selection remains independent.

## Before the first session — gameplay candidate

Choose the intended campaign rules, assign character ownership and verify scene access from a player login. Select **Transaction authority** in the Settings sidebar for the GM browser that will process shared changes. Repeat after reload or GM handover. Read the authority confirmation before taking over.

The optional tour is also in Settings → Tour Management. It explains added controls, not the complete game rules.
