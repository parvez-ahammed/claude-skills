# Commenting on a pull request

Loaded in **comment** or **comment-only** mode. It is not a separate skill: commenting is the last step
of a review, not an errand of its own.

Where the findings come from:

- **comment** - the seats just ran. Use the merged punch list, `high` and `med` only, each already
  through the verify pass and the adversarial pass. You are translating findings you already hold.
- **comment-only** - no seats ran. The user handed you findings or pointed at an existing report. Every
  claim still passes the verification gate below. Findings that arrive pre-written are exactly the ones
  nobody re-checked.

Posting a review comment is a social act, not only an API call. A wrong comment costs the author time
and costs you credibility for the next twenty. A correct comment that reads as an accusation makes the
author defensive and the fix slower. This reference makes both failures hard.

Two rules carry the whole thing:

1. **Nothing gets posted that a fresh agent could not re-verify from source.** Not "it looks like", not
   "I believe". If the verifier cannot trace it, it does not go up.
2. **Ask, do not tell.** The author knows things you do not. A question invites the answer; a verdict
   invites an argument.

And one principle over both: **a claim that survived verification can still be false.** The gate
lowers the error rate; it does not make the verifier an authority. When a posted claim is challenged,
re-read the source, not the verifier's report.

## Format

Every comment posted by an agent uses this exact three-line shape, so the author can tell at a glance
that a machine wrote it and how much weight to give it:

```
Commentator : Claude
Severity : Med
Concern : <the concern, one or two sentences>
```

Mechanics that bite:

- Markdown renderers may collapse plain newlines into one paragraph. End the first two lines with **two
  trailing spaces** to force the break; that works on GitHub, Azure DevOps and GitLab.
