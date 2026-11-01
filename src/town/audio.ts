/* Original synthesized lo-fi score and effects. No samples, recordings, or remote requests. */

export type AudioPhase = 'receive' | 'trade' | 'build' | 'income' | 'ended';
export type SoundEffect =
  'tap' | 'place' | 'build' | 'phase' | 'deal-open' | 'deal' | 'reject' | 'income' | 'year';
export type BotMood = 'positive' | 'negative' | 'thinking';

export interface AudioSettings {
  sfx: boolean;
  music: boolean;
  phase: AudioPhase;
  trading: boolean;
  available: boolean;
}

export interface GameAudio {
  unlock(): Promise<boolean>;
  setSfx(value: boolean): void;
  setMusic(value: boolean): void;
  setPhase(value: AudioPhase): void;
  setTrading(value: boolean): void;
  play(kind?: SoundEffect): void;
  speak(mood?: BotMood, person?: number): void;
  getSettings(): AudioSettings;
  destroy(): void;
}

export interface AudioParameterPort {
  value: number;
  setValueAtTime(value: number, time: number): void;
  exponentialRampToValueAtTime(value: number, time: number): void;
  setTargetAtTime(value: number, time: number, constant: number): void;
  cancelScheduledValues(time: number): void;
}

export interface AudioNodePort {
  connect(destination: AudioNodePort): void;
  disconnect(): void;
}

export interface GainPort extends AudioNodePort {
  gain: AudioParameterPort;
}
export interface FilterPort extends AudioNodePort {
  type: BiquadFilterType;
  frequency: AudioParameterPort;
  Q: AudioParameterPort;
}
export interface AudioBufferPort {
  getChannelData(channel: number): Float32Array;
}
export interface SourcePort extends AudioNodePort {
  onended: ((event: Event) => void) | null;
  start(time?: number): void;
  stop(time?: number): void;
}
export interface OscillatorPort extends SourcePort {
  type: OscillatorType;
  frequency: AudioParameterPort;
}
export interface BufferSourcePort extends SourcePort {
  buffer: AudioBufferPort | null;
}

export interface GameAudioContext {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: 'suspended' | 'running' | 'closed' | 'interrupted';
  readonly destination: AudioNodePort;
  onstatechange: ((event: Event) => void) | null;
  createGain(): GainPort;
  createBiquadFilter(): FilterPort;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBufferPort;
  createOscillator(): OscillatorPort;
  createBufferSource(): BufferSourcePort;
  resume(): Promise<void>;
  suspend(): Promise<void>;
  close(): Promise<void>;
}

export type GameAudioContextConstructor = new () => GameAudioContext;
export interface GameAudioOptions {
  onChange?: (settings: AudioSettings) => void;
  AudioContext?: GameAudioContextConstructor;
}

type Chord = readonly [number, number, number, number];
type Four<T> = readonly [T, T, T, T];
interface PhaseScore {
  beat: number;
  chords: Four<Chord>;
  lead: Four<0 | 1 | 2 | 3>;
  tone: OscillatorType;
  cutoff: number;
}

