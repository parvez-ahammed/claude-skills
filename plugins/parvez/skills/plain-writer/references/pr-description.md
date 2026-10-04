# PR description - fill the repo's own template

Read `../SKILL.md` first for voice, plain words and banned characters. This file covers the template.

## 1. Find the template

Use the repo's template, not a generic one. Look in this order and take the first hit:

| Host | Paths to check |
|---|---|
| GitHub | `.github/pull_request_template.md`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/PULL_REQUEST_TEMPLATE/*.md`, `pull_request_template.md` at the root, `docs/pull_request_template.md` |
| Azure DevOps | `.azuredevops/pull_request_template.md`, `.vsts/pull_request_template.md`, `docs/pull_request_template.md`, `pull_request_template.md` at the root; branch-specific ones under `.../pull_request_template/branches/<branch>.md` |
| GitLab | `.gitlab/merge_request_templates/*.md` |
| Bitbucket / other | `docs/`, the repo root, `CONTRIBUTING.md` (a "Pull requests" section) |

A quick search when none of those exist:

```bash
git ls-files | grep -iE '(pull_request|merge_request|pr)_?template'
```

If there are several templates (a folder of them), pick the one that matches the change (bug, feature,
release) or ask. If there is no template, use the fallback shape in section 5.

Keep the template's headings, order and checkboxes exactly. Strip every `<!-- ... -->` guidance comment
as you fill it. The posted body carries no HTML comments.

## 2. Gather the facts before you write

```bash
git log --oneline <base>..HEAD
git diff <base>...HEAD --stat
git diff <base>...HEAD
```

Also read the ticket or issue text if the user has it. Every sentence in the description must trace back
to the diff, the ticket, or something the user told you. If a section needs a fact you do not have (test
counts, who approved a decision), ask. Do not invent numbers, and do not run long builds or test suites to
get them unless the user asks - the user usually has the figures from their IDE or CI.

## 3. Ground rules

| Rule | Why |
|---|---|
| **Measure the length.** Hosts have hard caps: Azure DevOps refuses a description over 4,000 characters (HTTP 400); GitHub allows about 65,000. Under a 4,000 cap, aim for 2,800-3,500 and treat 3,900 as the ceiling so a CRLF round trip cannot push it over. | A cap is a rejected API call, not a style issue. Measure: `python3 -c "import io;print(len(io.open(r'<file>',encoding='utf-8').read()))"` |
| No section left empty. Where a section does not apply, write the fact: `None.` / `Not relevant.` | An empty section reads as "forgot", a `None.` reads as "checked". |
| Checkboxes stay `- [ ]` unless the template says otherwise. | The author ticks them, not the agent. |
| Title: match the repo's PR title habit (check recent merged PRs). | It can differ from the commit subject form. |
| Save the draft to a file (for example `notes/<ticket>/PR-DESCRIPTION.md`, or where the user keeps notes) before posting. | The user can review and the text survives a failed API call. |

## 4. How to fill common sections

Template headings differ between repos. Map each heading to the closest guide below.

### Summary / Description / What and why

Two to four short paragraphs. Open on the user-visible fact, never on the change.

> Users cannot select **Duration Hours** when they build an export template. Thus they send the value as
> a custom field.

Then the mechanism, one idea per sentence:

> The data path is correct. The importer sets the value. The exporter reads and writes the column. But
> the field is not in the list that users can select. The wizard builds this list from the `fields` table.

For a feature, lead with what the user can now do, then how it is gated, then what moved. Name pure
refactors so a reviewer knows which files to skim:

> To allow reuse, the file dialogs and the `useFileActions` hook moved to `shared/file-actions`
> (moves only, no changes).

Use a table for three or more parallel items, such as new fields with their types.

### Root cause / Bug history (bugs only)

When the defect entered and why it survived. Delete the section for a feature.

> This never worked. The three rows were not in the first seed data. The properties exist in the model
> and in the importers, but the rows are not in the table.

### Impact / Affected areas / Components

Concrete modules, services, screens, with identifiers in backticks. Add a scope qualifier when the change
reaches less than the list suggests: "file-based importers only; the sync path does not change".

**Follow the data, not the changed paths.** When the change alters a value that one side produces, list
every consumer that reads it too. Missing the readers is the most common gap in this section.

### Database / Migration changes

`None.` when there are none. Otherwise state the migration, then the one thing a reviewer would get wrong.
This section often carries the bold claim:

> **The new ids are 54, 55 and 56, not 51-53. This is on purpose.** The seed data stops at 50, so 51
> looks free. But an older migration added three rows with raw SQL and did not update the seed data.

Also state what the migration does **not** do, because a reviewer will assume the worst:

> The migration only adds a new option. It does not add the field to any existing configuration.

### Backward compatibility / Breaking changes

Never a formality when clients, mobile apps or other services deploy separately and can run an older
build. Give the claim, then the conditions that make it true:

> **Data that moves between systems does not change.** Three conditions apply:
> - The code holds the mapping. A new row cannot change it.
> - A sync sends the values that the configuration maps. It does not read this table.
> - Each saved template holds its own column list. Old templates keep working.

For an API change, name the default that keeps old callers working:

> The new query parameter defaults to `false`; existing callers see no change.

Add a `Release note:` line for each change an existing user or an old client can see.

### Alternatives considered

One line per rejected option, with the reason it lost. Reject on evidence, not taste:

> - **Reuse ids 51-53.** Other rows hold these ids in every real database.
> - **Add the rows with raw SQL.** That caused the bug. The migration uses seed data, so code and database agree.

### Edge cases

Bullets. Cases the reviewer would otherwise have to find, including deliberate non-behaviours:

> - Templates created before this change keep their columns. No update prompt is shown.

### Testing / How to test

Verified items as checkboxes, one per claim, with real numbers:

> - [ ] `Orders.Tests`: 1,557 tests pass.
> - [ ] Manual: exported a template with the new field and imported it again; values match.

**A "Not tested" or "Unable to verify" list earns the reviewer's trust. Add one even when the template has
no heading for it, never leave it empty, and never soften it:**

> - The end-to-end browser tests did not run. They need environment credentials.
> - The migration was not tested on a database that already holds the raw-SQL rows.

### Reviewers / Related work

Leave reviewer placeholders for the author unless the user named someone. Link the ticket.

## 5. Fallback shape when the repo has no template

```markdown
## Summary
## Why
## Changes
## Database / migrations
## Backward compatibility
## Edge cases
## Testing
- [ ] ...
### Not tested
- ...
```

## 6. Keep it true

A description that no longer matches the code is the most common review complaint. On every draft, and on
every push after the PR exists:

- Compare `git diff <last-described-commit>..HEAD --stat` with the summary, the impact list, the database
  section and the compatibility section. A new migration, DTO field, frontend file or changed default
  makes one of them false. Update it.
- Each behaviour change to code that existed before this PR is in Edge cases, also when it looks safe.
- Each decision that differs from the ticket names who decided it and links where. No decision on
  record? Ask before the PR opens.

## 7. Before handing it over

1. Run the banned-character grep from `../SKILL.md` (with the `LC_ALL=C.UTF-8` prefix). Empty output.
2. No `<!-- -->` comments survive.
3. No section is empty. `None.` counts as filled.
4. No contractions outside text the template itself supplies.
5. Length measured, not estimated, and under the host's cap. To cut, shorten the impact list and the
   summary first; never cut the "Not tested" list.
6. Checkboxes unchecked.
7. Every identifier in backticks, and every behaviour claim traceable to a file the reviewer can open.

Creating the PR itself (CLI or API call) is a separate step. Use the host's tool (`gh pr create`,
`az repos pr create`, `glab mr create`) and pass this file as the body.
