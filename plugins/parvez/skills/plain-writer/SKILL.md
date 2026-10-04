---
name: plain-writer
description: House style for any prose that lands in git history or on a reviewer's screen - PR descriptions, commit subjects and bodies, PR comments, code comments, README and docs prose, ticket notes. Enforces ASCII punctuation only, Simplified Technical English (ASD-STE100), no filler, no jargon, and comments that only explain a non-obvious why. Carries a PR-description sub-skill that finds and fills the repo's own PR template section by section. Use BEFORE writing or editing such prose. Triggers on "write the PR description", "fill the PR template", "draft the PR body", "write a commit message", "write this up", "clean up this comment", "make this readable", and on any request to generate text destined for a commit, a PR, a code comment or repo docs.
---

# plain-writer - house style for anything a reviewer will read

Two failures this skill prevents:

1. **Unicode punctuation reaching a pushed commit.** Force-push is often blocked on shared branches, so a
   commit message cannot be fixed after the push. One em-dash costs a follow-up commit and a review thread.
2. **Prose that reads as generated.** Long hedged sentences, filler openings, em-dash asides, invented
   jargon. Reviewers notice a drifting register in a diff at once, and stop trusting the rest.

## Sub-skills

| Task | Read |
|---|---|
| Fill the repo's PR template for a branch | `references/pr-description.md` |
| Commit subject and body | this file, **Commit messages** |
| Code comments | this file, **Code comments** |
| PR comment or reply posted as the user | this file, **Comments posted as the user** |
| Anything else - notes, docs, READMEs | this file |

## Banned characters and replacements

| Banned | Codepoint | Replace with | Reason |
|---|---|---|---|
| `—` em-dash | U+2014 | `-`, `:`, `,` or `.` (recast the sentence) | Cannot be amended after a push when force-push is blocked. |
| `–` en-dash | U+2013 | `-` | Looks like an em-dash to most readers. |
| `→` rightwards arrow | U+2192 | `->` or `to` | Renders differently across tools. |
| `←` leftwards arrow | U+2190 | `<-` or `from` | Same. |
| `↔` left-right arrow | U+2194 | `<->` | Same. |
| `‘` `’` curly single quotes | U+2018, U+2019 | `'` | Turns into garbage in some terminals. |
| `“` `”` curly double quotes | U+201C, U+201D | `"` | Same. |
| `…` horizontal ellipsis | U+2026 | `...` | Diff noise. |
| `•` bullet | U+2022 | `-` or `*` | Markdown has ASCII list markers. |
| `‐` `‑` `‒` other hyphens | U+2010-U+2012 | `-` | Look like a hyphen, are not. |

The table above is the one place these characters may appear, because it has to show them.

Run this check before any prose ships. Empty output is the pass condition:

```bash
LC_ALL=C.UTF-8 grep -nP '[\x{2010}-\x{2015}\x{2018}\x{2019}\x{201C}\x{201D}\x{2022}\x{2026}\x{2190}\x{2192}\x{2194}]' <file>
```

Keep the `LC_ALL=C.UTF-8` prefix. Without it, some shells (Git Bash on Windows, minimal containers) print
`grep: -P supports only unibyte and UTF-8 locales` and the check does nothing. Run the check; do not trust
recall. Generated text leaks these characters often.

## Voice - Simplified Technical English

Write ASD-STE100 style. It makes dense technical text readable for a reviewer whose first language is not
English, and it is faster for everyone else.

- **One idea per sentence.** Split, do not subordinate. "The data path is correct. The importer sets the
  value. The export reads and writes the column."
- **Active voice, present tense.** "The migration adds three rows", not "three rows will have been added".
- **No contractions.** "cannot", "does not", "did not".
- **One meaning per word.** Pick one term for a thing and reuse it. Do not switch between "field",
  "property" and "column" for one concept.
- **No filler openings.** Never "In this PR we...", "This change aims to...". Start on the fact.
- **Name the thing.** The concrete component, file, column or endpoint: `OrderExportService`, not "the
  service".
- **Bold marks the one claim in a section the reader must not miss**, and nothing else. One per section at
  most. Bold on three claims marks none of them.

## Plain words - banned jargon

If a reader has to stop and ask what a word means, the sentence has failed. This applies to prose, to
comments and to identifiers.

Banned, with what to say instead:

