"""Writes what the prototype's file reader finds in the eleven album files to
src/core/midi/fixtures/reader.json, so that the TypeScript reader (src/core/midi/read.ts) can be tested
against it. Run from anywhere: python tools/midi-prototype/dump_reader.py. Not part of the app."""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pipeline import PICKS, path_of
from midilib import parse

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'src', 'core', 'midi', 'fixtures', 'reader.json')


def checksum(notes):
    """A number that changes if any start, end, pitch or channel changes. The notes arrive sorted."""
    total = 0
    for start, end, pitch, channel, _vel in notes:
        total = (total * 31 + start * 7 + end * 3 + pitch * 5 + channel) % 1000000007
    return total


out = {}
for song, short in PICKS.items():
    m = parse(path_of(short))
    out[short] = dict(
        song=song,
        format=m['format'],
        ppq=m['ppq'],
        tempos=len(m['tempos']),
        timeSignatures=[list(t) for t in m['timesigs']],
        tracks=[
            dict(
                name=t['name'],
                notes=len(t['notes']),
                channels=sorted({n[3] for n in t['notes']}),
                checksum=checksum(t['notes']),
            )
            for t in m['tracks']
        ],
    )
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, indent=1, ensure_ascii=False)
    f.write('\n')
print('wrote', os.path.normpath(OUT), len(out), 'files')
