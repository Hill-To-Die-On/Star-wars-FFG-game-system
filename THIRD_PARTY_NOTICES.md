# Third-party notices

## Public-domain interface backdrop

`assets/ui/saturn-enceladus-concept.webp` is a lossless WebP transcode of
NASA's *Saturn Through the Veil of Enceladus – Artist's Concept*. NASA credits
the work to named human artist Dan Gallagher (eMITS). The transcode retains the
source PNG's 4800 × 2160 dimensions and RGB pixel values exactly. It depicts
Saturn beyond Enceladus's south-polar geysers, with Titan and Rhea in the
distance; Earth is not present. The source provenance does not identify any use
of generative AI.

- Lossless source file: [NASA SVS PNG](https://svs.gsfc.nasa.gov/vis/a010000/a014100/a014162/SaturnMoonsConceptArt.png)
- Catalogue and credit record: [NASA SVS item 14162](https://svs.gsfc.nasa.gov/14162)
- Public-domain policy: [NASA SVS help](https://svs.gsfc.nasa.gov/help/)
- Credit: NASA's Goddard Space Flight Center; art by Dan Gallagher (eMITS)
- Source PNG SHA-256: `13849E687C80EFDBF7C980EFAB0D54D0D88C4701740283ECA24BB9E0AA976422`
- Bundled WebP SHA-256: `D20F953A162694D91BDBD5BE034C61E5A19D62DA75D79AA03EED62D110519337`

NASA SVS states that its content is public domain unless otherwise noted and
requests acknowledgement of NASA as the source. The image contains no NASA
identifier, logo or person. It is excluded from the project's MIT grant and is
distributed under its own public-domain status and the applicable NASA usage
guidelines.

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
