"""Reference prototype: split one instrument into reusable patterns and a block tiling for the Song lane. Not part of the app, see docs/midi-import.md."""
from collections import defaultdict, Counter

LENS = (1, 2, 4, 8)


class Lane:
    def __init__(self, notes, bar_tw=48):
        # notes: (start_tw, len_tw, key)  key = pitch (int) or drum row (str)
        self.bar = bar_tw
        self.notes = sorted(notes)
        self.n_bars = (max(s for s, _, _ in notes) // bar_tw + 1) if notes else 0
        self.by_bar = defaultdict(list)
        for s, l, k in self.notes:
            self.by_bar[s // bar_tw].append((s, l, k))
        self._sig = {}

    def sig(self, b, L):
        key = (b, L)
        if key in self._sig:
            return self._sig[key]
        base = b * self.bar
        end = (b + L) * self.bar
        items = []
        for i in range(b, b + L):
            for s, l, k in self.by_bar.get(i, ()):
                items.append((s - base, min(l, end - s) if l else 0, k))
        r = tuple(sorted(items))
        self._sig[key] = r
        return r

    def empty(self, b):
        return not self.by_bar.get(b)


def tile(lane, w_block=1.0, w_pattern=6.0, iters=8):
    N = lane.n_bars
    used = Counter()
    prev = None
    for it in range(iters):
        INF = float('inf')
        best = [INF] * (N + 1)
        back = [None] * (N + 1)
        best[0] = 0.0
        for b in range(N):
            if best[b] == INF:
                continue
            if lane.empty(b) and best[b] < best[b + 1]:
                best[b + 1] = best[b]
                back[b + 1] = (b, 0)
            for L in LENS:
                if b + L > N:
                    break
                sg = lane.sig(b, L)
                if not sg:
                    continue
                known = used[(L, sg)] >= 2 if it else False
                c = best[b] + w_block + (0 if known else w_pattern)
                # prefer longer blocks on exact ties
                c -= 1e-6 * L
                if c < best[b + L]:
                    best[b + L] = c
                    back[b + L] = (b, L)
        # backtrack
        blocks = []
        e = N
        while e > 0:
            b, L = back[e]
            if L:
                blocks.append((b, L))
            e = b
        blocks.reverse()
        if blocks == prev:
            break
        prev = blocks
        used = Counter((L, lane.sig(b, L)) for b, L in blocks)
    pats = {}
    for b, L in blocks:
        pats.setdefault((L, lane.sig(b, L)), len(pats) + 1)
    return blocks, pats


def fixed(lane, L):
    N = lane.n_bars
    seen = set()
    blocks = 0
    for b in range(0, N, L):
        L2 = min(L, N - b)
        sg = lane.sig(b, L2)
        if sg:
            seen.add((L2, sg))
            blocks += 1
    return len(seen), blocks


def clipped(lane, blocks):
    n = 0
    for b, L in blocks:
        end = (b + L) * lane.bar
        for i in range(b, b + L):
            for s, l, k in lane.by_bar.get(i, ()):
                if l and s + l > end:
                    n += 1
    return n
