# Playable species ability coverage

Which playable species have their ability blocks checked against the printed page, and which of those abilities the system applies automatically.

The reference catalogue lists 104 playable species. Each has a short `Special` note, which is not a complete rule. `data/species-abilities.json` records the species whose ability blocks have been compared with the printed page: starting skill ranks, skill choices and short, originally worded summaries of each ability. It contains no book text or images.

**Coverage: 95 of 104 playable catalogue rows (94 registry entries).** The two Gand catalogue rows share one entry; the book prints one Gand whose lungs are a choice inside its Ammonia Breathers ability.

Each entry stores two pages. `cataloguePage` is the catalogue's citation, usually where the species section starts. `page` is where the ability block is printed, often one or two pages later. Entries match a character's species by name, book and catalogue page.

## Reviewed books

| Book | Species |
|---|---|
| Edge of The Empire - Core Book | Bothan, Droid, Gand, Rodian, Wookie |
| Age of Rebellion - Core Book | Duros, Gran, Ithorian, Mon Calamari, Sullustans |
| Force & Destiny - Core Book | Human, Cerean, Kel Dor, Mirialan, Nautolan, Togruta, Twi'lek, Zabrak |
| Edge of the Empire sourcebooks | Arcona, Chevin (Far Horizons); Aqualish (Aquala, Quara, Ualaq), Klatooinian, Weequay (Dangerous Covenants); Chiss, Toydarian (Enter the Unknown); Falleen, Gotal, Quarren (Fly Casual); Gank, Hutt, five Nikto subspecies, Sakiyan (Lords of Nal Hutta); Clawdite, Devaronian, Kalleran (No Disintegrations); Besalisk, Dug, Northern and Southern Mustafarian (Special Modifications) |
| Age of Rebellion sourcebooks | Balosar, Kubaz, Melittos (Cyphers & Masks); Caamasi, Gossam, Neimodian (Desperate Allies); Elom, Elomin, Kyuzo, Shistavanen (Forged in Battle); Human - Mandalorian (Friends Like These); Chagrian, Ishi Tib (Lead by Example); Chadra-Fan, Dressellian, Xexto (Stay on Target); Polis Massan, Verpine (Strongholds of Resistance) |
| Force and Destiny sourcebooks | Cosian, Pau'an (Disciples of Harmony); Muun, Pantoran (Endless Vigil); Iktotchi, Lannik, Whiphid (Keeping the Peace); Dowutin, Mikkian, Phydolon (Knights of Fate); Aleena, Bardotan (Nexus of Power); Anx, Quermian (Savage Spirits); Thisspiasian, Tholothian, Vurk (Unlimited Power) |
| Era and other books | Clone, Geonosian, Umbaran (Rise of the Separatists); Dathomirian, Harch, Karkarodon (Collapse of the Republic); Drabatans, Gigoran, Iakaru, Tognath (Dawn of Rebellion); Ewok, Jawa, Lasat, Tusken Raider (Allies & Adversaries) |

## What is automated

Character creation grants the verified starting skill ranks and asks for any required species skill choice. The usual rank-two creation cap includes the species grant.

Eleven abilities apply on their own because they are unconditional:

| Effect | Species |
|---|---|
| One Boost die on listed skills | Umbaran (Charm, Deception, Negotiation), Ewok (Perception, Vigilance), Mikkian (Perception) |
| Automatic Advantage on listed skills | Balosar (2 on Vigilance), Arcona (1 on Charm and Negotiation), Duros (1 on Astrogation), Zabrak (1 on Coercion) |
| A second free manoeuvre each turn, within the two-manoeuvre limit | Harch, Quermian, Xexto, Besalisk |

Every other ability depends on a trigger, target, environment, equipment, granted talent or GM decision. These appear on the character sheet and in the reference catalogue with their page and an **Apply when relevant** status. Existing characters are never rewritten: the sheet flags starting skill grants that predate the registry.

Where a book states a rule under a generic heading, the entry uses a short descriptive name, such as "Starting Talent: Enduring" or "Heat Adaptation".

## Not yet reviewed (9 catalogue rows)

| Species | Reason |
|---|---|
| Bith, Kaminoan, Skakoans | Catalogued in *Age of Rebellion - Fully Operational*, which is not in the held library. Rise of the Separatists prints a Kaminoan (pp. 14–15), but that is a different source. |
| Trandoshan | The catalogue cites *Force & Destiny - Core Book* p. 50, which is the Morality table. The species is printed in *Edge of the Empire Core Rulebook* p. 51. The catalogue citation needs correcting before an entry can match. |
| Arkanian, Drall, Gungan, Human - Corellian, Sathari | The catalogue rows have no book or page, so an entry cannot match them. The printed blocks have been located: Drall (*Suns of Fortune* p. 91), Corellian human (*Suns of Fortune* p. 94), Gungan (*Nexus of Power* p. 101) and Sathari (*Chronicles of the Gatekeeper* p. 15). Arkanian is in *Disciples of Harmony*, but the held scan is missing those pages. |

A campaign's owned-book filter controls which species can be chosen. Existing characters keep their recorded source and abilities if the filter later changes.
