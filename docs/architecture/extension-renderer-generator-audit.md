# Extension renderer generator audit

## Scope and conclusion

This audit covers the renderer and core package entry points and production module graph, the renderer testing fixture and parity test, the committed global artifact, stale-artifact verification, extension validation, and the root scripts. The Phase 0.85 generator was **not a sufficiently reliable module build**: it used a regular expression over TypeScript text to discover dependencies and another regular expression over emitted JavaScript to rewrite `require` calls. It happened to work for the current formatting and imports, but its dependency discovery and rewriting could disagree.

The hardened generator still uses the repository's installed TypeScript compiler rather than adding a bundler. It now lets TypeScript erase types and lower ES modules to CommonJS, parses that emitted JavaScript into a TypeScript AST, discovers the actual emitted static `require("...")` calls, and rewrites their string-literal arguments with an AST transform. The same runtime edges drive recursive graph collection. This makes emitted behavior, not a separate source-text guess, authoritative.

## How the previous generator worked

1. It began only at `packages/plant-renderer/src/index.ts` and read that file as text.
2. A source-text regular expression matched strings following `from` or bare `import`, treating every match as a dependency. Package imports were mapped with a two-entry hard-coded alias table; relative paths were joined textually.
3. It transpiled each source independently to ES2022 CommonJS with `typescript.transpileModule`.
4. A second regular expression rewrote double-quoted `require(...)` calls in the emitted text to graph IDs.
5. It inserted the current module into a map before recursively collecting the dependencies found in step 2. It did not concatenate raw TypeScript, but it did concatenate independently emitted JavaScript module factories into one object. Factories were sorted lexically by ID, and a small synchronous CommonJS loader supplied execution order and cycles.
6. It explicitly required renderer and core entries, copied a fixed public API to `globalThis.PlantCompanionRenderer`, and wrapped everything in an IIFE.
7. `--verify` generated the expected string in memory and compared it byte-for-byte with the committed artifact.

## Findings and answers

