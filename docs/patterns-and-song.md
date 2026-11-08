# Patterns and Song mode

## Patterns

- Each instrument shows 20 patterns, numbered. They have no names.
- Up to 120 patterns per instrument exist (decided 2026-11-09, for MIDI import). Once all 20 shown patterns are active, a hidden control appears that opens more. Its exact look and how many it opens at a time are not decided; see [open-items.md](open-items.md). A MIDI import that needs more than 20 opens the extra ones by itself ([midi-import.md](midi-import.md)).
- A pattern cannot be deleted. It becomes active as soon as one note is placed in it. To clear a pattern, delete its notes.
- One pattern is one bar long: four quarter notes in 4/4, three in 3/4.
- A pattern can be extended to 2x, 4x or 8x, and the length can be changed after notes are placed.
- Notes that fall outside a shortened pattern are kept and come back if the pattern is lengthened again.
- The notes of one pattern can be copied into another pattern.
- Pattern mode loops the pattern while it plays. The other instruments play along, each with the pattern last selected for it, unless one instrument is isolated.

## Pattern editor view

- The editor always shows one bar. Scroll sideways to see more of a longer pattern.
- A toggle shows the entire pattern at once. Notes can be placed and edited while it is on.
- The editor is not zoomable.
- The view does not scroll to follow the playhead during playback.

## Song mode

- One horizontal lane per instrument.
- Only active patterns can be placed. A pattern with no notes cannot be placed.
- A pattern can be used any number of times.
- Editing a pattern changes every place it is used in the song.
- Blocks snap to the bar line. They cannot overlap. Gaps are allowed.
- Playback starts from the beginning by default. If the playhead is moved, it starts from where the user clicked.
- The song ends at the end of the last placed block on any lane. Playback loops back to the start from there.
- Maximum song length is 256 bars. This limit was picked as a reasonable default and can be changed.

## Placing a pattern in the lane

Select an active pattern, then click an empty bar in the lane to place it. Blocks can be dragged to move them. A block is removed by selecting it and pressing Delete, with no button (questionnaire 16). The rest is a proposed design, since the how was left open.
