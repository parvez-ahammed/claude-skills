---
name: my-skill-name
description: >-
  One or two sentences: WHAT this skill does AND WHEN it should trigger. This is the
  only signal Claude uses to decide whether to load the skill, so be specific and a
  little pushy. Name the contexts and the kinds of phrases a user would actually type
  ("use this whenever the user wants to X, mentions Y, or is debugging Z - even if
  they don't say 'skill'"). List concrete trigger examples. Avoid vague verbs.
  Keep it under 1,024 characters (portable Agent Skills limit; Claude Code truncates
  description + when_to_use at 1,536 in the skill listing).
# Optional fields (delete what you don't need):
# argument-hint: "[pr-number]"          # shown in the / menu autocomplete
# allowed-tools: Read Grep Glob         # tools usable without a prompt while the skill runs
# disable-model-invocation: true        # only the user can fire it (for side-effecting skills)
# context: fork                         # run in an isolated subagent
---

# Skill title

One paragraph on what this skill is for and the value it delivers (especially any
non-obvious, hard-won knowledge it encodes - that's what makes a skill worth more
than the model improvising).

## When to use / not use

- Use when: ...
- Don't use when: ... (point at the better tool/skill for those cases)

## Workflow

Imperative steps. Explain the WHY behind anything non-obvious - smart models follow
reasoning better than rigid rules.

1. ...
2. ...

## Gotchas

The traps that produce silent failures or "looks fine but isn't" states. This section
is often the real value.

- ...

## Reference map (optional - for larger skills)

- `references/<topic>.md` - read when ...
- `assets/<file>` - copy/adapt for ...
- `scripts/<file>` - run to ...

Reference bundled files as `${CLAUDE_SKILL_DIR}/scripts/<file>` so the path works whether the
skill is installed as a plugin or copied into `~/.claude/skills`. Keep SKILL.md under ~500
lines; move detail into `references/` (one level deep) and say when to read each file.