const PHASES: Record<AudioPhase | 'bargain', PhaseScore> = {
  receive: {
    beat: 0.34,
    chords: [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [62, 65, 69, 72],
      [55, 59, 62, 65],
    ],
    lead: [0, 2, 1, 3],
    tone: 'triangle',
    cutoff: 1400,
  },
  trade: {
    beat: 0.3,
    chords: [
      [57, 60, 64, 67],
      [62, 65, 69, 72],
      [55, 59, 62, 65],
      [64, 67, 71, 74],
    ],
    lead: [2, 0, 3, 1],
    tone: 'triangle',
    cutoff: 1250,
  },
  build: {
    beat: 0.37,
    chords: [
      [60, 64, 67, 69],
      [65, 69, 72, 76],
      [62, 65, 69, 72],
      [55, 59, 62, 69],
    ],
    lead: [0, 1, 2, 1],
    tone: 'sine',
    cutoff: 1100,
  },
  income: {
    beat: 0.31,
    chords: [
      [65, 69, 72, 76],
      [67, 71, 74, 77],
      [60, 64, 67, 71],
      [60, 64, 67, 72],
    ],
    lead: [0, 2, 3, 2],
    tone: 'triangle',
    cutoff: 1550,
  },
  ended: {
    beat: 0.42,
    chords: [
      [60, 64, 67, 71],
      [65, 69, 72, 76],
      [62, 65, 69, 72],
      [60, 64, 67, 72],
    ],
    lead: [3, 2, 1, 0],
    tone: 'sine',
    cutoff: 1000,
  },
  bargain: {
    beat: 0.27,
    chords: [
      [57, 60, 64, 67],
      [57, 60, 64, 71],
      [53, 57, 60, 64],
      [52, 56, 59, 62],
    ],
    lead: [2, 1, 3, 0],
    tone: 'triangle',
    cutoff: 1750,
  },
};

type EffectNote = readonly [midi: number, offset: number, duration: number, volume: number];
const EFFECTS: Record<SoundEffect, readonly EffectNote[]> = {
  tap: [[76, 0, 0.06, 0.1]],
  place: [
    [67, 0, 0.09, 0.16],
    [74, 0.065, 0.12, 0.12],
  ],
  build: [
    [60, 0, 0.13, 0.16],
    [64, 0.07, 0.16, 0.14],
    [67, 0.14, 0.24, 0.13],
  ],
  phase: [
    [60, 0, 0.18, 0.12],
    [67, 0.1, 0.25, 0.14],
    [72, 0.2, 0.4, 0.12],
  ],
  'deal-open': [
    [57, 0, 0.18, 0.14],
    [64, 0.1, 0.2, 0.12],
    [69, 0.2, 0.3, 0.11],
  ],
  deal: [
    [64, 0, 0.13, 0.14],
    [67, 0.08, 0.17, 0.13],
    [72, 0.16, 0.28, 0.14],
    [76, 0.24, 0.4, 0.11],
  ],
  reject: [
    [64, 0, 0.16, 0.1],
    [60, 0.1, 0.22, 0.1],
  ],
  income: [
    [72, 0, 0.18, 0.13],
    [76, 0.085, 0.2, 0.12],
    [79, 0.17, 0.26, 0.11],
    [84, 0.26, 0.45, 0.09],
  ],
  year: [
    [60, 0, 0.4, 0.12],
    [64, 0.09, 0.4, 0.1],
    [67, 0.18, 0.4, 0.1],
    [72, 0.3, 0.65, 0.13],
  ],
};

const VOWELS = {
  uh: [520, 1190, 2500],
  ah: [740, 1250, 2650],
  eh: [550, 1850, 2650],
  ee: [330, 2250, 3000],
  oo: [370, 850, 2350],
} as const;
type Vowel = keyof typeof VOWELS;
type SpeechSyllable = readonly [
  from: Vowel,
  to: Vowel,
  offset: number,
  duration: number,
  pitchFrom: number,
  pitchTo: number,
];
type SpeechPhrase = readonly [SpeechSyllable, ...SpeechSyllable[]];
const SPEECH: Record<BotMood, SpeechPhrase> = {
  positive: [
    ['eh', 'ee', 0, 0.11, 0, 4],
    ['ah', 'eh', 0.135, 0.12, 2, 6],
    ['eh', 'ee', 0.285, 0.16, 4, 9],
    ['oo', 'ee', 0.48, 0.18, 7, 10],
  ],
  negative: [
    ['uh', 'eh', 0, 0.18, 0, 2],
    ['uh', 'oo', 0.255, 0.14, -1, -4],
    ['ah', 'uh', 0.455, 0.12, -2, -5],
    ['uh', 'oo', 0.615, 0.19, -4, -8],
  ],
  thinking: [
    ['oo', 'uh', 0, 0.18, -3, -1],
    ['uh', 'oo', 0.23, 0.22, -1, -4],
  ],
};
const PERSONAS = [
  { base: 56, scale: 1.02 },
  { base: 58, scale: 1.12 },
  { base: 51, scale: 0.9 },
  { base: 55, scale: 1.02 },
] as const;
const FORMANT_Q = [4.5, 6, 8] as const;
const FORMANT_WEIGHT = [1, 0.52, 0.23] as const;
const HZ = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

