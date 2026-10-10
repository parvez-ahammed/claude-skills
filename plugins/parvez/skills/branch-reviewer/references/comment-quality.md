# Comment quality - every seat judges the comments in its own files

There is no comment seat: a comment can only be judged next to the code it sits above. Judge every
added or edited comment on three axes.

### 1. Necessity - does this comment earn its line?

Default: write the code, no comment. A comment is justified only when it carries something the code
cannot: a non-obvious **why** or a rejected alternative that looks correct; a **trap** the next reader
would fall into; a **cross-file invariant** the compiler does not enforce.

Flag as `low` / `Nit`, or `med` / `Consider` when the volume is systemic:

| Pattern | Why it fails |
|---|---|
| Restates the member name | The signature already said it |
| Walks the happy path line by line | The code is the walkthrough |
| Defends a design decision at length | Belongs in the PR description or commit body |
| The same two sentences repeated across sibling files | Put it once on the base class or interface |
| Added "for consistency" because neighbours have one | Consistency is not a reason |
| Longer than the code it guards | A design note in the wrong place |

**Reach for a name before a comment.** If a rename, an extracted local or an extracted private
method removes the need, the finding is the weak name. `FoldsIntoModified(profile)` needs no comment;
`ChildAction(profile, x)` does.

The reverse is a more expensive finding: **a deleted comment that carried a safety reason**. When a
diff removes a comment, ask what the next reader loses. A comment that records why an unsafe-looking
choice is safe today, and what would make it unsafe, is the one kind a trimming pass must keep.
Report its removal at `med` / `Required`.

### 2. Language - Simplified Technical English (ASD-STE100)

- Active voice, present tense.
- One idea per sentence. Twenty words or fewer for an instruction, twenty-five for a description.
- One word, one meaning. Do not call one thing a row, a record and an entry in the same file.
- Simple concrete words: "use", not "utilise"; "before", not "prior to".
- No noun stacks longer than three words.
- Keep the articles.
- No metaphor, jokes, slang or idiom. They do not survive translation or a decade.
- Plain ASCII punctuation: no em dash, en dash, curly quote, ellipsis or arrow character.
- No jargon a new team member would have to ask about. Say what the code does, in verbs.

### 3. Structure

- Written for **a maintainer changing this file next year**. They need the trap, not the journey.
- **Hard cap: one or two lines**, except a file-header or class-level contract note.
- Directly above what it explains.
- No AI tells: no "Note that...", no "This is important because...", no numbered narration, no
  restating the ticket.
- No stale comment: if the diff changed the behaviour and left the comment describing the old one,
  that is `med` / `Required`. A wrong comment is worse than none.
- No commented-out code. Git has it.

Applies to test files too. **Group comment findings**: one per file, or one per pattern across files,
with the worst two or three lines cited. If comment volume is the finding, say so as one `med` with
the ratio ("24 comment lines on 96 lines of code") and name which comments to keep.
