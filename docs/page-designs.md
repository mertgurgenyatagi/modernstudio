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
- The Mixer page carries its own Play and Stop button. [pages.md](pages.md) says where the transport belongs is not specified.
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

- The Song page carries its own Play button, as the Mixer does. [pages.md](pages.md) says where the transport belongs is not specified.
- "Bar 6 of 12" is a readout of the playhead and the song end (the end of the last placed block on any lane). It is the only number added.
- The stepper skips empty patterns, because only active patterns can be placed.
- The sixteen bars drawn are the visible stretch. The song can run to 256 bars, reached by scrolling sideways.
- Moving and removing blocks are not drawn. The design suggests dragging to move; how removal works (a Remove action on a selected block was drawn in design 05, and a Delete key is the plain option) is still open.
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

- The Drums page carries its own Undo and Play, as the Mixer and the Song page do. [pages.md](pages.md) says where the transport and undo belong is not specified.
- The editor is drawn as pads, one per step of the chosen note value. The docs say only that Drums has five rows and that hits have no length. Pads are the way this design shows "a hit with no length".
- Sixteen pads per bar are drawn because 16th is the note value shown as chosen. How the pad grid changes for Whole, Half, Quarter, Third and Half of a third is not drawn.
- For a pattern of 2x, 4x or 8x the pads continue to the right and the compartment scrolls sideways, or "Show whole pattern" fits them all. Neither is drawn.
- "Show whole pattern" is a button that stays pressed when on. The docs call it a toggle.
- "Copy notes to…" is a button. The picker that follows it is not drawn.
- Empty patterns are selectable, because a pattern becomes active when the first note is placed in it.
- The envelope values are shown on a 0 to 100 scale with no unit, as the Mixer volume is. The docs give no units for attack, decay and release.
- The sample beat, the active pattern numbers (1, 2, 3 and 5) and the envelope values in the exhibition are made up to fill the screen.
- Corner shape, line weight and pad size are this page's own and are not a decision for other pages.

### Where to look

The drawn version is design 03 in [exhibition/drums.html](exhibition/drums.html). The other nine stay there as the record of what was considered.
