# Third-party notices

## Public-domain interface backdrop

`assets/ui/cassini-saturn-pia08387.jpg` is an unmodified copy of NASA image
PIA08387, *Saturn view from Iapetus*. The natural-colour panorama was assembled
from 15 red, green and blue Cassini wide-angle photographs acquired on
10 September 2007. It depicts Saturn with Dione, Enceladus, Mimas, Rhea,
Tethys and Titan; Earth is not present. No generative AI was used to create or
modify the bundled image.

- Source file: [NASA Image and Video Library](https://images-assets.nasa.gov/image/PIA08387/PIA08387~orig.jpg)
- Catalogue record: [NASA/JPL Photojournal PIA08387](https://photojournal.jpl.nasa.gov/catalog/PIA08387)
- Public-domain record: [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Saturn_view_from_Iapetus.jpg)
- Credit: NASA/JPL/Space Science Institute
- SHA-256: `9313D2D3811DC91B3C5A1B4E07555CFF467482AB2EF166A2B895DFA1DBED515A`

The Commons record identifies the image as public domain in the United States.
NASA's media guidelines state that NASA content generally is not subject to
copyright in the United States, request acknowledgement of NASA as the source,
and prohibit implying NASA endorsement. The image contains no NASA identifier,
logo or person. It is excluded from the project's MIT grant and is distributed
under its own public-domain status and the applicable NASA usage guidelines.

## Narrative dice symbol font

`assets/vendor/starwarsffg/EotESymbol-Regular-PLUS.otf` is copied unchanged from
[StarWarsFoundryVTT/StarWarsFFG](https://github.com/StarWarsFoundryVTT/StarWarsFFG),
commit `1f93677b090d99a2b023fe1788bba39d8a79ac2e`, path
`fonts/EotESymbol-Regular-PLUS.otf`.

The upstream project publishes the MIT license, copyright (c) 2020 Foundry
Network. Its full notice is retained at `assets/vendor/starwarsffg/LICENSE.txt`.
The symbol font has no additional embedded license notice.

`scripts/generate-dice.py` renders these glyphs into the transparent PNG face
textures under `assets/dice/`. Face composition follows Star Wars FFG's independently
implemented mechanical face table. No other system implementation is imported.

Star Wars and associated terminology remain the property of their respective
owners. Upstream attribution does not imply endorsement or an official licence
from Lucasfilm, Fantasy Flight Games, Asmodee or EDGE Studio.

## Interface fonts

The unmodified Roboto and Signika files come from the pinned community repository
commit above; the unmodified Rajdhani files come from Google Fonts. Their own font
licences apply independently of the project's MIT licence. They are served locally;
no font service is contacted.

| Font                      | Source                                            | Copyright                                                                             | Licence retained here                          |
| ------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Roboto Regular            | Community repository `fonts/Roboto-Regular.ttf`  | Font data copyright Google 2011                                                       | Apache 2.0, `assets/vendor/roboto/LICENSE.txt` |
| Signika Regular           | Community repository `fonts/Signika-Regular.ttf` | Copyright (c) 2011 Anna Giedrys (http://ancymonic.com), Reserved Font Names "Signika" | SIL OFL 1.1, `assets/vendor/signika/OFL.txt`   |
| Rajdhani Regular/SemiBold | Google Fonts `ofl/rajdhani`                       | Copyright (c) 2014, Indian Type Foundry (info@indiantypefoundry.com)                  | SIL OFL 1.1, `assets/vendor/rajdhani/OFL.txt`  |

Roboto is used for long-form body text, Signika for sheet headings and the wordmark,
and Rajdhani for Foundry chrome and compact interface headings.
The licence texts are retained from the font projects:
[Roboto](https://github.com/googlefonts/roboto-2/blob/main/LICENSE) and
[Signika](https://github.com/googlefonts/Signika/blob/master/OFL.txt), with Rajdhani
font and licence metadata from [Google Fonts](https://github.com/google/fonts/tree/main/ofl/rajdhani).
The bundled Signika font's original 2011 copyright above remains applicable;
the font project's licence file also identifies its later project authors.

Elektra and Star Jedi are not included. Their presence in a public repository
does not establish redistribution permission for this system.
