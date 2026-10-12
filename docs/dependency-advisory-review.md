# Development template compiler advisory review

Checked 2026-10-12 with TLS verification enabled and the Windows system certificate store. `npm audit` reports one critical dependency family for the locked **Handlebars 4.7.9**, covering three advisories. This is not a zero-advisory result.

Handlebars is a development dependency for static checks and browser fixtures. The release ZIP contains no npm dependencies or bundled Handlebars compiler; native Foundry supplies its own template engine. This review does not assess or modify Foundry's engine.

| Upstream advisory | Project exposure and mitigation |
| --- | --- |
| [AST type confusion](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-8r5x-fm3f-whwj) | All development compilation reads repository templates as UTF-8 strings. A shared guard now rejects every non-string input before the compiler accesses it; AST input is unsupported. |
| [Own property check bypass](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-p8wg-vrv2-v86f) | Development rendering uses reviewed repository templates and retains default prototype restrictions. No call enables `allowProtoMethodsByDefault`. Regression coverage checks inherited properties remain inaccessible. |
| [Unsafe inline embedding](https://github.com/handlebars-lang/handlebars.js/security/advisories/GHSA-xw65-4hp5-5hc7) | The onboarding and support fixtures serve precompiled templates as separate JavaScript resources, avoiding HTML script-block interpolation. Static precompile checks discard their output. |

Upstream's [4.7.10 release](https://github.com/handlebars-lang/handlebars.js/releases/tag/v4.7.10) identifies fixes. The configured official npm registry returned 4.7.9 as latest and rejected an explicit 4.7.10 installation with `ETARGET`; no upgrade was applied. Do not falsify the version, disable TLS verification, suppress the advisory, or describe the mitigation as an upstream patch.

The submitting maintainer must review this scoped exposure and the residual advisory before accepting the Alpha release. Retry the supported npm patch and rerun checks when it is available. The project does not compile user-supplied template objects, downloaded templates or AI-generated code through these development helpers. Trusted repository templates remain executable input and require ordinary code review.
