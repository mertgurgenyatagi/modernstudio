MIDI import (asked and answered in chat on 2026-11-09, not a numbered questionnaire)

1. Is this import only, or should the app also export a MIDI file?
Both. And it's file based, not keyboard based.

2. What does an import do: (a) open as a new project, asking to save the current one first, (b) replace the current project, or (c) merge into the current project?
A.

3. Besides a whole file, should one track be importable into the open pattern or instrument?
Only whole.

4. Do you have real files in mind?
Okay, so, here's the deal. It's kind of weird. I only need it to handle imports from a single album, The Strokes' "Is This It". In the "midis" folder in the root, you'll find 6-7 versions of each song in that album. I just need the ones that are the most well-put together, one for each song. We'll leave the midi import open ended just in case I want to import other songs in the future, but for the purposes right here right now, this album is enough.

5. Track to instrument: guess and import without asking, or show a mapping step?
Mapping step.

6. If two tracks map to the same instrument, merge them or leave the second unused?
I'm not sure. Merging sounds weird. But you know better.

7. Rhythm versus Lead: send guitar tracks to Rhythm first and Lead second, or leave Lead empty unless assigned?
I don't know what you're asking here.

8. Pitch outside the range: (a) shift by whole octaves to fit, (b) drop with a count, or (c) shift only when small?
Yeah sure, A.

9. Fret count: the smallest of 5, 7 or 12 that fits, or always 7?
Your call.

10. String choice: the same pitch sits on several strings. Lowest fret, chords not arranged for playability: acceptable?
We'll need an algorithm for this. This needs to be accurate for the most part. I think you should deliberate on this, perhaps seperately. Do whatever you need in order to get this right.

11. Drums: map the extra General MIDI drum sounds onto the nearest of the five rows, or drop them?
Drop them. Except ride, map that to open hi hat.

12. Timing: snap starts to the nearest allowed position and round lengths to the nearest allowed length?
Nearest of those.

13. Tempo changes, a tempo outside 40 to 300, or a meter other than 4/4 and 3/4: what should happen?
Your call.

14. Turning notes into patterns, with at most 20 patterns per instrument: what should happen?
Needs an algorithm, again.

15. Over 256 bars: cut the song at 256 and warn?
Yeah.

16. Ignored data: velocity, pitch bend, controllers, volume, pan, program changes, lyrics, markers. Anything to keep?
Nah, ignore em.

17. Where does the Import command live?
Mixer.

18. Should an import be one Undo step?
Can't undo it.

Said afterwards, while the analysis was running:
By the way, we can increase the pattern count to like, 120. It's 20 on the surface, but when you hit 20, maybe a secret button appears?
