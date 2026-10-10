---
name: user-guide-maker
description: >-
  Write a user-facing feature guide for a ticket, issue or pull request as one self-contained HTML
  file in a fixed, print-ready format, check every claim in it against the code with a fresh agent,
  print it to PDF, and attach it to the tracker item (GitHub, Jira, Azure DevOps or other). Use
  whenever the user asks for a "user guide", "feature guide", "guide for this ticket / card / PR",
  "end-user docs for this feature", wants such a guide as HTML or PDF, wants it attached to the
  ticket, or asks to update, re-verify or re-attach a guide after the code changed - even if they do
  not say "skill".
argument-hint: "[ticket-id or PR number]"
---

# User guide maker

One self-contained HTML guide per ticket, written for end users, in one fixed format. Every label,
role, message and limit comes from the code, and a separate agent checks each claim before anyone
sees it. The guide is printed to PDF and attached to the ticket. The value is the format (no design
work per guide) and the claim check (a guide written from notes or memory is wrong in many small
places, and users trust it).

## When to use / not use

- Use when: a feature is built (or nearly built) on a branch and end users need to learn it.
- Don't use when: you need developer docs, API reference or a changelog entry. Don't use for
  screenshot-heavy Markdown help pages either; this format has no screenshots on purpose, so it
  does not go stale every time the UI moves a pixel.

## The format is fixed

Copy `${CLAUDE_SKILL_DIR}/assets/example-guide.html` (fictional product "Acme Tasks"). Keep its CSS, header chips,
"In one line" box, section order, flow diagrams, term list, field/column table, message rows,
limitations, known behaviours, footer and the `@media print` block. Replace only the content.
Do not design a new look and do not ask the user which format to use. Delete a section that does
not apply; do not invent content to fill it. To match a brand, change only the `:root` colour
variables.

Section order: header (product, feature, one-line lede, chips) - "In one line" - when it happens /
when it does not - what it does / requires / does not do - how it works (flow) - terms - how to
open it - who sees what - fields or columns - messages - limitations - known behaviours.

## Workflow

1. **Learn the feature from the code, not from notes.** Work on the ticket's branch (find it with
   `git branch -a --list "*<ticket>*"`; ask before switching). Read `git diff <main>...HEAD`, the
   ticket text and comments, and the PR threads. Copy every label, menu path, role, column, message
   text and limit from the source file. Notes, specs and chat history are hints, never proof.
2. **Write** the guide inside the repo, in a folder the team uses for working files (for example
   `docs/guides/` or a git-ignored working folder such as `.work/<ticket>/`), as `<ticket>-<Feature>-User-Guide.html`. The
   file name becomes the attachment name on the ticket, so never a generic name like `guide.html`.
   - Plain words, short active sentences, ASCII only. If the `plain-writer` skill is installed,
     load it first.
   - Audience is end users: no file names, code, commit or PR history, review findings.
   - Describe *when* something happens in the user's terms first ("when you mark the task Done"),
     then the other triggers, then what does NOT trigger it. Users think in their own actions, not
     in the system events the code is built around.
   - For every state (empty, error, never, hidden, no permission), say what the user sees, with the
     exact text from the code.
3. **Verify with a fresh agent** (the strongest model you have). Brief: treat the guide as a list
   of claims and the code as the truth; give a verdict per claim - CONFIRMED (file:line), WRONG
   (with replacement text) or UNVERIFIABLE - plus behaviour the guide is MISSING and places where
   the guide contradicts itself. The agent that wrote the guide never verifies it.
4. **Apply every fix.** Then grep the guide for each old wrong phrase (a bulk rewrite often leaves
   one copy behind), and check for non-ASCII: `grep -cP '[^\x00-\x7F]' <guide>.html` must print 0.
5. **PDF:** `python "${CLAUDE_SKILL_DIR}/scripts/make_pdf.py" <guide>.html <guide>.pdf` (same base name). Read two or
   three of the preview PNGs it writes. A page flagged `<-- check` usually has a heading left
   alone at the bottom or a card pushed to the next page: adjust `break-inside` / `break-after`
   in the print block and run again. Delete the previews afterwards.
6. **Open** the HTML in a browser for the user to read.
7. **Attach only when asked.** See "Attaching" below. Replace an attachment with the same name
   instead of adding a second copy. An older guide under a different name stays: list it and ask
   before removing it.

## Attaching

Pick the tracker the project uses. All of them: attach both the HTML and the PDF, and post one
short comment that says what the guide covers.

- **Azure DevOps work item:** `python "${CLAUDE_SKILL_DIR}/scripts/attach_azure_devops.py" <id> "<comment>" <html> <pdf>`
  with `ADO_ORG_URL` and `ADO_PROJECT` set; uses `az login`. It replaces same-named attachments and
  refuses a file whose name does not start with `<id>-`.
- **Jira issue:** `curl -u "$JIRA_USER:$JIRA_TOKEN" -H "X-Atlassian-Token: no-check"
  -F "file=@<guide>.pdf" "$JIRA_URL/rest/api/3/issue/<KEY>/attachments"` (once per file). Jira
  keeps same-named files side by side, so delete the old attachment first
  (`DELETE /rest/api/3/attachment/<attachmentId>`, ids from `GET /rest/api/3/issue/<KEY>?fields=attachment`).
- **GitHub issue or PR:** `gh` cannot upload files to a comment. Commit the HTML and PDF to the
  branch (for example `docs/guides/`) and post a link with
  `gh pr comment <n> --body "..."` or `gh issue comment <n> --body "..."`. Ask before committing.
- **Other trackers:** attach by hand or through their API; keep the same file names.

## After code changes

Every change to a label, limit or behaviour on the branch makes the guide stale. Before you
attach again: grep the guide for the old text (old labels, removed messages, removed limits), fix
it, re-run the claim check on the changed parts, print again, attach again. Tell the user that the
copy on the ticket does not update itself.

## Gotchas

| Mistake | Fix |
|---|---|
| New visual design, or asking the user for a format | Copy the example guide |
| Label written from memory or from notes | Copy it from the source file |
| Headline describes a system event the user never sees | Lead with the user's own action |
| Writer checks its own guide | Fresh verifier agent, claim by claim |
| `pdftoppm` / `pdftocairo` not installed | `make_pdf.py` uses PyMuPDF (`pip install pymupdf`) |
| Chrome not on the default path | Set `CHROME_PATH` (Edge works too) |
| Chrome drops backgrounds or splits cards | Keep the `@media print` block from the example |
| Half-empty page before a two-column block | Chrome does not split a tall grid row, so the print block stacks `.grid-2`. Never put `break-inside: avoid` on a tall container |
| Second copy attached next to the old one | Replace by name (the Azure DevOps script does it; delete first on Jira) |
| Guide still shows a removed message or limit | Grep for the old text after every code change |

## Reference map

Paths are relative to this skill's folder (`${CLAUDE_SKILL_DIR}`).


- `assets/example-guide.html` - the format to copy (fictional example).
- `scripts/make_pdf.py` - HTML to PDF with headless Chrome or Edge, page-fill report, PNG previews.
- `scripts/attach_azure_devops.py` - attach to an Azure DevOps work item, replacing by name.