- `Commentator` is always `Claude` (or the agent's name). Never sign with the reviewer's name. The author
  must be able to tell an agent comment from a human one, because the trust level differs. If the user
  says the comment is theirs, do not use this block: see **Posting as the user**.
- `Severity` is `High`, `Med` or `Low` and reports **impact**: High is a correctness, data-loss, security
  or contract break; Med is a divergence, a missed read site, a rule that no longer holds; Low is
  hygiene. Confidence is not in the comment - the gate decides whether it is posted, not how it is
  labelled.

## Posting as the user

When the user says the comment is theirs ("comment as me", "I ran and verified it"), it is a human
comment and must read like one:

- Plain prose in the user's voice. No `Commentator` / `Severity` / `Concern` lines, no headings, no bold
  labels.
- No `file:line`. Name a method or class only when the author needs it to find the code.
- No commit ids or commit messages; the PR already lists the commits.
- Plain words, short sentences. Give measured facts from the user's own run: what was run, the numbers,
  the result.
- A fix reply says what changed in behaviour, what did not, and whether tests were added. Nothing else.

Example:

> The sync step reads the projects with LoadProjectsWithFieldsAsync. That call also loads the custom
> fields of every project, and the sync does not use them. On a source with about 1,500 projects this
> step took about 3 minutes. LoadProjectsAsync returns the same projects without the fields in 17
> seconds, so the sync can use it.

> The sync now uses LoadProjectsAsync. Other sources are not changed. The matched projects are the same
> as before. I added two tests for it.

The verification gate still applies: the user's name on a wrong comment costs more than an agent label.

## Confidence gate: 90% or it does not go up

The cost of a wrong comment is not symmetric. A missed finding costs one bug; a false positive costs the
author's time and the credibility of every comment after it.

**Post only what you are more than 90% sure is a real problem. Everything else is held, not softened.**

- **Assess confidence after the verification gate, never before.** A finding relayed from a seat is
  second-hand however well written, and second-hand tops out around 85%. The gate converts it. Do not
  cut the list on pre-gate numbers - that discards the strongest findings for the weakest reason.
- A `CONFIRMED` verdict with every step cited clears the bar. `UNPROVEN` and `REFUTED` never do.
- Do not rescue a sub-90% finding by rewording it as a vague question. "Am I reading this right
  that..." on a claim you cannot trace is still a false positive; it makes the author do the tracing.
- Hold, do not delete. Report held findings to the user with the one step that was missing.
- Never state the percentage in the comment; it invites an argument about the number.
- `Concern` carries the whole body. No extra headings, bullet lists, `Issue:/Fix:` scaffolding, or code
  fences unless a symbol needs one.

## Voice inside `Concern`

Two shapes, and the choice is not stylistic:

- **Traced finding: state it.** If you followed every step and can cite them, write an observation and
  name the trace. A question mark on a settled fact reads as false modesty and invites an argument.
- **Intent question: ask it.** If the author may know a constraint you do not, or the finding turns on
  what they meant, end with a question mark.

**Having traced it does not settle which shape to use.** A fully verified mechanism can still rest on a
judgement that belongs to the author. Apply the test to the *judgement*:

> Could the author reasonably answer "yes, deliberately, because X"?

If yes, it is a question however completely you traced the code. Usually yes when:

- The behaviour is a **scope limit**: the author solved half the problem on purpose (blanking a value
  instead of keeping it, handling one side of a symmetric pair, shipping a warning instead of a fix).
- The PR already **admits a known gap** elsewhere - evidence of deliberate partial delivery.
- The finding is really a **product decision**: which of two defensible behaviours is right, how
  something is counted, what a field means.

Usually no, so state it: the behaviour contradicts what the code does elsewhere for the same rule; an
existing protection is bypassed; data is written to the wrong place.

The shapes combine: one sentence stating what the code does, then one short question about the intent.
That is usually the most useful comment you can write.

The terseness to imitate:

> This effect also turns on "only mapped fields" for normal agreements. After the next save, the job
> stops writing core fields that are not mapped. Should the default apply only to the new receiver type?

> Should the TODO comments above be updated now?

One line. One thing. No praise sandwich, no paragraph of justification.

**Short is good. Vague is not.** A question names the input and the wrong result, or the rule it breaks,
and the decision the author must make. "Is this intentional?", "Should this be a util?" or "Should this
be its own component?" with no risk stated mostly gets "yes" and changes nothing.

| Instead of | Write |
|---|---|
| "This is a critical bug that will cause the notification to never fire." | `Concern : FailureReason is set on the domain event but is not on StatusUpdateDto, so the mapping drops it.` |
| "You must add the new codes to the resolver factory." | `Concern : Do the two new event codes need adding to RecipientResolverFactory too? The UploadFailed codes are in there.` |
| "The seed ids collide, this will crash on startup." | `Concern : Id = 64 is already used on main for the approval template.` |
| "This violates acceptance criterion 3." | `Concern : For the manual re-run in the ticket, does this path still get scheduled once the veto is set?` |

**Rules for the `Concern` body:**

- One or two sentences. If it needs three, it needs a conversation.
- Name the specific symbol (`FailureReason`, `Id = 64`). The thread already carries `file:line`.
- Say what you looked at when it helps the author check you ("I could not find it in X"). It makes the
  claim falsifiable.
- No severity words in the body (critical, blocker, must, fails). The `Severity` line said it.
- No preamble ("Great work overall, just one thing").
- **Plain words only.** It must make sense to someone who did not read the diff. Words that have shown
  up in agent drafts and read as jargon: *mint*, *yield*, *carry out*, *surface* (as a verb), *hydrate*,
  *spine*, *blast radius*, *sargable*. Say what happens: "creates", "returns", "sends", "shows".
- ASCII punctuation only. No em dashes, curly quotes or arrows.

## Is it worth a comment at all? (hard gate)

Stronger than the confidence gate and runs after it. Confidence decides whether a claim is *true
enough*; this decides whether it is *worth* posting. Most drafts die here, and that is intended.

A comment must pass **all four**:

1. **Does it change the code?** If the author would agree and change nothing, drop it. "Worth thinking
   about", "for later", "just noting" are drops.
2. **Is it invisible from the diff?** Evidence in files the PR does not touch is the highest-value
   comment there is. If a reader of the changed lines alone would see it, the author saw it too.
3. **Would the build, a formatter, an analyser or an existing test catch it?** Then drop it. Exception:
   if CI does not run the tests on PRs, a test the PR breaks is worth a comment.
4. **Is it one comment, not one of five?** Three instances of one mistake are one comment on the first
   that names the others. One finding shape, one thread: all "no test covers X" findings go in one
   thread that lists each untested path. If one author has several open PRs for one feature, post the
   shape once and link to it.

Before posting a **stale-comment** finding, grep the whole source branch for the same claim
(`git grep -n "<old phrase>" origin/<source>`) and list every hit in the one comment.

Before asking for a member to be **added to a test or an expected-properties list**, confirm production
code reads it.

Never post: PR description quality (unless the project rules ask), naming taste, file placement
preference, or anything whose fix is "I would have written it differently".

If a finding passes, include the step the author would otherwise miss. "This is wrong" alone makes them
redo your work.

## Comment budget

Ten comments get read; forty get skimmed and dismissed.

- **Post:** what changes the code, breaks the build, or contradicts the ticket.
- **Fold together:** one thread per finding shape, not per file.
- **Drop:** formatting, naming taste, anything a tool catches, anything an existing thread covers.
- **Summary thread:** with more than about six findings, post one PR-level comment that states the
  overall concern and points at the detail comments.

Aim for under ten file comments on a normal PR. Longer means you are reviewing style.

## Workflow

### 1. Detect the host and gather context

```bash
git remote get-url origin
# github.com          -> GitHub   (gh)
# dev.azure.com, *.visualstudio.com -> Azure DevOps (az)
# gitlab.com or a self-hosted GitLab -> GitLab (glab)
```

Get the PR's base and source refs, its head commit, and **the threads that already exist**, so you do
not repeat a point a human already made. Duplicating an existing comment is the fastest way to look like
a bot. Commands per host are below.

The source branch is usually not checked out. Read the PR's code with explicit refs so you never touch
the working tree:

```bash
git fetch origin --quiet
git show origin/<source-branch>:<repo-relative-path>
git diff origin/<target>...origin/<source> -- <path>
```

### 2. Draft

For each candidate, write down for yourself, not for posting:
- the claim, in one plain sentence
- the exact `file:line` on the **source branch** it anchors to
- the evidence you would cite if challenged

Then write the one-line comment you would actually post.

### 3. Verification gate (do not skip, do not shortcut)

Spawn **one fresh subagent with no prior context** and hand it the drafted comments. Fresh matters: you
have been staring at this diff and your reasoning looks right to you by now. A verifier that shares your
context shares your blind spots. Give it the ref setup and:

```
For each numbered claim below, decide CONFIRMED, REFUTED, or UNPROVEN.

Open the files yourself and trace the claim end to end. A claim is CONFIRMED only
if you personally followed every step and can cite file:line for each. If the claim
depends on a value crossing a mapper, an endpoint, a DTO or a serializer, read each
one; the step you skip is the step that makes the comment wrong.

REFUTED: cite exactly what disproves it.
UNPROVEN: name the single step you could not verify and the one check that settles it.

Also flag any claim whose wording overstates what the code shows.

Check that every method, class and property named in a comment exists on the
source branch (`git grep -n "<name>" origin/<source>`). A name that does not exist
makes the claim REFUTED.

Do not trust any earlier verdict attached to these claims. Re-read the source.
```

A named method that does not exist on the branch has passed gates before; the existence check is the
cheapest step and catches it.

Act on the verdicts honestly:

- **CONFIRMED** - post it.
- **UNPROVEN** - post it as an open question that admits the gap, or hold it. Never post an unproven
  claim phrased as settled.
- **REFUTED** - drop it. Do not rescue it with hedging. Tell the user it was dropped and why; a dropped
  comment is evidence the gate works.

If the verifier says the wording overstates the evidence, rewrite before posting.

### 4. Confirm with the user before posting

Posting is outward-facing and notifies the author. Show the final list as a compact table - file, line,
exact text - plus what the gate dropped, and get a yes.

### 5. Post

One thread per finding, anchored to the line on the **source (new) side** of the diff. Write each body
to a file and post one at a time, so a single failure does not leave you guessing which comments
landed. Inline JSON with quotes and newlines gets mangled by the shell.

#### GitHub (`gh`)

```bash
gh pr view <PR> --json baseRefName,headRefName,headRefOid,title,url
gh api "repos/{owner}/{repo}/pulls/<PR>/comments" --paginate      # existing line comments
gh pr view <PR> --comments                                        # existing PR-level comments
```

Line comment - `comment.json`:

```json
{
  "body": "Commentator : Claude  \nSeverity : Med  \nConcern : Id = 64 is already used on main for the approval template.",
  "commit_id": "<headRefOid>",
  "path": "src/Data/Seed/TemplateSeed.cs",
  "line": 42,
  "side": "RIGHT"
}
```

```bash
gh api -X POST "repos/{owner}/{repo}/pulls/<PR>/comments" --input comment.json
gh pr comment <PR> --body-file summary.md                          # PR-level summary thread
```

- GitHub accepts a line comment only on a line inside a diff hunk. For a finding on an untouched line,
  post a PR-level comment that names the file and symbol.
- `commit_id` must be the PR's current head; a stale SHA gets the comment marked outdated or rejected.
- For several comments at once you can create one review instead
  (`POST repos/{owner}/{repo}/pulls/<PR>/reviews` with `event: "COMMENT"` and a `comments` array), but
  one failing anchor then rejects the whole review.

#### Azure DevOps (`az`)

```bash
ORG="https://dev.azure.com/<org>"
PROJ="<project>"
REPO="<repo name or id>"
RES="499b84ac-1321-427f-aa17-267ca6975798"   # Azure DevOps resource id for az rest

az repos pr show --id <PR> --organization "$ORG" \
  --query "{src:sourceRefName,tgt:targetRefName,merge:mergeStatus,title:title}" -o json

az rest --method get \
  --uri "$ORG/$PROJ/_apis/git/repositories/$REPO/pullRequests/<PR>/threads?api-version=7.0" \
  --resource "$RES" -o json
```

`thread.json`:

```json
{
  "comments": [
    { "parentCommentId": 0, "content": "Commentator : Claude  \nSeverity : Med  \nConcern : Id = 64 is already used on main for the approval template.", "commentType": 1 }
  ],
  "status": 1,
  "threadContext": {
    "filePath": "/src/Data/Seed/TemplateSeed.cs",
    "rightFileStart": { "line": 42, "offset": 1 },
    "rightFileEnd": { "line": 42, "offset": 80 }
  }
}
```

```bash
az rest --method post \
  --uri "$ORG/$PROJ/_apis/git/repositories/$REPO/pullRequests/<PR>/threads?api-version=7.0" \
  --resource "$RES" --headers "Content-Type=application/json" --body @thread.json
```

- For a PR-level thread, omit `threadContext`.
- `filePath` starts with `/` and is repo-relative.
- `status: 1` is Active (needs a reply). `4` is Closed - only for an FYI.
- `commentType: 1` is a normal text comment. `2` is a system comment; never post that.

#### GitLab (`glab`)

```bash
glab mr view <IID>
glab api "projects/:id/merge_requests/<IID>"                    # diff_refs: base_sha, start_sha, head_sha
glab api "projects/:id/merge_requests/<IID>/discussions" --paginate   # existing threads
```

`discussion.json`:

```json
{
  "body": "Commentator : Claude  \nSeverity : Med  \nConcern : Id = 64 is already used on main for the approval template.",
  "position": {
    "position_type": "text",
    "base_sha": "<diff_refs.base_sha>",
    "start_sha": "<diff_refs.start_sha>",
    "head_sha": "<diff_refs.head_sha>",
    "old_path": "src/Data/Seed/TemplateSeed.cs",
    "new_path": "src/Data/Seed/TemplateSeed.cs",
    "new_line": 42
  }
}
```

```bash
glab api -X POST "projects/:id/merge_requests/<IID>/discussions" \
  -H "Content-Type: application/json" --input discussion.json
glab mr note <IID> -m "$(cat summary.md)"                        # MR-level summary note
```

- All three SHAs come from the MR's current `diff_refs`; stale ones attach the note to an old version.
- A line outside the diff needs both `old_line` and `new_line`, or post an MR-level note instead.

#### Every host

- Anchor to a line that exists on the **source** branch. A line number from the target branch lands in
  the wrong place or is rejected.
- If the `gh` / `az` / `glab` CLI is missing or not signed in, stop and tell the user; do not fall back
  to scraping or unauthenticated calls.

### 6. Report back

List what was posted with thread or comment ids, and what the gate dropped. Give the user the PR URL.

## Process asks

A request about process ("Could you rebase on main?", "resolve the merge conflicts please") still uses
the three-line format, with `Severity : Low`. Never phrase a code judgement as a direct order.

## What not to do

- Do not post the raw review report. It is written for a decision-maker; a PR thread is written for the
  author. Translate.
- No severity badges, tables or headings inside a thread. Threads are conversations.
- Do not post the same point on five lines. One comment, mention the rest.
- Do not post anything the verifier refuted, however sure you feel.
- Do not resolve or reply to other people's threads unless asked.
- Do not push commits, edit the PR description, approve, or change reviewers. Comments only.
