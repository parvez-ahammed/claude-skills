# Pitfalls and fixes

Each one happened while building real videos with this engine.

| Symptom | Cause | Fix |
|---|---|---|
| The brand colours are wrong; the user rejects the video | a colour picked from the token file was a status colour (warning orange), not the brand | Find each colour's role (logo, primary button, CTA, text, status) in the real theme and the landing page before using it. See SKILL.md step 2. |
| An element sits at the top-left corner | its class had no `position: absolute`, so `left`/`top` did nothing | Place with `at()`, which sets the position itself. |
| A logo or icon is invisible | an element added later is drawn on top of it | Append it after the layer it must cover, or give it `z-index`. |
| The last frame (the thumbnail) is washed out | the last scene faded out | `scene()` does not fade the last scene by default. Keep it that way. |
| The video is 0.3 s shorter than planned, or ends early | `loudnorm` drops the tail, and `-shortest` cut the video to match | mix.mjs pads the audio (`apad,atrim`) and sets `-t`. Do not add `-shortest`. |
| Loudness is -15 LUFS instead of -14 | single-pass loudnorm on a short video with little speech | mix.mjs uses two-pass loudnorm. |
| Fonts show as a fallback | the page was opened as `file://`, or the font path is wrong | Always go through render.mjs's server. Fonts come from `/engine/node_modules/@fontsource/<font>/files/...`; for another font, `npm i @fontsource/<font>` in the engine folder. The renderer prints failed loads. |
| Frames flicker or jump between render parts | the page kept state between frames (a counter, a random value, a CSS animation) | Compute everything from `t`. Use `rand(seed)`. No `transition`, `animation`, `setTimeout` or `Math.random()`. |
| A vertical version looks cheap | a landscape or square render was padded with a blurred copy of itself | Render natively at 1080x1920 with a portrait layout. |
| The product name sounds wrong | the TTS reads an unknown word letter by letter or with the wrong stress | Add it to `voice.pronounce` with a phonetic spelling (`"Acme": "Ack-me"`). You cannot hear the result, so ask the user to listen. |
| Speech is longer than the target | too many words | plan.mjs says how many words to cut. Cut words; do not push `speed` above about 1.1 (it starts to sound rushed). |
| A patch script written with a shell heredoc breaks escapes | a doubled backslash in a heredoc arrives as one | Edit files with the editor tool, not heredocs, when the text contains backslashes. |
| drawtext fails ("Cannot find a valid font") on contact sheets | ffmpeg has no default font | `label()` in lib/project.mjs looks for a system font and skips the labels when none exists. |
| Page errors appear during render | a missing asset or a JS error in a scene | render.mjs counts them and exits non-zero. Fix them. A frame with a missing image still renders, just wrong. |
| A full render is slow | 1080p PNG capture costs about 0.25 s per frame per worker | `--workers N` (default: half the CPU cores, at most 4). Review with stills; render in full only when stills look right. |
| A system is shown receiving data it can only send | the scenes were built from marketing copy, which never states direction rules | Read the product's rules in code (capability enums, allowed operations, state order) into the "Product facts" table of claims.md, then check every sender/receiver pair and status in index.html. |
| A claim has no source ("0 clicks", "no emails", a slogan) | it sounded right while writing | check.mjs fails until every spoken line and every on-screen text of 4+ words is in claims.md with a source. Remove what has none. |
| Frames between scenes are almost empty | the next scene's content starts after its fade-in, the old one fades out first | check.mjs flags runs over 0.3 s. Start each scene's first content before the cut, keep fades short. |
| Text is unreadable on a phone | card and table text sized for landscape (18 px) in a vertical video | check.mjs fails below 24 px on vertical and square. Use full-width cards and fewer rows. |
| The vertical video has empty bands at top and bottom | the square layout was rendered at 1080x1920 | Lay out for the tall frame (SKILL.md step 6); the reviewer checks it on the contact sheet, check.mjs cannot. |
| A line reads as nonsense after a script change | a new line was inserted between two that belonged together | plan.mjs prints the whole narration as one paragraph: read it. |
| A wrong file is about to be shared | an old or renamed render sits in dist/ next to the new one; a square file was named "portrait" | check.mjs lists other videos in dist/ with their real size. Move old ones to dist/old/; name files by their real size. |
| The render is killed part way | too many Chromium workers for the free memory | Default workers now also look at free memory; set WORKERS=2 when other heavy jobs run. |