function safeRead(key: string, fallback = false): boolean {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value == null ? fallback : value === 'on';
  } catch {
    return fallback;
  }
}
function safeWrite(key: string, value: boolean): void {
  try {
    globalThis.localStorage?.setItem(key, value ? 'on' : 'off');
  } catch {}
}

interface ManagedVoice {
  source: SourcePort;
  gain: GainPort;
  filter: FilterPort;
  nodes?: AudioNodePort[];
  music: boolean;
  speech?: boolean;
}
interface VoiceOptions {
  midi?: number;
  at?: number;
  duration?: number;
  volume?: number;
  type?: OscillatorType;
  cutoff?: number;
  isMusic?: boolean;
  noise?: boolean;
  slide?: number;
}
interface SyllableOptions {
  from: Vowel;
  to: Vowel;
  at: number;
  duration: number;
  base: number;
  pitchFrom: number;
  pitchTo: number;
  formantScale: number;
  emphasis: number;
}
type CueInput = { type: 'play'; args: [SoundEffect] } | { type: 'speak'; args: [BotMood, number] };
type PendingCue = CueInput & { expires: number };

export function createGameAudio({
  onChange,
  AudioContext: ContextOverride,
}: GameAudioOptions = {}): GameAudio {
  let sfx = safeRead('robintown-sound', true);
  let music = safeRead('robintown-music', true);
  let ctx: GameAudioContext | null = null;
  let musicBus: GainPort | null = null;
  let effectsBus: GainPort | null = null;
  let noiseBuffer: AudioBufferPort | null = null;
  let timer: ReturnType<typeof globalThis.setInterval> | null = null;
  let phase: AudioPhase = 'receive';
  let trading = false,
    unlocked = false,
    destroyed = false;
  let step = 0,
    nextBeat = 0,
    previousTap = -1,
    transportGeneration = 0;
  const voices = new Set<ManagedVoice>();
  let resumePromise: Promise<void> | null = null;
  const pendingCues: PendingCue[] = [];
  const doc = globalThis.document;
  const visible = (): boolean => !doc?.hidden;
  const enabled = (): boolean => sfx || music;
  const audioGlobals: {
    AudioContext?: GameAudioContextConstructor;
    webkitAudioContext?: GameAudioContextConstructor;
  } = globalThis;
  const audioConstructor = (): GameAudioContextConstructor | undefined =>
    ContextOverride || audioGlobals.AudioContext || audioGlobals.webkitAudioContext;
  const settings = (): AudioSettings => ({
    sfx,
    music,
    phase,
    trading,
    available: Boolean(audioConstructor()),
  });

  function notify(): void {
    try {
      onChange?.(settings());
    } catch {}
  }

  function ensureContext(): boolean {
    if (ctx || !unlocked || destroyed) return Boolean(ctx);
    const Audio = audioConstructor();
    if (!Audio) return false;
    try {
      ctx = new Audio();
      const master = ctx.createGain();
      master.gain.value = 0.66;
      master.connect(ctx.destination);
      musicBus = ctx.createGain();
      musicBus.gain.value = 0.28;
      musicBus.connect(master);
      effectsBus = ctx.createGain();
      effectsBus.gain.value = 0.34;
      effectsBus.connect(master);
      noiseBuffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.12), ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      ctx.onstatechange = () => {
        if (ctx?.state !== 'running') {
          stopTransport();
          return;
        }
        if (!unlocked || !visible() || !enabled()) {
          void sync();
          return;
        }
        if (music && !destroyed) startTransport();
        flushCues();
      };
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function release(item: ManagedVoice): void {
    voices.delete(item);
    for (const node of item.nodes || [item.source, item.gain, item.filter]) {
      try {
        node.disconnect();
      } catch {}
    }
  }

  function fadeVoice(item: ManagedVoice, time = 0.06): void {
    if (!ctx) return;
    const now = ctx.currentTime;
    try {
      item.gain.gain.cancelScheduledValues(now);
      item.gain.gain.setTargetAtTime(0, now, time / 3);
      item.source.stop(now + time);
    } catch {}
  }

  function stopMusicVoices(): void {
    for (const item of voices) if (item.music) fadeVoice(item, 0.12);
  }

  function voice(options: VoiceOptions): void {
    if (!ctx || !musicBus || !effectsBus || !noiseBuffer || destroyed) return;
    const {
      midi = 60,
      at = ctx.currentTime,
      duration = 0.25,
      volume = 0.2,
      type = 'sine',
      cutoff = 1700,
      isMusic = false,
      noise = false,
      slide,
    } = options;
    if (voices.size >= 96) {
      const oldest = voices.values().next().value;
      if (oldest) {
        fadeVoice(oldest, 0.01);
        release(oldest);
      }
    }
    let source: SourcePort;
    if (noise) {
      const bufferSource = ctx.createBufferSource();
      bufferSource.buffer = noiseBuffer;
      source = bufferSource;
    } else {
      const oscillator = ctx.createOscillator();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(HZ(midi), at);
      if (slide !== undefined)
        oscillator.frequency.exponentialRampToValueAtTime(HZ(slide), at + duration * 0.7);
      source = oscillator;
    }
    const gain = ctx.createGain(),
      filter = ctx.createBiquadFilter();
    filter.type = noise ? 'highpass' : 'lowpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), at + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(isMusic ? musicBus : effectsBus);
    const item: ManagedVoice = { source, gain, filter, music: isMusic };
    voices.add(item);
    source.onended = () => release(item);
    source.start(at);
    source.stop(at + duration + 0.03);
  }

  function scheduleBeat(index: number, at: number): void {
    const score = PHASES[trading ? 'bargain' : phase];
    const chord = score.chords[Math.floor(index / 16) % 4] ?? score.chords[0];
    const pos = index % 16;
    const shared = { at, isMusic: true };
    if (pos % 8 === 0) {
      chord.forEach((midi, i) =>
        voice({
          ...shared,
          at: at + i * 0.021,
          midi,
          duration: score.beat * 7.7,
          volume: 0.082,
          type: score.tone,
          cutoff: score.cutoff,
        }),
      );
      voice({
        ...shared,
        midi: chord[0] - 24,
        duration: score.beat * 3.6,
        volume: 0.25,
        cutoff: 450,
      });
    }
    if (pos % 4 === 0)
      voice({ ...shared, midi: 43, slide: 25, duration: 0.13, volume: 0.23, cutoff: 240 });
    if (pos % 4 === 2)
      voice({ ...shared, noise: true, duration: 0.055, volume: 0.035, cutoff: 2400 });
    if (pos % 2 === 1)
      voice({ ...shared, noise: true, duration: 0.027, volume: 0.018, cutoff: 6500 });
    if (pos % (trading ? 2 : 4) === 1) {
      const leadIndex = score.lead[Math.floor(pos / 4)] ?? score.lead[0];
      const note = chord[leadIndex] + (trading ? 12 : 0);
      voice({
        ...shared,
        midi: note,
        duration: trading ? 0.25 : 0.5,
        volume: trading ? 0.095 : 0.07,
        type: 'triangle',
        cutoff: 2200,
      });
    }
  }

  function tick(): void {
    if (!ctx || ctx.state !== 'running' || !music || !visible() || destroyed) {
      stopTransport();
      return;
    }
    if (nextBeat < ctx.currentTime - 0.2) nextBeat = ctx.currentTime + 0.06;
    while (nextBeat < ctx.currentTime + 0.16) {
      scheduleBeat(step++, nextBeat);
      const swing = step % 2 ? 1.07 : 0.93;
      nextBeat += PHASES[trading ? 'bargain' : phase].beat * swing;
    }
  }

  function stopTransport(): void {
    if (timer !== null) globalThis.clearInterval(timer);
    timer = null;
  }

  function startTransport(): void {
    if (timer !== null || !ctx || ctx.state !== 'running' || !music || !visible() || destroyed)
      return;
    nextBeat = ctx.currentTime + 0.08;
    timer = globalThis.setInterval(tick, 90);
    tick();
  }

  function restartScore(): void {
    stopTransport();
    stopMusicVoices();
    step = 0;
    startTransport();
  }

  function queueCue(cue: CueInput): void {
    if (!sfx || !unlocked || !visible() || destroyed || !ctx) return;
    if (cue.type === 'speak' || cue.args[0] === 'tap') {
      const previous = pendingCues.findIndex(
        (pending) =>
          pending.type === cue.type && (cue.type === 'speak' || pending.args[0] === 'tap'),
      );
      if (previous >= 0) pendingCues.splice(previous, 1);
    }
    pendingCues.push({ ...cue, expires: Date.now() + 700 });
    if (pendingCues.length > 8) pendingCues.shift();
  }

  function flushCues(): void {
    if (ctx?.state !== 'running') return;
    const cues = pendingCues.splice(0);
    if (!sfx || !visible() || destroyed) return;
    for (const cue of cues) {
      if (cue.expires < Date.now()) continue;
      if (cue.type === 'speak') speak(...cue.args);
      else play(...cue.args);
    }
  }

  function resumeContext(): Promise<void> {
    if (!ctx) return Promise.resolve();
    if (!resumePromise) {
      try {
        resumePromise = Promise.resolve(ctx.resume())
          .catch(() => {})
          .finally(() => {
            resumePromise = null;
          });
      } catch {
        return Promise.resolve();
      }
    }
    return resumePromise;
  }

  async function sync(): Promise<void> {
    const generation = ++transportGeneration;
    if (destroyed) return;
    if (!unlocked || !visible() || !enabled()) {
      pendingCues.length = 0;
      stopTransport();
      for (const item of voices) fadeVoice(item);
      if (ctx?.state === 'running') {
        try {
          await ctx.suspend();
        } catch {}
      }
      return;
    }
    if (!ctx) return;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') await resumeContext();
    if (destroyed || generation !== transportGeneration || !visible()) return;
    if (music) startTransport();
    else {
      stopTransport();
      stopMusicVoices();
    }
    flushCues();
  }

  function play(kind: SoundEffect = 'tap'): void {
    if (!sfx || !unlocked || !visible() || destroyed || !ctx) return;
    if (ctx.state !== 'running') {
      queueCue({ type: 'play', args: [kind] });
      return;
    }
    const now = ctx.currentTime;
    if (kind === 'tap' && now - previousTap < 0.045) return;
    if (kind === 'tap') previousTap = now;
    (EFFECTS[kind] || EFFECTS.tap).forEach(([midi, offset, duration, volume]) => {
      voice({ midi, at: now + offset, duration, volume, type: 'triangle', cutoff: 2700 });
    });
  }

  function stopSpeech(): void {
    for (const item of voices) if (item.speech) fadeVoice(item, 0.025);
  }

  function duckMusic(until: number): void {
    if (!ctx || !musicBus) return;
    const now = ctx.currentTime,
      gain = musicBus.gain;
    gain.cancelScheduledValues(now);
    gain.setTargetAtTime(0.09, now, 0.025);
    gain.setTargetAtTime(0.28, until + 0.05, 0.12);
  }

  function syllable({
    from,
    to,
    at,
    duration,
    base,
    pitchFrom,
    pitchTo,
    formantScale,
    emphasis,
  }: SyllableOptions): void {
    if (!ctx || !effectsBus) return;
    const source = ctx.createOscillator(),
      gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3700 * formantScale;
    filter.Q.value = 0.45;
    source.type = 'sawtooth';
    source.frequency.setValueAtTime(HZ(base + pitchFrom), at);
    source.frequency.exponentialRampToValueAtTime(HZ(base + pitchTo), at + duration * 0.72);
    source.frequency.exponentialRampToValueAtTime(HZ(base + pitchTo - 0.7), at + duration);
    source.connect(filter);
    const nodes: AudioNodePort[] = [source, filter, gain];
    for (const index of [0, 1, 2] as const) {
      const formant = ctx.createBiquadFilter(),
        weight = ctx.createGain();
      formant.type = 'bandpass';
      formant.Q.value = FORMANT_Q[index];
      formant.frequency.setValueAtTime(VOWELS[from][index] * formantScale, at);
      formant.frequency.exponentialRampToValueAtTime(
        VOWELS[to][index] * formantScale,
        at + duration * 0.85,
      );
      weight.gain.value = FORMANT_WEIGHT[index];
      filter.connect(formant);
      formant.connect(weight);
      weight.connect(gain);
      nodes.push(formant, weight);
    }
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.64 * emphasis, at + 0.018);
    gain.gain.setTargetAtTime(0.48 * emphasis, at + duration * 0.4, 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.connect(effectsBus);
    const item: ManagedVoice = { source, gain, filter, nodes, music: false, speech: true };
    voices.add(item);
    source.onended = () => release(item);
    source.start(at);
    source.stop(at + duration + 0.02);
  }

  function speak(mood: BotMood = 'positive', person = 1): void {
    if (!sfx || !unlocked || !visible() || destroyed || !ctx) return;
    if (ctx.state !== 'running') {
      queueCue({ type: 'speak', args: [mood, person] });
      return;
    }
    stopSpeech();
    const phrase = SPEECH[mood] || SPEECH.thinking;
    const { base, scale } = PERSONAS[person] || PERSONAS[1];
    const now = ctx.currentTime + 0.025;
    const last = phrase[phrase.length - 1] ?? phrase[0];
    duckMusic(now + last[2] + last[3]);
    phrase.forEach(([from, to, offset, duration, pitchFrom, pitchTo], index) => {
      syllable({
        from,
        to,
        at: now + offset,
        duration,
        base,
        pitchFrom,
        pitchTo,
        formantScale: scale,
        emphasis: index === 0 ? 1 : 0.85,
      });
    });
  }

  const visibilityChange = (): void => {
    void sync();
  };
  doc?.addEventListener('visibilitychange', visibilityChange);

  return {
    async unlock(): Promise<boolean> {
      if (destroyed) return false;
      unlocked = true;
      ensureContext();
      await sync();
      return ctx?.state === 'running';
    },
    setSfx(value: boolean): void {
      sfx = Boolean(value);
      safeWrite('robintown-sound', sfx);
      if (!sfx) {
        pendingCues.length = 0;
        for (const item of voices) if (!item.music) fadeVoice(item);
      }
      notify();
      void sync();
    },
    setMusic(value: boolean): void {
      music = Boolean(value);
      safeWrite('robintown-music', music);
      notify();
      void sync();
    },
    setPhase(value: AudioPhase): void {
      if (Object.hasOwn(PHASES, value) && String(value) !== 'bargain' && phase !== value) {
        phase = value;
        if (!trading) restartScore();
      }
    },
    setTrading(value: boolean): void {
      value = Boolean(value);
      if (trading !== value) {
        trading = value;
        restartScore();
      }
    },
    play,
    speak,
    getSettings: settings,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      transportGeneration++;
      pendingCues.length = 0;
      stopTransport();
      doc?.removeEventListener('visibilitychange', visibilityChange);
      for (const item of voices) {
        try {
          item.source.stop();
        } catch {}
        release(item);
      }
      if (ctx) {
        ctx.onstatechange = null;
        void ctx.close().catch(() => {});
      }
    },
  };
}
