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
