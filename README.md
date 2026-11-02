# Crystal Quest 4: Write & Win — The Spellwright's Forge

A 3D writing-practice game for MUET Writing (800/4), Levels 10–12 of the Crystal Quest
series (1–3 *Listen & Leap*, 4–6 *Speak & Conquer*, 7–9 *Read & Rise*).
The Writer's Block Golem has frozen the forge. Students write with **Quilla the Fox Scribe**
to forge nine writing anvils.

| Level | Land | Anvils |
|---|---|---|
| 10 | Inkleaf Village | Formal / informal / too casual sort · Read the task & fix Siti's draft · **Write: reply to Danial** (Task 1, informal, 100+ words) |
| 11 | Courier Citadel | Upgrade to formal · Build a formal email (gapped) · **Write: email to Puan Rahmah** (Task 1, formal, 100+ words) |
| 12 | Spellwright's Forge | Know your essay (types, thesis, PEEL) · Forge the PEEL runes (gapped) · **Write: social media essay** (Task 2, 250+ words) + the Golem |

**Full Mock Paper (75 min):** from the main menu (or after Level 12). One timer for both
tasks, as in MUET (about 25 min for Task 1, 50 for Task 2), no frames and no model.

## MUET format used

- Task 1: reply to an email or letter, **at least 100 words**, using **all the notes**. Suggested time 25 minutes.
- Task 2: essay of **at least 250 words** (argumentative, discursive or problem-solution). Suggested time 50 minutes.
- Practice levels have **no timer**. Students can switch on **⏱ Exam timing** at any writing anvil.

## How a writing anvil works

1. **Write.** The task, stimulus and notes are on the left, the writing pad on the right
   (on a tablet: task on top). There is a live word counter, and **sentence frames** to tap
   (frames have blanks ___, never full answers; they are hidden with exam timing). The writing
   is saved on the device while typing.
2. **Check.** The student taps a label (e.g. *Note ② My plan*, or *Point / Explain / Example / Link*)
   and then the sentence(s) in their own writing that show it, in colour. If something is missing,
   they go back and add it. Then they tick the quality checklist (tone, development, grammar).
3. **Compare.** Quilla's model answer opens, colour-coded the same way.
4. **Stars:** ⭐ word target reached · ⭐⭐ every label found · ⭐⭐⭐ every check ticked (100 points per star).
   The game never claims a MUET band: the student checks, the lecturer marks.

The other anvils (sort, multiple choice, gapped) work like the reading game: two tries,
and the guide sentence that proves the answer is highlighted.

**Scroll bridges** unroll as the student works. **Typo Inklings** patrol the islands.
**The Writer's Block Golem** (Level 12) roars, then throws an ink blast across the path;
wait, then run past. Finishing the essay frees it and it flies away as paper birds.

## Lecturer report

At the end of each level, **Copy** pastes the level's results into Google Sheets and **Download CSV**
exports everything saved on the device, including for each writing task: stars, word count,
exam timing used, the self-check ticks and the **student's full text** (for marking).

## Editing

All tasks, notes, frames, checklists and models are in `js/data.js` (field guide at the top of `WORLDS`).
In a model answer, `marks` must be copied exactly from the model text.

## Art

Swap art by replacing a file with the same name: `quilla_idle/talk/happy/point.webp`,
`enemy_inkling / inkling_move / inkling_hit.webp`, `golem_idle/roar/attack/think/happy/fly.webp`
(poses face right), `card_w1…w3.webp`, `backdrop_w1…w3.webp`, `title_writing.webp`.
Optional: add `item_anvil_dim.webp` / `item_anvil.webp` (unforged / forged anvil) and
`item_quill.webp` (collectible); without them the game draws a 3D anvil and uses the golden scroll.

## Credits

Tasks, models and questions written for Crystal Quest following the MUET 800/4 format.
3D scenery: Kenney Nature Kit (CC0) · 3D engine: Three.js (MIT) · Character and level art:
created for the Crystal Quest project, Politeknik Port Dickson.
