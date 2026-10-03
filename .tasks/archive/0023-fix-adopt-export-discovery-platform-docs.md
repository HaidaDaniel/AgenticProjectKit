# Task 0023 - Fix Adopt Export Discovery Platform Docs

State: done
Owner: archive
Mode: mvp
Lane: bugfix
Scope: docs,cli
Risk: medium
Parallel: false
Depends on: none
Tags: fix,adopt,export,discovery,platform,docs

## Goal

Fix 6 documented issues:

1. `apk adopt` не создаёт `docs/decisions.md`, `docs/task-system.md`, `docs/context-system.md`.
2. Экспортируемые agent prompts отстают от нового workflow (нет требований к registered owner, claim/review/done).
3. Discovery docs задокументированы, но `init/adopt` их не создают.
4. `apk agent prompt --platform` принимает любые platform, но `apk prompt` поддерживает только `agents/codex/opencode/cursor`.
5. `docs/architecture.md` описывает `audit` как текущий flow, хотя он planned later.
6. `docs/engineering/tech-stack.md` не соответствует `package.json`.

## Context files

- src/cli/commands/adopt.ts
- src/core/docs/adopt.ts
- src/core/docs/context.ts
- src/core/exporters/index.ts
- src/cli/commands/agent.ts
- src/cli/commands/prompt.ts
- src/core/agents/index.ts
- src/cli/commands/prompt.ts
- docs/architecture.md
- docs/cli-commands.md
- docs/engineering/tech-stack.md
- package.json
- README.md
- src/core/init/index.ts

## Files allowed to edit

- src/cli/commands/adopt.ts
- src/core/docs/adopt.ts
- src/core/exporters/index.ts
- src/core/agents/index.ts
- src/cli/commands/agent.ts
- src/cli/commands/prompt.ts
- src/core/init/index.ts
- docs/architecture.md
- docs/cli-commands.md
- docs/engineering/tech-stack.md
- docs/progress.md
- AGENTS.md

## Files forbidden to edit

- application source files
- unrelated test files

## Steps

1. **Fix adopt incomplete docs (issue 1)**:
   - В `src/core/docs/adopt.ts` добавить создание `docs/decisions.md`, `docs/task-system.md`, `docs/context-system.md`.
   - Скопировать контент из `src/core/init/index.ts` или сгенерировать placeholder.

2. **Fix exported agent prompts outdated (issue 2)**:
   - В `src/core/exporters/index.ts` обновить `DEFAULT_AGENT_POLICY`:
     - Добавить требования к `registered owner` для `doing` и `review` состояний.
     - Указать правила для `claim`, `release`, `block`, `review`, `done`, `cancel` с `--owner`.
     - Добавить упоминание `task state protection via .tasks/.apk.lock`.
   - Обновить `AGENTS.md` вручную или через `apk export --force`.

3. **Fix discovery docs not created (issue 3)**:
   - В `src/core/init/index.ts` добавить создание:
     - `docs/product/requirements.md`
     - `docs/engineering/load-profile.md`
     - `docs/engineering/tech-options.md`
     - `docs/engineering/risk-register.md`
   - В `src/core/docs/adopt.ts` добавить те же файлы.

4. **Fix platform validation (issue 4)**:
   - В `src/cli/commands/agent.ts` или `src/core/agents/index.ts` добавить валидацию platform в `renderAgentSetupPrompt`.
   - Определить допустимые platform: `agents`, `codex`, `opencode`, `cursor`.
   - Бросить ошибку для неподдерживаемых platform.

5. **Fix architecture.md audit description (issue 5)**:
   - В `docs/architecture.md:51` изменить описание `audit` с текущего flow на planned later.
   - Добавить пометку "not implemented" или "planned".

6. **Fix tech-stack.md mismatch (issue 6)**:
   - В `docs/engineering/tech-stack.md` удалить несуществующие зависимости:
     - `@inquirer/prompts`
     - `fs-extra`
     - `zod`
     - `fast-glob`
   - Оставить только то, что есть в `package.json`:
     - `handlebars`
     - `tsx`
     - `typescript`
     - `@types/node`

7. **Update progress and verify**:
   - Обновить `docs/progress.md`.
   - Запустить `pnpm test`.
   - Запустить `pnpm lint`.
   - Проверить `apk init` и `apk adopt` на создание всех файлов.

## Acceptance criteria

- `apk adopt` создаёт полный набор docs включая `decisions.md`, `task-system.md`, `context-system.md`.
- Экспортируемые agent prompts содержат требования к registered owner и claim/review/done workflow.
- `apk init` создаёт discovery planning docs.
- `apk agent prompt --platform` отвергает неподдерживаемые platform.
- `docs/architecture.md` правильно помечает `audit` как planned.
- `docs/engineering/tech-stack.md` соответствует `package.json`.
- Все тесты проходят.
- Type check проходит.

## Verification commands

- pnpm test
- pnpm lint
- pnpm build
- apk init (в temp директории)
- apk adopt (в test директории)
- apk agent prompt --platform claude-code (должна быть ошибка)
- apk agent prompt --platform codex (должна работать)

## Documentation updates

- Update docs/progress.md.
- Update AGENTS.md.

## Notes

- issue 1: см. adopt.ts line 177, context.ts line 33, exporters/index.ts line 106.
- issue 2: см. task-system.md line 43, exporters/index.ts line 123, AGENTS.md line 21.
- issue 3: см. README.md line 311, init/index.ts line 82, adopt.ts line 185.
- issue 4: см. agents/index.ts line 232, prompt.ts line 13.
- issue 5: см. architecture.md line 51, cli-commands.md line 25.
- issue 6: см. tech-stack.md line 8, package.json line 23.
