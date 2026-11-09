"""Records the four chosen General MIDI sounds from the Windows synth into the app's sample files.

Steps (run from the repository root, with the venv in tools/sounds/.venv):

    python tools/sounds/capture.py record     play each note through the synth, record what the speakers
                                              get (WASAPI loopback), keep the raw takes in tools/sounds/raw/
    python tools/sounds/capture.py process    trim, level and write src/assets/sounds/ and its manifest
    python tools/sounds/capture.py            both

Then `npm run check:sounds` checks the result. See docs/sound.md.

The synth is played through the existing bridge helper, tools/audition/winmidi.ps1 (winmm through
PowerShell). Nothing else may make a sound on this machine while recording; the script measures a
second of silence first and stops if the machine is not quiet.
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import wave
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "tools" / "sounds" / "raw"
OUT = ROOT / "src" / "assets" / "sounds"
HELPER = ROOT / "tools" / "audition" / "winmidi.ps1"

OUT_RATE = 44100
VELOCITY = 100
STEP = 3  # semitones between recorded notes of the pitched instruments

# Sound table: docs/sound.md. `program` is the value sent (General MIDI number minus 1).
# `low` and `high` are the lowest and highest MIDI note the app can ask for (docs/midi-import.md,
# the guitars including 12 frets), `hold` is how long the key is held, in seconds.
PITCHED = {
    "bass": {"gm": "Electric Bass (finger)", "program": 33, "low": 28, "high": 55, "hold": 2.5, "tail": 1.5},
    "guitar": {"gm": "Electric Guitar (jazz)", "program": 26, "low": 40, "high": 76, "hold": 3.0, "tail": 1.5},
    "keys": {"gm": "Synth Voice", "program": 54, "low": 36, "high": 84, "hold": 4.0, "tail": 1.5},
}
# One sample per drum row (channel 10 note numbers, docs/midi-import.md). `tail` is how long to listen.
DRUMS = {
    "kick": {"note": 36, "tail": 1.5},
    "snare": {"note": 38, "tail": 1.5},
    "hihat": {"note": 42, "tail": 1.0},
    "openHihat": {"note": 46, "tail": 2.5},
    "crash": {"note": 49, "tail": 4.0},
}
DRUMS_GM = "Standard Kit"


def sample_notes(low: int, high: int) -> list[int]:
    """The notes that get a recording: every STEP semitones from the lowest, and always the highest."""
    notes = list(range(low, high + 1, STEP))
    if notes[-1] != high:
        notes.append(high)
    return notes


# ---------------------------------------------------------------- recording


class Synth:
    def __init__(self) -> None:
        self.proc = subprocess.Popen(
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(HELPER)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            text=True,
            bufsize=1,
        )
        line = self.proc.stdout.readline().strip()
        if not line.startswith("READY"):
            raise SystemExit(f"The Windows synth did not open: {line or 'no answer'}")
        self.name = line[6:]

    def send(self, status: int, d1: int, d2: int = 0) -> None:
        self.proc.stdin.write(f"{status} {d1} {d2}\n")
        self.proc.stdin.flush()

    def reset(self) -> None:
        self.proc.stdin.write("RESET\n")
        self.proc.stdin.flush()

    def close(self) -> None:
        try:
            self.proc.stdin.close()
            self.proc.wait(timeout=5)
        except Exception:
            self.proc.kill()


class Recorder:
    """Records the default speakers (loopback). Loopback delivers nothing while the machine is silent,
    so the take starts at the first sound; only what follows it is kept, which is what is wanted."""

    def __init__(self) -> None:
        import pyaudiowpatch as pa

        self.pa = pa.PyAudio()
        dev = self.pa.get_default_wasapi_loopback()
        self.dev = dev
        self.rate = int(dev["defaultSampleRate"])
        self.channels = int(dev["maxInputChannels"])
        self.pa_mod = pa
        self.chunks: list[bytes] = []
        self.stream = None

    def start(self) -> None:
        self.chunks = []

        def cb(data, frames, info, status):
            self.chunks.append(bytes(data))
            return (None, self.pa_mod.paContinue)

        self.stream = self.pa.open(
            format=self.pa_mod.paInt16,
            channels=self.channels,
            rate=self.rate,
            input=True,
            input_device_index=self.dev["index"],
            frames_per_buffer=1024,
            stream_callback=cb,
        )

    def stop(self) -> np.ndarray:
        self.stream.stop_stream()
        self.stream.close()
        raw = np.frombuffer(b"".join(self.chunks), dtype=np.int16)
        return raw.reshape(-1, self.channels).astype(np.float32) / 32768.0

    def close(self) -> None:
        self.pa.terminate()


def write_wav(path: Path, data: np.ndarray, rate: int) -> None:
    """data: float32, shape (n,) mono or (n, channels)."""
    pcm = np.clip(np.round(data * 32767.0), -32768, 32767).astype("<i2")
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1 if data.ndim == 1 else data.shape[1])
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as w:
        rate = w.getframerate()
        ch = w.getnchannels()
        raw = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2")
    return raw.reshape(-1, ch).astype(np.float32) / 32768.0, rate


def take(synth: Synth, rec: Recorder, name: str, channel: int, program: int, note: int, hold: float, tail: float) -> None:
    synth.reset()
    time.sleep(0.5)
    synth.send(0xC0 | channel, program) if program >= 0 else None
    time.sleep(0.15)
    rec.start()
    time.sleep(0.25)
    synth.send(0x90 | channel, note, VELOCITY)
    time.sleep(hold)
    synth.send(0x80 | channel, note, 0)
    time.sleep(tail)
    audio = rec.stop()
    write_wav(RAW / f"{name}.wav", audio, rec.rate)
    peak = float(np.abs(audio).max()) if audio.size else 0.0
    print(f"  {name}: {audio.shape[0] / rec.rate:.2f} s recorded, peak {peak:.3f}", flush=True)
    if peak < 0.005:
        raise SystemExit(f"{name} came back silent. Is the speaker output muted, or is no output device active?")


def record() -> None:
    RAW.mkdir(parents=True, exist_ok=True)
    synth = Synth()
    rec = Recorder()
    print(f"Synth: {synth.name}. Loopback: {rec.dev['name']} at {rec.rate} Hz, {rec.channels} channels.", flush=True)
    try:
        # The machine must be quiet, or other programs end up in the samples.
        rec.start()
        time.sleep(1.0)
        quiet = rec.stop()
        level = float(np.abs(quiet).max()) if quiet.size else 0.0
        if level > 0.0005:
            raise SystemExit(f"Something else is playing sound (level {level:.4f}). Stop it and run again.")

        meta = {"rate": rec.rate, "channels": rec.channels, "velocity": VELOCITY, "synth": synth.name, "takes": {}}
        for inst, spec in PITCHED.items():
            print(f"{inst} ({spec['gm']})", flush=True)
            for note in sample_notes(spec["low"], spec["high"]):
                name = f"{inst}_{note}"
                take(synth, rec, name, 0, spec["program"], note, spec["hold"], spec["tail"])
                meta["takes"][name] = {"instrument": inst, "note": note, "hold": spec["hold"]}
        print(f"drums ({DRUMS_GM})", flush=True)
        for row, spec in DRUMS.items():
            name = f"drums_{row}"
            take(synth, rec, name, 9, 0, spec["note"], 0.3, spec["tail"])
            meta["takes"][name] = {"instrument": "drums", "row": row, "note": spec["note"], "hold": 0.3}
        (RAW / "takes.json").write_text(json.dumps(meta, indent=2))
    finally:
        synth.reset()
        synth.close()
        rec.close()


# ---------------------------------------------------------------- processing

SILENCE_START = 10 ** (-50 / 20)  # the take begins where the sound first rises above this
SILENCE_END = 10 ** (-60 / 20)  # and ends where it last stays above this
LEAD_IN = 0.002  # seconds kept before the first sound, so the attack is not clipped
FADE_OUT = 0.03  # seconds of fade at the very end, to avoid a click
TARGET_RMS_DB = -20.0  # melodic samples: loudness of the first LOUDNESS_SPAN seconds
LOUDNESS_SPAN = 1.0
CEILING = 0.89  # about -1 dBFS; no sample peaks above it


def to_mono(audio: np.ndarray) -> np.ndarray:
    return audio.mean(axis=1) if audio.ndim == 2 else audio


def resample(x: np.ndarray, rate_in: int, rate_out: int) -> np.ndarray:
    if rate_in == rate_out:
        return x
    n_out = int(round(len(x) * rate_out / rate_in))
    t_out = np.arange(n_out) * (rate_in / rate_out)
    # Linear interpolation is not good enough for a clean sample: use a windowed-sinc low-pass first.
    cutoff = min(1.0, rate_out / rate_in) * 0.45
    taps = 255
    n = np.arange(taps) - taps // 2
    h = np.sinc(2 * cutoff * n) * 2 * cutoff * np.hamming(taps)
    h /= h.sum()
    filtered = np.convolve(x, h, mode="same")
    return np.interp(t_out, np.arange(len(x)), filtered).astype(np.float32)


def trim(x: np.ndarray, rate: int) -> np.ndarray:
    above = np.nonzero(np.abs(x) > SILENCE_START)[0]
    if above.size == 0:
        raise SystemExit("A take is silent after trimming.")
    start = max(0, above[0] - int(LEAD_IN * rate))
    above_end = np.nonzero(np.abs(x) > SILENCE_END)[0]
    end = above_end[-1] + 1
    y = x[start:end].copy()
    fade = min(len(y), int(FADE_OUT * rate))
    y[len(y) - fade :] *= np.linspace(1.0, 0.0, fade, dtype=np.float32)
    return y


def rms_db(x: np.ndarray, rate: int) -> float:
    seg = x[: int(LOUDNESS_SPAN * rate)]
    return 20 * np.log10(max(float(np.sqrt(np.mean(seg**2))), 1e-9))


def process() -> None:
    meta = json.loads((RAW / "takes.json").read_text())
    takes = meta["takes"]
    manifest: dict = {
        "version": 1,
        "sampleRate": OUT_RATE,
        "format": "wav, 16-bit, mono",
        "velocity": VELOCITY,
        "source": f"{meta['synth']}, recorded by tools/sounds/capture.py",
        "instruments": {},
    }

    decoded: dict[str, np.ndarray] = {}
    for name in takes:
        audio, rate = read_wav(RAW / f"{name}.wav")
        decoded[name] = trim(resample(to_mono(audio), rate, OUT_RATE), OUT_RATE)

    for inst, spec in PITCHED.items():
        notes = sample_notes(spec["low"], spec["high"])
        entries = []
        for i, note in enumerate(notes):
            x = decoded[f"{inst}_{note}"]
            x = x * 10 ** ((TARGET_RMS_DB - rms_db(x, OUT_RATE)) / 20)
            peak = float(np.abs(x).max())
            if peak > CEILING:
                x = x * (CEILING / peak)
            low_cover = spec["low"] if i == 0 else (notes[i - 1] + note + 1) // 2
            high_cover = spec["high"] if i == len(notes) - 1 else (note + notes[i + 1] - 1) // 2
            rel = f"{inst}/{inst}_{note}.wav"
            write_wav(OUT / rel, x, OUT_RATE)
            entries.append(
                {
                    "file": rel,
                    "pitch": note,
                    "covers": [low_cover, high_cover],
                    "heldSeconds": spec["hold"],
                    "seconds": round(len(x) / OUT_RATE, 3),
                }
            )
        manifest["instruments"][inst] = {
            "kind": "pitched",
            "generalMidi": spec["gm"],
            "usedBy": {"bass": ["bass"], "guitar": ["rhythm", "lead"], "keys": ["keys"]}[inst],
            "samples": entries,
        }

    # Drums: one gain for the whole kit so the rows keep their balance; the loudest hit peaks at CEILING.
    kit_peak = max(float(np.abs(decoded[f"drums_{row}"]).max()) for row in DRUMS)
    kit_gain = CEILING / kit_peak
    drum_entries = []
    for row in DRUMS:
        x = decoded[f"drums_{row}"] * kit_gain
        rel = f"drums/drums_{row}.wav"
        write_wav(OUT / rel, x, OUT_RATE)
        drum_entries.append({"file": rel, "row": row, "midiNote": DRUMS[row]["note"], "seconds": round(len(x) / OUT_RATE, 3)})
    manifest["instruments"]["drums"] = {
        "kind": "drums",
        "generalMidi": DRUMS_GM,
        "usedBy": ["drums"],
        "samples": drum_entries,
    }

    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    total = sum(p.stat().st_size for p in OUT.rglob("*.wav"))
    print(f"Wrote {sum(len(v['samples']) for v in manifest['instruments'].values())} files, {total / 1e6:.1f} MB, to {OUT}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd in ("record", "all"):
        record()
    if cmd in ("process", "all"):
        process()
