# conpera-town — agent entrypoint (read in this order)

New here? Top to bottom. Each line says WHY it's here.
1. **CLAUDE-contract.snippet.md** — house rules + what you MUST NOT do (CONTRACT); append into a repo `CLAUDE.md`/`AGENTS.md`.
2. **docs/grounding/code-map.md** — the module map: where everything lives and how it depends.
3. **docs/grounding/invariants.md** — what must always hold (the MUST/NEVER rules, incl. do-not-touch).
4. **docs/grounding/domain/** — glossary, business rules, and the `agent-conversation` flow; read the area you're touching.
5. **docs/grounding/decisions/** — why it's built this way (engine/game split, the economy); don't re-litigate.
6. **docs/grounding/verification.md** — how to prove a change is correct before merging.
7. **docs/runbooks/run-local-dev.md** — how to run, test, and verify this repo locally.
8. **docs/memory/** — lessons & pitfalls (skim as they accumulate).

Current working state → `docs/memory/session_continue.yaml`.
