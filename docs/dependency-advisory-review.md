# Development template compiler advisory review

Resolved 2026-10-12 with TLS verification enabled and the Windows system certificate store. The development compiler is pinned to **Handlebars 4.7.10** in the manifest and lockfile. A fresh `npm audit` reports **zero vulnerabilities**. The earlier 4.7.9 critical advisory family is no longer a pending Beta review gate.

Handlebars is a development dependency for static checks and browser fixtures. The release ZIP contains no npm dependencies or bundled Handlebars compiler; native Foundry supplies its own template engine. This review does not assess or modify Foundry's engine.

| Upstream advisory | Project exposure and mitigation |
| --- | --- |
| [AST type confusion](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-8r5x-fm3f-whwj) | All development compilation reads repository templates as UTF-8 strings. A shared guard now rejects every non-string input before the compiler accesses it; AST input is unsupported. |
| [Own property check bypass](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-p8wg-vrv2-v86f) | Development rendering uses reviewed repository templates and retains default prototype restrictions. No call enables `allowProtoMethodsByDefault`. Regression coverage checks inherited properties remain inaccessible. |
| [Unsafe inline embedding](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-xw65-4hp5-5hc7) | The onboarding and support fixtures serve precompiled templates as separate JavaScript resources, avoiding HTML script-block interpolation. Static precompile checks discard their output. |

Upstream's [4.7.10 release](https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10) identifies the security fixes. The first registry check rejected 4.7.10 with `ETARGET`; a subsequent check of the official npm registry supplied the patched package, which is now installed and locked with its registry integrity hash. No advisory suppression, local version substitution or TLS bypass was used.

The trusted-string guard, default prototype restrictions and separate-script fixtures remain as additional controls. The project does not compile user-supplied template objects, downloaded templates or AI-generated code through these development helpers. Trusted repository templates remain executable input and require ordinary code review. Dependency audit evidence describes the locked development environment at the time checked; it does not assess Foundry's own template engine.
