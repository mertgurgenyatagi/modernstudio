/**
 * The audio engine: loads the recorded sounds and plays a project through Web Audio. It owns the
 * clock-facing parts only. What plays and when comes from the pure code in src/core/ (playback.ts,
 * cursor.ts); this file hands those notes to the sound card a little ahead of time.
 *
 * Signal path: voice -> instrument gain (volume, mute, isolate) -> master gain -> speakers. Each
 * instrument and the master have an analyser beside them for the level meters. The metronome goes
 * straight to the speakers, so it is heard with everything muted and does not move the meters.
 *
 * Not heard by any test: a step with no window cannot play sound. Step 5 is the first that can.
 */
import { PlayCursor } from '../core/cursor';
import { INSTRUMENT_IDS, type InstrumentId } from '../core/instruments';
import { instrumentGain, levelToGain, peakToMeter, smoothMeter } from '../core/levels';
import { patternPlan, songPlan, type Plan, type Sound, type TimelineNote } from '../core/playback';
import type { Project } from '../core/project';
import { TICKS_PER_QUARTER } from '../core/time';
import { loadBuffers, manifest } from './soundFiles';
import { startNote } from './notes';
import type { Voice } from './voice';

/** What to play: the loop of the selected patterns (focused on one instrument), or the Song. */
export type PlayRequest = { mode: 'pattern'; focus: InstrumentId } | { mode: 'song'; startBar: number };

export type MeterId = InstrumentId | 'master';
export type Levels = Record<MeterId, number>;

/** How far ahead of the clock notes are handed to the sound card, and how often the timer looks. */
const LOOKAHEAD_SECONDS = 0.15;
const TIMER_MS = 25;
/** Playback begins this long after the Play press, so that the first notes are not late. */
const START_DELAY_SECONDS = 0.06;
/** Gains move to a new value over this long, so that a slider drag does not click. */
const GAIN_SMOOTHING_SECONDS = 0.015;
const METRONOME_GAIN = 0.35;

export class AudioEngine {
  private context: AudioContext | null = null;
  private buffers: Map<string, AudioBuffer> | null = null;
  private loading: Promise<void> | null = null;
  private master: GainNode | null = null;
  private instrumentGains = new Map<InstrumentId, GainNode>();
  private analysers = new Map<MeterId, AnalyserNode>();
  private meterBuffer = new Float32Array(1024);
  private levels: Levels = { drums: 0, bass: 0, rhythm: 0, lead: 0, keys: 0, master: 0 };
  private lastMeterRead = 0;

  private project: Project | null = null;
  private isolated: InstrumentId | null = null;
  private metronome = false;

  private cursor: PlayCursor | null = null;
  private request: PlayRequest | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private voices = new Set<Voice>();
  /** Counts stops, so that a play that was still loading when Stop (or another Play) came gives up. */
  private generation = 0;

  private stoppedHandler: (() => void) | null = null;

  /** Sets what to call when playback stops by itself: an empty song, or a meter change while playing. */
  onStopped(handler: (() => void) | null): void {
    this.stoppedHandler = handler;
  }

  get ready(): boolean {
    return this.buffers !== null;
  }

  get playing(): boolean {
    return this.cursor !== null;
  }

  /** What is playing now, or null when stopped. A pattern editor draws its playhead only for its own loop. */
  get playingRequest(): PlayRequest | null {
    return this.cursor ? this.request : null;
  }

  /** Creates the audio context and decodes every recorded sound. Safe to call more than once. */
  load(): Promise<void> {
    this.loading ??= this.doLoad();
    return this.loading;
  }

  private async doLoad(): Promise<void> {
    const context = new AudioContext({ latencyHint: 'interactive' });
    const master = context.createGain();
    master.connect(context.destination);
    this.context = context;
    this.master = master;
    this.analysers.set('master', this.makeAnalyser(context, master));
    for (const id of INSTRUMENT_IDS) {
      const gain = context.createGain();
      gain.connect(master);
      this.instrumentGains.set(id, gain);
      this.analysers.set(id, this.makeAnalyser(context, gain));
    }
    this.buffers = await loadBuffers(context);
    this.applyGains();
  }

  private makeAnalyser(context: AudioContext, source: AudioNode): AnalyserNode {
    const analyser = context.createAnalyser();
    analyser.fftSize = this.meterBuffer.length;
    source.connect(analyser);
    return analyser;
  }

  // ---- The project, mixer and metronome ----

  /**
   * Tells the engine the current project. Volume, mute and the master change at once; a tempo change
   * applies from now on; edited notes are picked up without a gap. A meter change stops playback,
   * because the bar lines move under the playhead.
   */
  setProject(project: Project): void {
    const previous = this.project;
    this.project = project;
    this.applyGains();
    if (!this.cursor || !this.context || !previous) return;
    if (previous.meter !== project.meter) {
      this.stop();
      this.stoppedHandler?.();
      return;
    }
    if (previous.bpm !== project.bpm) this.cursor.setBpm(project.bpm, this.context.currentTime);
    const plan = this.buildPlan(project);
    if (plan) this.cursor.replacePlan(plan);
  }

  /** Isolates one instrument (the others fall silent), or none. Not part of the project. */
  setIsolated(id: InstrumentId | null): void {
    this.isolated = id;
    this.applyGains();
  }

