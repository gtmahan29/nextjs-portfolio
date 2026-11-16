# Agent instructions

## Validation

- Do not run `npm run build` or any equivalent production build command unless the user explicitly requests a build. This applies to every agent working in this repository.
- To check TypeScript errors, run `npx tsc --noEmit`. Do not use a production build as a validation shortcut.

## graphify

- When the user types `/graphify`, invoke the graphify skill at `~/.Codex/skills/graphify/SKILL.md` before doing anything else.
