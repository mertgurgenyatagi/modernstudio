# Page designs

The decided layout of each page, one section per page. The palette and fonts are in [design.md](design.md); this file is only about arrangement. What each page contains is in [pages.md](pages.md).

Pages are decided one at a time, from an exhibition of layouts (see [exhibition/](exhibition/)). A page with no section here is still open.

## Mixer: the Ledger

Chosen on 2026-11-08 from [exhibition/mixer.html](exhibition/mixer.html), design 02. Seventeen of the planned twenty designs were built. Designs 01 to 08 were looked at in a browser; 09 to 17 were never viewed. The guiding principle was that intuitiveness and ease of use come first.

### What it is

A plain table. One row per instrument, the same columns every time, the master in the footer row. Nothing to learn: read across, change what you need.

### Layout

- **Top bar.** The title "Mixer" at the left. At the right: BPM as a number field plus a slider (40 to 300), the meter as a two-way choice (4/4, 3/4), and the Play button.
- **Table columns, in order.** Instrument, Volume, Level, Mute, Isolate. Column heads are sentence case, grey, with horizontal rules only and no outer border.
  - **Instrument:** the name, and under it one plain word for what the channel is doing: Playing, Muted, or Silent while another is isolated.
  - **Volume:** a horizontal slider and its number.
  - **Level:** a horizontal meter that moves while playing and falls to empty when stopped.
  - **Mute and Isolate:** one checkbox-style square per row under the column head. Ticked means on.
- **Rows, top to bottom.** Drums, Bass, Rhythm Guitar, Lead Guitar, Keys.
- **Footer row.** Master: its volume slider and number, and its level meter. No mute or isolate cells.
- **Muted or silenced rows** show the name in grey and the meter dimmed. Only one Isolate can be ticked at a time.
- **Narrow windows.** The table restacks: each instrument becomes a block with its name, slider, meter, and two labelled Mute and Isolate buttons side by side.

### Assumed in the design

None of this is in the questionnaire answers. Change it if wrong.

- The volume scale is 0 to 100, shown as a number beside each slider.
- The Mixer design draws its own Play and Stop button. Questionnaire 16 moved these into one transport bar at the top of every page ([pages.md](pages.md)), so the build uses the shared bar instead. Built in plan24 step 5: the page header holds the title at the left and BPM (field and slider) and the meter choice at the right; the page switch and transport are in the shared top bar.
- BPM has both a number field (to type) and a slider (to drag).
- The three status words under each name (Playing, Muted, Silent while another is isolated) were added so the isolate rule is visible without explanation.
- Corner shape, line weight and row height are this page's own and are not a decision for other pages.

### Where to look

The drawn version is design 02 in [exhibition/mixer.html](exhibition/mixer.html). The other sixteen stay there as the record of what was considered.

## Song: the Brush bar

Chosen on 2026-11-08 from [exhibition/song.html](exhibition/song.html), design 08. Ten designs were built. None was opened in a browser; they were only checked with the static lint, so the picked layout is unseen rendered.

### What it is

One toolbar holds the whole pattern picker as a single "brush". Below it, five tall, clean lanes carry nothing but their blocks. You choose an instrument and a ready pattern in the toolbar, then click an empty bar in a lane to place it.

### Layout

- **Toolbar, one row.** At the left: the Play button (filled ink) and the position readout, "Bar 6 of 12". At the right, the brush: the word "Place", then the instrument as a five-way choice (Drums, Bass, Rhythm Guitar, Lead Guitar, Keys), then a stepper (previous arrow, the pattern number, next arrow). The stepper moves only through ready patterns and skips empty ones.
- **Timeline.** A row of bar numbers above the lanes. Clicking a bar moves the playhead. The playhead is a 2px ink line through all five lanes.
- **Lanes, top to bottom.** Drums, Bass, Rhythm Guitar, Lead Guitar, Keys. Each lane has its name in a left column and a track of bars with hairline bar lines. Lanes are tall (about 5.5rem).
- **Blocks.** Ink-filled, with the pattern number set large in the figure face. A block is as wide as its pattern is long (1, 2, 4 or 8 bars) and snaps to the bar line. Blocks do not overlap; gaps are allowed.
- **The brush lane.** The lane of the chosen instrument has its name outlined in ink. When the pointer is over an empty stretch of that lane, a dashed ghost block shows where the brush would land and how wide it is.
- **Narrow windows.** The toolbar wraps, the name column narrows, and the lanes scroll sideways as one piece. The page itself never scrolls sideways.