  setMetronome(on: boolean): void {
    this.metronome = on;
  }

  private applyGains(): void {
    const context = this.context;
    const project = this.project;
    if (!context || !project || !this.master) return;
    const at = context.currentTime;
    this.master.gain.setTargetAtTime(levelToGain(project.masterVolume), at, GAIN_SMOOTHING_SECONDS);
    for (const id of INSTRUMENT_IDS) {
      this.instrumentGains.get(id)?.gain.setTargetAtTime(instrumentGain(project, this.isolated, id), at, GAIN_SMOOTHING_SECONDS);
    }
  }

  // ---- Playing ----

  private buildPlan(project: Project): Plan | null {
    const request = this.request;
    if (!request) return null;
    return request.mode === 'pattern' ? patternPlan(project, request.focus) : songPlan(project, request.startBar);
  }

  /**
   * Starts playing from the beginning of the request, replacing anything already playing. Returns
   * false when there is nothing to play (an empty song) or the sounds are not loaded yet.
   */
  async play(request: PlayRequest): Promise<boolean> {
    this.stop();
    const generation = this.generation;
    await this.load();
    const context = this.context;
    if (!context || !this.buffers) return false;
    await context.resume();
    // A Stop or another Play came while this one was loading: give up.
    if (generation !== this.generation) return false;
    const project = this.project;
    if (!project) return false;
    this.request = request;
    const plan = this.buildPlan(project);
    if (!plan) return false;
    const cursor = new PlayCursor(plan, context.currentTime + START_DELAY_SECONDS, project.bpm);
    if (cursor.finished) {
      this.request = null;
      return false;
    }
    this.cursor = cursor;
    this.pump();
    this.timer = setInterval(() => this.pump(), TIMER_MS);
    return true;
  }

  /** Stops playback and fades out what is sounding. */
  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
    this.generation += 1;
    this.cursor = null;
    this.request = null;
    const context = this.context;
    if (context) for (const voice of this.voices) voice.stop(context.currentTime);
    this.voices.clear();
  }

  /** Hands the notes that are due in the next fraction of a second to the sound card. */
  private pump(): void {
    const context = this.context;
    const cursor = this.cursor;
    const project = this.project;
    const buffers = this.buffers;
    if (!context || !cursor || !project || !buffers) return;
    const secondsPerTick = 60 / project.bpm / TICKS_PER_QUARTER;
    for (const item of cursor.pull(context.currentTime + LOOKAHEAD_SECONDS)) {
      if (item.kind === 'click') {
        if (this.metronome) this.click(context, item.time, item.click.accent);
        continue;
      }
      const gain = this.instrumentGains.get(item.note.instrument);
      const instrument = project.instruments[item.note.instrument];
      if (!gain) continue;
      const voice = startNote(context, gain, buffers, manifest, item.note, instrument, secondsPerTick, item.time, () =>
        this.voices.delete(voice),
      );
      this.voices.add(voice);
    }
  }

  /**
   * Plays one note now, as a note sounds when it is placed or dragged to another pitch in an editor.
   * It goes through its own gain at the instrument's volume straight to the master, so mute and
   * isolate do not silence it: the user is listening to the note being edited. A Stop fades it out.
   */
  audition(instrument: InstrumentId, sound: Sound, lengthTicks: number): void {
    const context = this.context;
    const buffers = this.buffers;
    const project = this.project;
    const master = this.master;
    if (!context || !buffers || !project || !master) return;
    void context.resume();
    const settings = project.instruments[instrument];
    const gain = context.createGain();
    gain.gain.value = levelToGain(settings.volume);
    gain.connect(master);
    const note: TimelineNote = { tick: 0, instrument, sound, lengthTicks };
    const secondsPerTick = 60 / project.bpm / TICKS_PER_QUARTER;
    try {
      const voice = startNote(context, gain, buffers, manifest, note, settings, secondsPerTick, context.currentTime + 0.005, () => {
        this.voices.delete(voice);
        gain.disconnect();
      });
      this.voices.add(voice);
    } catch {
      // A sound that is not loaded: the note simply makes no sound.
      gain.disconnect();
    }
  }

  private click(context: AudioContext, when: number, accent: boolean): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = accent ? 1500 : 1000;
    gain.gain.setValueAtTime(METRONOME_GAIN, when);
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(when);
    oscillator.stop(when + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }

  // ---- The playhead and the meters ----

  /**
   * Where the playhead is now, or null when stopped. `songTick` counts from the start of the song,
   * in ticks; divide by the bar length for the bar.
   */
  position(): { phase: 'first' | 'loop'; tick: number; songTick: number } | null {
    if (!this.cursor || !this.context) return null;
    return this.cursor.position(this.context.currentTime);
  }

  /** Meter readings from 0 to 1 for each instrument and the master. Call about every animation frame. */
  readLevels(): Levels {
    const now = performance.now();
    const dt = this.lastMeterRead === 0 ? 0 : (now - this.lastMeterRead) / 1000;
    this.lastMeterRead = now;
    for (const [id, analyser] of this.analysers) {
      analyser.getFloatTimeDomainData(this.meterBuffer);
      let peak = 0;
      for (const sample of this.meterBuffer) peak = Math.max(peak, Math.abs(sample));
      this.levels[id] = smoothMeter(this.levels[id], peakToMeter(peak), dt);
    }
    return this.levels;
  }
}