1. **Parse or heuristic transform?** Previously, module discovery and `require` rewriting were regex heuristics; only TypeScript-to-JavaScript lowering used a parser/compiler. Now runtime edges and rewrites use the TypeScript compiler and AST.
2. **Does it concatenate files?** It never directly concatenated TypeScript declarations into one scope. It did, and still does, assemble separately compiled modules as isolated factory functions in one classic-script artifact. This is safe module packaging rather than source concatenation.
3. **Dependency order?** Previously recursion collected dependencies but final factories were lexically sorted, not topologically sorted. Runtime `require` determined evaluation order, so factory order was immaterial. That remains true; deterministic lexical sorting uses an explicit `en` locale.
4. **Runtime imports?** Previously a source regex found both runtime and type imports without knowing which would emit. Now only static string-literal `require` calls actually emitted by TypeScript become runtime graph edges.
5. **Type-only imports/exports?** Previously they were unnecessarily traversed and compiled even though TypeScript erased their `require`. Now they emit no runtime edge and are omitted. A regression test covers both type-only imports and exports plus mixed imports.
6. **Renamed imports?** TypeScript's CommonJS transform preserves binding semantics; graph discovery is independent of local/exported names. A regression test covers a renamed import.
7. **Re-exports?** Previously `export ... from` was usually found by the broad `from` regex, but correctness depended on its text shape. Now runtime re-exports are discovered from TypeScript's emitted `require`, while type-only re-exports disappear. A regression test covers both.
8. **Additional source files?** Any production file reachable through a supported package or relative runtime import is recursively included; no file list or dependency order needs updating. Extensionless `.ts`/`.tsx` and directory `index.ts`/`index.tsx` resolution are supported. Unreachable files are intentionally excluded.
9. **Tests and fixtures?** Previously they were excluded only because the entry graph did not reference them, so an accidental production import would include one. Now module IDs under test/testing/fixture directories or with test/spec/fixture filename suffixes fail the build. The testing subpath is not an entry.
10. **`plant-core` dependencies?** `@plant/plant-core` resolves to its package entry. Runtime re-exports in that entry lead the graph to the precise core production modules needed by the renderer/global core API. Relative core imports are recursively followed; type-only edges are not.
11. **Formatting or regex dependency?** Previous dependency and rewrite correctness depended on regexes and emitted quote shape. Current graph construction and rewriting do not depend on whitespace, line wrapping, semicolons, comments, or quote style. The only regex left in graph policy classifies normalized module IDs as forbidden test/fixture paths; it does not parse source.
12. **Can source order break it?** Reordering import/export declarations or source files cannot break graph collection. CommonJS evaluation follows `require`; the loader caches a module before execution to support cycles. As with ordinary CommonJS, changing initialization order inside a genuine cycle can still change application semantics.
13. **Can a new import silently be omitted?** A static ES runtime import/re-export lowered to a string-literal `require` cannot be omitted because emitted calls define the graph. Unsupported bare packages and unresolved relatives fail. Non-literal dynamic loading is outside this deliberately static browser bundle contract rather than silently guessed.
14. **Can a fixture enter production?** Not through a recognized testing/fixture path or suffix: the generator fails. An arbitrarily named production-path module containing fixture-like data cannot be identified semantically, so review remains necessary.
15. **Cross-OS determinism?** Inputs normalize CRLF/CR to LF, TypeScript and its printer are configured for LF, graph IDs use POSIX paths, dependencies and factories are sorted, and output uses fixed newlines. Given the locked TypeScript version and identical source, output is byte deterministic across supported operating systems.
16. **Node APIs at runtime?** The artifact's loader uses only standard ECMAScript and `globalThis`. Bare imports other than the two browser-safe workspace package entries fail, so `node:` and third-party/Node-only packages cannot enter. Node APIs are used only by the build script.
17. **Classic script?** Yes. TypeScript emits CommonJS inside an IIFE; all emitted package requires are rewritten to internal IDs. Extension validation and generator tests reject top-level ESM syntax, execute the artifact in a VM without Node globals, and verify that the global API appears.

## Package graph and public boundary

The renderer production entry imports runtime `isPlantStateSnapshot`, `plantTypeDefinitions`, and `rendererVersion` from `@plant/plant-core`; `PlantStateSnapshot` is type-only. The core entry re-exports its schema, type definitions, weather schema, versions, and serialization modules. Because the extension global also exposes core validation, normalization, and version values, the generated graph legitimately includes the runtime core modules reachable from that entry. Renderer tests and `src/testing/fixture.ts` remain outside the graph.

The global export list remains explicit. Adding an internal source module needs no generator change, while intentionally expanding `PlantCompanionRenderer` still requires an explicit public-boundary decision in the generator.

## Verification layers

- `npm run build:extension-renderer` regenerates the committed classic artifact.
- `npm run verify:extension-renderer` performs a byte-for-byte stale check.
- Generator regression tests cover formatting independence, renamed imports, runtime and type-only re-exports, type erasure, extensionless resolution, forbidden dependencies/fixtures, deterministic generation, absence of unresolved external requires, and execution without Node globals.
- Renderer parity tests compare compatibility results, render models, and SVG strings from the package and generated global using a deterministic fixture, and ensure that fixture is not publicly exposed.
- Extension validation confirms manifest/HTML references and load order, artifact presence/header, and absence of top-level ESM syntax.

## Deliberate limits

This is a small static module packager, not a general npm bundler. Only the renderer/core workspace entries and relative production modules are accepted. Runtime-computed import specifiers, arbitrary external packages, JSON/CSS/assets, CommonJS authored with computed `require`, and Node built-ins are unsupported and should remain build errors or require an intentional generator change. These constraints match the current Manifest V3 classic-script target and prevent accidental expansion of its runtime surface.
