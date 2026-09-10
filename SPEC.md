# AgenticProjectKit pre-release completion

## §G

Complete remaining gated-workflow release tasks in dependency-safe order; preserve candidate-bound proof and vendor-neutral adopted-repository contracts.

## §C

- `.tasks/*.md` remains execution contract and scope authority.
- One task active per agent/worktree.
- Use registered owner + canonical `claim`, `verify`, `review`, `gate`, `done` lifecycle.
- No baseline reset, scope expansion, hook/CI result, or stale evidence may launder unrelated changes.
- No dependency addition without `docs/decisions.md` update.
- Target repo quality: detect -> report -> recommend -> explicit opt-in; no silent toolchain mutation.
- AgenticProjectKit-local tooling may use concrete vendors without exporting mandate.
- No publish, deployment, model runtime, CI abstraction, or generic DevOps platform.

## §I

- task: `.tasks/<id>-*.md` -> canonical goal/scope/deps/verification
- cli: `pnpm exec apk task verify <id>` -> revision-bound checks + scope evidence
- cli: `pnpm exec apk task gate <id>` -> read-only completion decision
- cli: `pnpm exec apk quality detect [directory] [--json]` -> deterministic capability result
- scripts: `pnpm typecheck|lint|test|test:coverage|quality|build|release:check`
- ci: `.github/workflows/quality.yml` -> clean-checkout exact-SHA proof
- evidence: `.agentic/evidence.jsonl` -> append-only candidate-bound local records

## §V

V1: task start -> all declared dependencies done.
V2: task proof -> exact owner + baseline + candidate + allowed path attribution; no reset/expansion hides unrelated change.
V3: mutation/evidence lock -> one live owner; confirmed-dead recovery race-safe; unknown/malformed fails closed.
V4: quality capability ID != vendor; detection read-only + conservative + deterministically ordered.
V5: missing optional quality capability -> recommendation; missing required capability -> explicit policy failure.
V6: APK-local lint/coverage/hooks/CI never auto-install into adopted repository.
V7: coverage threshold -> measured baseline + regression protection; no arbitrary 100% target.
V8: hook success -> developer feedback only; never task/release proof.
V9: CI success -> clean-checkout exact-SHA proof only; never replaces APK verify/review/gate evidence.
V10: review run -> at most one terminal result; failed preparation leaves no worker orphan; invalid fixer state yields exact next action.
V11: release PASS -> frozen candidate + current verification/review/live/report evidence; candidate mutation invalidates proof.
V12: required review -> primary may auto-launch separate read-only reviewer; reviewer != implementation owner; findings loop through fix -> verify -> review without routine user confirmation.

## §T

id|status|task|cites
T1|~|finish 0074 via non-laundered verification/review/gate|V1,V2,V11,I.task
T2|x|build 0076 stale lock recovery|V2,V3,I.task,I.evidence
T3|.|build 0077 vendor-neutral quality capability contracts|V4,V5,V6,I.quality
T4|.|build 0078 APK-local quality guardrails|V6,V7,V8,I.scripts
T5|.|build 0079 minimal clean-checkout CI|V6,V8,V9,I.ci
T6|x|build 0080 retained 0073 P2 fixes|V2,V3,V10,I.task,I.evidence
T7|.|run 0075 frozen release validation|V1,V2,V4,V6,V7,V8,V9,V10,V11,I.task,I.quality,I.scripts,I.ci,I.evidence
T8|x|build 0081 automatic independent-review orchestration instruction|V2,V12,I.task

## §B

id|date|cause|fix