| Do not write | Write |
|---|---|
| fail-open / fail-closed | "never throw here, because ..." / "refuse the request when ..." |
| load-bearing | "the code depends on this" / "removing this breaks X" |
| rides / rides alongside | the verb that happens: "the next save writes the row" |
| hop (as in "two hops away") | "two calls away", "the parent's parent" |
| leaf / leaves (tree nodes) | "the last value in the path", "items with no children" |
| blast radius | "what this change can break: ..." |
| choke point | "the one method every request goes through" |
| belt and braces | "a second check, because ..." |
| carve-out | "exception" |
| whack-a-mole | "fixing each case one at a time" |
| first-class | "fully supported", "has its own type" |
| provenance | "where the value comes from" |
| materialise | "create", "load" |
| surface (as a verb) | "show", "return", "report" |

**Never write "X beats Y".** Say which outcome is worse and why. "Partial load beats none" says nothing.
"Some items failed to load. Keep the ones that did, so most of the page still works" says it.

**Say what the code does, in verbs.** Not "the row rides the caller's next save" but "the caller's next
save writes the row".

**Show an example instead of describing a shape.** `// "items[0].name" gives "name"` is clearer than a
sentence about removing parent segments and array indexes.

## Code comments

Default: write the code, no comment.

- Comment only what the code cannot say: a non-obvious why, a rejected alternative that looks correct, a
  trap the next reader would fall into, a rule that another file depends on.
- Never comment what the line already states, a restatement of the method name, a walk through the happy
  path, or an essay that defends a design. Those go in the PR description or the commit body.
- **Hard cap: one or two lines.** A comment longer than the code it guards is a design note in the wrong
  place.
- Do not add a comment to every new block "for consistency". Most edits need zero comments.
- Test files too: one line of why on a strange setup, never a paragraph.
- Write for the person who changes this file next year. They need the trap, not the story of how you
  found it.

**Reach for a name before a comment.** Most comments patch a weak name. Try these first:

- Rename the method or variable to state the intent. `ExcludesArchivedOrders(query)` needs no comment;
  `FilterOrders(query, x)` does.
- Extract the explained expression into a named local or a small private method.
- Let an existing constant, enum member or config key carry the meaning.

Comment only when all three fail. The same plain-words rule applies to names: a name that only makes sense
to someone who just read the neighbouring file is a bad name.

## Commit messages

- **Subject:** short and specific. If the repo prefixes a ticket id, match the existing form
  (`<ticket> : <subject>` or `<ticket> - <subject>`); read `git log --oneline -30` and copy what is there.
  Do not "correct" a form the history already uses.
- **Body:** at most one or two lines, often none. No bullet lists, no paragraphs, no test-result summaries.
- Imperative ("Add X") and descriptive ("Adds X") both occur in real repos. Match the history.
- Commit subjects and PR titles can follow different habits in one repo. Check each separately.

## Comments posted as the user

When the user says a PR comment is theirs ("comment as me", "I ran it and verified it"), write it as a
person would:

- Plain prose in the user's voice. No severity labels, no headings, no bold labels.
- No file paths or line numbers. Name a method or class only when the author needs it to find the code.
- No commit ids or commit messages.
- Short sentences and plain words. State what the user ran, the measured numbers and the result.
- A fix reply says what changed in behaviour, what did not change, and whether tests were added.

## Where this applies

- **Commit subject and body** - strictest. Once pushed, often cannot be amended.
- **PR description and PR comments** - every reviewer reads them.
- **Markdown in the repo** - READMEs, docs, notes folders. Reviewers grep diffs for banned characters.
- **Code comments** - also WHY-only and one or two lines (see **Code comments**).
- **Working notes** an agent writes for itself - text gets copied out of them into PR bodies.

Does not apply to:

- String literals that need exact Unicode. Comment the why.
- Test fixtures that check Unicode handling.
- User-facing UI strings in resource or translation files.

## When editing existing prose

Fix banned characters on any line you touch, even when the fix is not part of your edit. Do not rewrite
lines you did not touch: that hides the real change in a diff nobody can review.

## Common mistakes

| Mistake | Correction |
|---|---|
| Em-dash for an aside | "changes - not in scope", or recast with a comma or a full stop |
| Curly quotes pasted from Word, Notion or a chat client | Type the quotes again |
| Ellipsis from auto-correct | `...` |
| One long sentence that carries two ideas | Split it into two sentences |
| "This PR introduces changes that aim to..." | Delete the opening. State the fact. |
| Bold on three claims in one section | Keep one |
| A template section left as its HTML comment | Fill it, or write why it does not apply |
| A three-line comment that explains what the code does | Delete it, or rename until it is not needed |
