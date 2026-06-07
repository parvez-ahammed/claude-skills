---
name: my-skill-name
description: >-
  One or two sentences: WHAT this skill does AND WHEN it should trigger. This is the
  only signal Claude uses to decide whether to load the skill, so be specific and a
  little pushy. Name the contexts and the kinds of phrases a user would actually type
  ("use this whenever the user wants to X, mentions Y, or is debugging Z - even if
  they don't say 'skill'"). List concrete trigger examples. Avoid vague verbs.
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