### Assumed in the design

None of this is in the questionnaire answers. Change it if wrong.

- The Song design draws its own Play button, as the Mixer does. The shared transport bar of questionnaire 16 replaces it ([pages.md](pages.md)).
- "Bar 6 of 12" is a readout of the playhead and the song end (the end of the last placed block on any lane). It is the only number added.
- The stepper skips empty patterns, because only active patterns can be placed.
- The sixteen bars drawn are the visible stretch. The song can run to 256 bars, reached by scrolling sideways.
- Moving and removing blocks are not drawn. The design suggests dragging to move. Removal is decided in questionnaire 16: select the block and press Delete, with no Remove button.
- Corner shape, line weight and lane height are this page's own and are not a decision for other pages.

### Where to look

The drawn version is design 08 in [exhibition/song.html](exhibition/song.html). The other nine stay there as the record of what was considered.

## Drums: the Pad machine

Chosen on 2026-11-08 from [exhibition/drums.html](exhibition/drums.html), design 03. Ten designs were built. None was opened in a browser; they were only checked with the static lint, so the picked layout is unseen rendered.

### What it is

The densest of the ten. The whole page is one bordered panel split into compartments, and every step of the drum grid is a pad you press. Nothing hides behind a tab or a menu: the patterns, the tools, the pads and the envelope are all on screen at once.

### Layout

- **Header.** The title "Drums" at the left. At the right: Undo, then Play (filled ink). Square corners.
- **The panel.** One block with a 2px ink border and 1px ink rules between its compartments.
- **Pattern bank, top compartment.** The word "Pattern", then the twenty pattern numbers in two rows of ten, then "Copy notes to…" at the right. A pattern that has notes has an ink outline and ink figures. An empty pattern has a grey outline and grey figures, and can still be selected. The selected pattern is ink-filled.
- **Tool column, left compartment.** Top to bottom: Length (1x, 2x, 4x, 8x in a two-by-two block), Note value (Whole, Half, Quarter, 16th, Third, Half of a third as a stack of six full-width buttons), and a "Show whole pattern" button. The chosen length and note value are ink-filled.
- **Pads, centre compartment.** The beat numbers 1 to 4 above. Five rows, top to bottom: Crash, Open hi-hat, Hi-hat, Snare, Kick, each with its name at the left. Each row is sixteen square pads in four groups of four, one group per beat, with a wider gap between groups. A placed hit is an ink-filled pad; an empty step is a pale pad. The grid scrolls sideways inside its compartment when the window is narrow.
- **Envelope strip, bottom compartment.** Four equal cells in a row: Volume, Attack, Decay, Release. Each has its name, its number and a slider.
- **Narrow windows.** The panel becomes one column in this order: pattern bank, tools (two columns), pads, envelope (two by two). The page itself never scrolls sideways.

### Assumed in the design

None of this is in the questionnaire answers. Change it if wrong.

- The Drums design draws its own Undo and Play. The shared transport bar of questionnaire 16 replaces them ([pages.md](pages.md)).
- The editor is drawn as pads, one per step of the chosen note value. The docs say only that Drums has five rows and that hits have no length. Pads are the way this design shows "a hit with no length".
- Sixteen pads per bar are drawn because 16th is the note value shown as chosen. How the pad grid changes for Whole, Half, Quarter, Third and Half of a third is not drawn.
- For a pattern of 2x, 4x or 8x the pads continue to the right and the compartment scrolls sideways, or "Show whole pattern" fits them all. Neither is drawn.
- "Show whole pattern" is a button that stays pressed when on. The docs call it a toggle.
- "Copy notes to…" is a button. The picker that follows it is not drawn.
- Empty patterns are selectable, because a pattern becomes active when the first note is placed in it.
- The envelope values are shown on a 0 to 100 scale with no unit, as the Mixer volume is. The docs give no units for attack, decay and release.
- The sample beat, the active pattern numbers (1, 2, 3 and 5) and the envelope values in the exhibition are made up to fill the screen.
- Corner shape, line weight and pad size are this page's own and are not a decision for other pages.

### Built

Plan24 step 7 built it as `src/pages/Drums.tsx`, with the assumptions listed in [open-items.md](open-items.md). The grid is made of pads for the chosen note value (16 per 4/4 bar at the 16th, 12 thirds, 24 halves of a third, 4 quarters), and the pads of a longer pattern run on to the right.

