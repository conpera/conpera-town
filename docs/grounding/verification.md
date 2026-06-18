---
grounding_kind: verification
status: reviewed
last_verified: "2026-06-18"
source_anchors:
  - path: package.json
  - path: convex/util/geometry.test.ts
  - path: convex/engine/historicalObject.test.ts
  - path: src/editor/le.js
  - path: src/editor/mapfile.js
    symbol: generate_level_file
owners: [conpera-town-maintainers]
---

# Verification Standard

The single answer to "how does anyone — human or AI — prove a change in this repo is
correct?" Before merging, the author MUST walk the relevant per-change-type checklist,
run the listed commands, and confirm no invariant in `invariants.md` is broken.

This is a Convex + Vite/React project; there is no `make`. All commands are the
`package.json` scripts run with `npm run <script>`. The test suite is Jest over the
dependency-free utility/engine modules (Convex functions are not unit-tested here);
type-safety and lint are the primary gates for the rest.

## 1. Test map

| Area (what is covered)                       | Covering tests / files                                                                          | Command to run                       | Related invariants |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------ |
| Geometry / pathfinding math                  | `convex/util/geometry.test.ts`, `convex/util/minheap.test.ts`                                   | `npm test`                           | —                  |
| State compression (FastIntegerCompression)   | `convex/util/compression.test.ts`, `convex/util/types.test.ts`, `convex/util/asyncMap.test.ts`  | `npm test`                           | INV-003            |
| Engine historical-object interpolation       | `convex/engine/historicalObject.test.ts`                                                         | `npm test`                           | INV-003            |
| Whole codebase: types + bundle               | `tsc` over `convex/` and `src/` (via `npm run build`)                                            | `npm run build`                      | INV-001, INV-002, INV-004 |
| Lint                                          | ESLint over the repo (`.eslintrc.js`)                                                            | `npm run lint`                       | INV-001, INV-002   |
| Level editor (map / sprite authoring tools)  | `src/editor/le.js`, `src/editor/se.js`, `src/editor/mapfile.js`, `src/editor/leconvex.js` — **no automated tests; verified by running the tool** (see code-map.md §7) | `npm run le` / `npm run se` (manual) | INV-001            |

The level editor under `src/editor/` is a separate Vite app and is **not part of `npm run
build` and has no Jest tests**; it is verified by launching it and exercising the
edit/save/export path manually (see §2e). The rest of the test suite (`npm run build`,
`npm test`) does not cover it, so a green build does not imply the editor still works.

The Jest suite runs with `NODE_OPTIONS=--experimental-vm-modules` (already set in the
`test` script); run a single file with `npm test -- convex/util/geometry.test.ts`.

## 2. Per-change-type checklists

### 2a. Feature (new behavior)
- [ ] If the feature touches a tested util/engine module, add a test that fails without the change and passes with it.
- [ ] `npm test` green; `npm run build` (i.e. `tsc && vite build`) passes with no type errors.
- [ ] Re-read `invariants.md`; confirm no architecture / do-not-touch invariant is crossed (especially INV-001 engine isolation and INV-006 agent-ops-via-inputs).
- [ ] If you added a player/world field, it is `v.optional` and old worlds still load (INV-004).
- [ ] Updated affected grounding docs (`code-map.md`, this file) and bumped their `last_verified`; added an ADR under `decisions/` for any notable decision.

### 2b. Bugfix
- [ ] Added a regression test in the relevant `convex/**/*.test.ts` (red before, green after) when the bug is in a tested module.
- [ ] Confirmed the fix does not weaken the invariant guarding the area (cite the `INV-NNN`).
- [ ] `npm test` and `npm run build` green.

### 2c. Refactor (no intended behavior change)
- [ ] No seam changed: input names/validators, serialized field shapes, and the engine save protocol are unchanged (see `code-map.md` §3).
- [ ] Existing tests pass unchanged — do not edit tests to make a refactor pass.
- [ ] Dependency-direction rules in `code-map.md` §5 still hold (INV-001, INV-002).

### 2d. Dependency bump
- [ ] `package-lock.json` updated and committed; `npm ci` reproduces from clean.
- [ ] `npm run build` and `npm test` green.
- [ ] Reviewed the dependency changelog for breaking changes (notably `convex`, `pixi.js`, `@pixi/react`).

### 2e. Level-editor change (`src/editor/`)
There are no automated tests and the editor is excluded from `npm run build`, so this path
is verified by **running the tool** (see `code-map.md` §7).
- [ ] Launch the affected tool: `npm run le` (map editor) and/or `npm run se` (sprite editor); it loads with no console errors.
- [ ] Exercise the changed path end-to-end: place/delete tiles, then `s` to export a map composite file (or save a scene), and confirm the output is well-formed (`generate_level_file` in `src/editor/mapfile.js`).
- [ ] If you touched the Convex path (`src/editor/leconvex.js`), regenerate the API (`convex dev`) and confirm list/load/save scene still resolve against `convex/_generated/api` (a stale generated API silently breaks these calls).
- [ ] No game-side files (`convex/`, `src/components/`, `src/hooks/`) were changed by an editor-only change; editor output reaches the game only as committed map composite files / scene rows, never by importing the engine (keeps INV-001 intact).

## 3. Regression signals

- **Engine determinism:** the historical-object interpolation and compression tests must
  stay green; a diff there means saved world history may decode differently (INV-003).
- **Type/lint gates:** `npm run build` and `npm run lint` are the main guard for the
  Convex functions and React client, which have no unit tests. A new `import` into
  `convex/engine/` or `convex/util/llm.ts` is an immediate red flag (INV-001, INV-002).
- **World load:** loading a pre-existing world after a schema change must not throw a
  validator error — proves serialized fields stayed backward-compatible (INV-004).

## 4. Done means

The matching §2 checklist is fully ticked, `npm test` and `npm run build` pass, `npm run
lint` is clean, the §3 signals are clear, and no `INV-NNN` referenced here is violated.
If you cannot satisfy an invariant, stop and open an ADR proposing to change it.
