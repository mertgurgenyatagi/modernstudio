"""Reference prototype: minimal standard-MIDI-file reader, no dependencies. Not part of the app, see docs/midi-import.md."""
import struct


def _vlq(b, i):
    v = 0
    while True:
        c = b[i]
        i += 1
        v = (v << 7) | (c & 0x7F)
        if not c & 0x80:
            return v, i


def parse(path):
    b = open(path, 'rb').read()
    if b[:4] != b'MThd':
        raise ValueError('not a midi file')
    fmt, ntr, div = struct.unpack('>HHH', b[8:14])
    i = 8 + struct.unpack('>I', b[4:8])[0]
    out = dict(format=fmt, ppq=div, tracks=[], tempos=[], timesigs=[], keysigs=[])
    for ti in range(ntr):
        if i >= len(b):
            break
        if b[i:i + 4] != b'MTrk':
            # skip junk
            i += 1
            continue
        ln = struct.unpack('>I', b[i + 4:i + 8])[0]
        d = b[i + 8:i + 8 + ln]
        i += 8 + ln
        t = 0
        j = 0
        run = None
        name = ''
        notes = []
        on = {}
        progs = []
        ccs = []
        while j < len(d):
            dt, j = _vlq(d, j)
            t += dt
            s = d[j]
            if s == 0xFF:
                typ = d[j + 1]
                l, k = _vlq(d, j + 2)
                data = d[k:k + l]
                j = k + l
                if typ == 3 and not name:
                    name = data.decode('latin1', 'replace')
                elif typ == 0x51:
                    out['tempos'].append((t, int.from_bytes(data, 'big')))
                elif typ == 0x58:
                    out['timesigs'].append((t, data[0], 1 << data[1]))
                elif typ == 0x59:
                    out['keysigs'].append((t, data[0] - 256 if data[0] > 127 else data[0], data[1]))
                elif typ == 0x2F:
                    break
                continue
            if s in (0xF0, 0xF7):
                l, k = _vlq(d, j + 1)
                j = k + l
                continue
            if s & 0x80:
                run = s
                j += 1
            st = run
            hi, ch = st & 0xF0, st & 0x0F
            if hi in (0xC0, 0xD0):
                a = d[j]
                j += 1
                if hi == 0xC0:
                    progs.append((t, ch, a))
                continue
            a, c = d[j], d[j + 1]
            j += 2
            if hi == 0x90 and c > 0:
                on.setdefault((ch, a), []).append((t, c))
            elif hi == 0x80 or (hi == 0x90 and c == 0):
                q = on.get((ch, a))
                if q:
                    st0, vel = q.pop(0)
                    notes.append((st0, t, a, ch, vel))
            elif hi == 0xB0:
                ccs.append((t, ch, a, c))
        # close hanging notes
        for (ch, a), q in on.items():
            for st0, vel in q:
                notes.append((st0, t, a, ch, vel))
        notes.sort()
        out['tracks'].append(dict(name=name, notes=notes, progs=progs, ccs=ccs))
    return out


if __name__ == '__main__':
    import sys
    m = parse(sys.argv[1])
    print(m['format'], m['ppq'], len(m['tracks']), m['tempos'][:3], m['timesigs'][:3])
    for t in m['tracks']:
        print(repr(t['name']), len(t['notes']), sorted({n[3] for n in t['notes']}), t['progs'][:3])