### Where to look

The drawn version is design 03 in [exhibition/drums.html](exhibition/drums.html). The other nine stay there as the record of what was considered.

## Guitar: the String cards

Chosen on 2026-11-08 from [exhibition/guitars.html](exhibition/guitars.html), design 11. Twelve designs were built. None was opened in a browser; they were only checked with the static lint, so the picked layout is unseen rendered. The guiding principle was simplicity and ease of use.

### What it is

One page for Bass, Rhythm Guitar and Lead Guitar, because the three differ only in their strings. Each string is its own card with a header naming it, so you never lose which string you are on. What you set once (instrument, frets, envelope) sits in a narrow panel at the right.

### Layout

- **Two columns.** A main column on the paper-3 ground, and a 15rem panel at the right with a paper-2 ground and a 1px ink rule between them.
- **Pattern row, top of the main column.** The twenty pattern numbers in one row of small squares, then "Copy notes to…", then at the far right Undo and Play (filled ink). A pattern that has notes has an ink outline and ink figures. An empty pattern has a grey outline and grey figures, and can still be selected. The selected pattern is ink-filled.
- **Tools row, under it.** Two labelled groups of small buttons: Length (1x, 2x, 4x, 8x) and Note value (Whole, Half, Quarter, 16th, Third, Half of a third). The chosen one in each is ink-filled.
- **Beat numbers.** 1 to 4 above the cards.
- **String cards, top to bottom, lowest pitch first.** Bass has four: E1, A1, D2, G2. Rhythm Guitar and Lead Guitar have six: E2, A2, D3, G3, B3, E4. Each card is a bordered block with a header strip holding the string name in the figure face and the words "open string" in grey. Below the header, a narrow left column of fret numbers 0 to 7, then sixteen columns of steps with a line at each beat. The row for fret 0, the open string, is tinted. A placed note is an ink-filled square showing its fret number, as wide as its length.
- **Side panel, top to bottom.**
  - **Instrument:** three stacked choices, Bass, Rhythm Guitar, Lead Guitar. The chosen one is ink-filled.
  - **Frets:** 5, 7 or 12 as three buttons, with a "Show whole pattern" button under them.
  - **Envelope:** Volume, Attack, Decay and Release, each a name, a number and a slider.
- **Narrow windows.** The panel moves under the main column, in two columns. The cards scroll sideways as one piece. The page itself never scrolls sideways.

### Assumed in the design

None of this is in the questionnaire answers. Change it if wrong.

- Bass, Rhythm Guitar and Lead Guitar are one page. This is the user's decision, not a questionnaire answer. The instrument is a three-way choice in the side panel, because the docs place it nowhere.
- Switching instrument swaps in that instrument's own patterns, notes, fret count and envelope. Bass shows four cards, the guitars six.
- Rows are labelled by fret number, 0 to 7. The example in [instrument-layouts.md](instrument-layouts.md) names the pitch on every row (E2, F2, F#2 and so on); this design shows the pitch only in the card header, as the open string. Pitch names on every row could be added without changing the layout.
- With 5 or 12 frets the cards would have 6 or 13 rows. Neither is drawn.
- Sixteen steps per bar are drawn because 16th is the note value shown as chosen. How the grid changes for Whole, Half, Quarter, Third and Half of a third is not drawn. Nor is a 2x, 4x or 8x pattern; the cards would scroll sideways, or "Show whole pattern" would fit them all.
- The Guitar design draws its own Undo and Play. The shared transport bar of questionnaire 16 replaces them ([pages.md](pages.md)). The six string cards run about 1000 pixels tall, so at 540 high the editor scrolls vertically. The user accepted this in questionnaire 16.
- "Show whole pattern" is a button that stays pressed when on. "Copy notes to…" is a button, and the picker that follows it is not drawn.
- Empty patterns are selectable, because a pattern becomes active when the first note is placed in it.
- The envelope values are shown on a 0 to 100 scale with no unit.
- The sample notes, the active pattern numbers (1, 2, 3 and 5) and the envelope values in the exhibition are made up to fill the screen.
- Corner shape, line weight and row height are this page's own and are not a decision for other pages.

### Where to look

The drawn version is design 11 in [exhibition/guitars.html](exhibition/guitars.html), shown with Lead Guitar. The other eleven stay there as the record of what was considered.
