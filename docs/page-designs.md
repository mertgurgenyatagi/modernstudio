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
