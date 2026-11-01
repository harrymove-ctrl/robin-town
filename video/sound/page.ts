// Offline 48 kHz stereo audio renderer running inside headless Chromium:
// 1. appCue(): Verbatim WebAudio ports of Robin-Town's src/town/audio.ts, src/ui/audio.ts,
//    and src/ui/ipod-controller.ts (Lehmer LCG seed=7 piezo click, stool clack, deal stamp,
//    3-formant neighbor nod, shop shutter, banknote payday chime, zodiac calendar tear).
// 2. designed(): Tone.js cinema transitions from docs/video/sfx.md.
// 3. score(): Variant A 120 BPM Instrumental ("Saigon Lo-Fi Acoustic Nylon Guitar, Rhodes
//    & Emerald Synth Drop") with exact Drop 1 / Drop 2 hits and 1-beat pre-lockup silence.
import * as Tone from "tone";

const SR = 48000;
type Stereo = [Float32Array, Float32Array];

function toInt16Base64([l, r]: Stereo): string {
  const n = l.length;
  const out = new Int16Array(n * 2);
  for (let i = 0; i < n; i++) {
    out[2 * i] = Math.round(Math.max(-1, Math.min(1, l[i])) * 32767);
    out[2 * i + 1] = Math.round(Math.max(-1, Math.min(1, r[i])) * 32767);
  }
  const bytes = new Uint8Array(out.buffer);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

const stereoOf = (b: AudioBuffer): Stereo => [
  b.getChannelData(0),
  b.getChannelData(b.numberOfChannels > 1 ? 1 : 0),
];

const midiHz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

// ── Layer 1: Verbatim Robin-Town WebAudio Synth Cues ─────────────────────────────────────
async function appCue(spec: { id: string }): Promise<string> {
  const dur = 1.4;
  const ctx = new OfflineAudioContext(2, Math.round(SR * dur), SR);
  const master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);

  const playNote = (
    midi: number,
    offset: number,
    duration: number,
    vol: number,
    type: OscillatorType = "triangle",
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(midiHz(midi), offset);
    g.gain.setValueAtTime(0.0001, offset);
    g.gain.linearRampToValueAtTime(vol, offset + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, offset + duration);
    osc.connect(g).connect(master);
    osc.start(offset);
    osc.stop(offset + duration + 0.02);
  };

  switch (spec.id) {
    case "app-tap": {
      // EFFECTS.tap: [[76, 0, 0.06, 0.25]]
      playNote(76, 0, 0.065, 0.35, "triangle");
      break;
    }
    case "app-stool-clack": {
      // playTilePop() (460 -> 75 Hz 45ms) + EFFECTS.place ([67, 74])
      const pop = ctx.createOscillator();
      const pg = ctx.createGain();
      pop.type = "sine";
      pop.frequency.setValueAtTime(460, 0);
      pop.frequency.exponentialRampToValueAtTime(75, 0.045);
      pg.gain.setValueAtTime(0.45, 0);
      pg.gain.exponentialRampToValueAtTime(0.001, 0.05);
      pop.connect(pg).connect(master);
      pop.start(0);
      pop.stop(0.055);
      playNote(67, 0.005, 0.09, 0.28, "triangle");
      playNote(74, 0.07, 0.12, 0.24, "triangle");
      break;
    }
    case "app-deed-slide": {
      // EFFECTS['deal-open'] ([57, 64, 69]) + 90ms filtered parchment noise
      const nLen = Math.round(SR * 0.11);
      const nBuf = ctx.createBuffer(1, nLen, SR);
      const data = nBuf.getChannelData(0);
      let seed = 19;
      for (let i = 0; i < nLen; i++) {
        seed = (seed * 16807) % 2147483647;
        data[i] = ((seed / 2147483647) * 2 - 1) * Math.sin((Math.PI * i) / nLen);
      }
      const src = ctx.createBufferSource();
      src.buffer = nBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.setValueAtTime(1400, 0);
      bp.frequency.linearRampToValueAtTime(2600, 0.09);
      bp.Q.value = 1.8;
      const ng = ctx.createGain();
      ng.gain.value = 0.22;
      src.connect(bp).connect(ng).connect(master);
      src.start(0);
      playNote(57, 0.01, 0.18, 0.24, "triangle");
      playNote(64, 0.11, 0.2, 0.22, "triangle");
      playNote(69, 0.21, 0.3, 0.2, "triangle");
      break;
    }
    case "app-shop-shutter": {
      // EFFECTS.build: C4 -> E4 -> G4 triad
      playNote(60, 0, 0.15, 0.28, "triangle");
      playNote(64, 0.07, 0.18, 0.25, "triangle");
      playNote(67, 0.14, 0.28, 0.24, "triangle");
      playNote(72, 0.21, 0.34, 0.2, "sine");
      break;
    }
    case "app-deal-stamp": {
      // playDealStamp() (95 -> 32 Hz 150ms escrow thud) + EFFECTS.deal
      const thud = ctx.createOscillator();
      const tg = ctx.createGain();
      thud.type = "sine";
      thud.frequency.setValueAtTime(95, 0);
      thud.frequency.exponentialRampToValueAtTime(32, 0.15);
      tg.gain.setValueAtTime(0.55, 0);
      tg.gain.exponentialRampToValueAtTime(0.001, 0.18);
      thud.connect(tg).connect(master);
      thud.start(0);
      thud.stop(0.19);
      playNote(64, 0.02, 0.14, 0.24, "triangle");
      playNote(67, 0.1, 0.18, 0.23, "triangle");
      playNote(72, 0.18, 0.28, 0.25, "triangle");
      playNote(76, 0.26, 0.42, 0.2, "triangle");
      break;
    }
    case "app-neighbor-nod": {
      // SPEECH.positive 3-formant vowel murmur from src/town/audio.ts:236
      const VOWELS: Record<string, [number, number, number]> = {
        uh: [520, 1190, 2500],
        ah: [740, 1250, 2650],
        eh: [550, 1850, 2650],
        ee: [330, 2250, 3000],
        oo: [370, 850, 2350],
      };
      const phrase: [string, string, number, number, number, number][] = [
        ["eh", "ee", 0, 0.11, 0, 4],
        ["ah", "eh", 0.135, 0.12, 2, 6],
        ["eh", "ee", 0.285, 0.16, 4, 9],
        ["oo", "ee", 0.48, 0.18, 7, 10],
      ];
      const baseMidi = 58;
      const Q = [4.5, 6, 8];
      const W = [1, 0.52, 0.23];
      for (const [v0, v1, off, len, p0, p1] of phrase) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(midiHz(baseMidi + p0), off);
        osc.frequency.linearRampToValueAtTime(midiHz(baseMidi + p1), off + len);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, off);
        env.gain.linearRampToValueAtTime(0.14, off + 0.02);
        env.gain.exponentialRampToValueAtTime(0.0001, off + len);
        for (let k = 0; k < 3; k++) {
          const bp = ctx.createBiquadFilter();
          bp.type = "bandpass";
          bp.Q.value = Q[k];
          bp.frequency.setValueAtTime(VOWELS[v0][k], off);
          bp.frequency.linearRampToValueAtTime(VOWELS[v1][k], off + len);
          const wg = ctx.createGain();
          wg.gain.value = W[k];
          osc.connect(bp).connect(wg).connect(env);
        }
        env.connect(master);
        osc.start(off);
        osc.stop(off + len + 0.02);
      }
      break;
    }
    case "app-payday-chime": {
      // EFFECTS.income ([72, 76, 79, 84]) + sparkling coin harmonics
      playNote(72, 0, 0.22, 0.26, "triangle");
      playNote(76, 0.085, 0.24, 0.25, "triangle");
      playNote(79, 0.17, 0.3, 0.24, "triangle");
      playNote(84, 0.26, 0.5, 0.22, "triangle");
      playNote(96, 0.27, 0.35, 0.1, "sine");
      break;
    }
    case "app-calendar-tear": {
      // Paper tear noise + EFFECTS.year ([60, 64, 67, 72])
      const nLen = Math.round(SR * 0.08);
      const nBuf = ctx.createBuffer(1, nLen, SR);
      const d = nBuf.getChannelData(0);
      let s = 41;
      for (let i = 0; i < nLen; i++) {
        s = (s * 16807) % 2147483647;
        d[i] = ((s / 2147483647) * 2 - 1) * Math.exp(-i / (SR * 0.022));
      }
      const src = ctx.createBufferSource();
      src.buffer = nBuf;
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 1800;
      const ng = ctx.createGain();
      ng.gain.value = 0.28;
      src.connect(hp).connect(ng).connect(master);
      src.start(0);
      playNote(60, 0.02, 0.4, 0.22, "triangle");
      playNote(64, 0.11, 0.4, 0.2, "triangle");
      playNote(67, 0.2, 0.4, 0.2, "triangle");
      playNote(72, 0.32, 0.65, 0.24, "triangle");
      break;
    }
    case "app-ipod-tick": {
      // Verbatim createClickBuffer() from src/ui/ipod-controller.ts:658 (3ms, Lehmer seed=7)
      const length = Math.round(SR * 0.003);
      const buffer = ctx.createBuffer(1, length, SR);
      const data = buffer.getChannelData(0);
      const decay = SR * 0.0007;
      let seed = 7;
      for (let i = 0; i < length; i++) {
        seed = (seed * 16807) % 2147483647;
        const noise = (seed / 2147483647) * 2 - 1;
        data[i] = noise * 0.85 * Math.exp(-i / decay);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(master);
      src.start(0);
      break;
    }
  }

  return toInt16Base64(stereoOf(await ctx.startRendering()));
}

// ── Layer 2: Designed Tone.js Cinema Transitions ─────────────────────────────────────────
async function designed(d: { kind: string; seconds: number; [k: string]: number | string }): Promise<string> {
  const buf = await Tone.Offline(async () => {
    const out = new Tone.Gain(0.9).toDestination();
    const verb = new Tone.Reverb({ decay: (d.decay as number) ?? 1.5, wet: (d.wet as number) ?? 0.26 }).connect(out);
    await verb.ready;
    const sat = new Tone.Distortion({ distortion: 0.1, wet: 0.3 }).connect(verb);
    const t = d.seconds;

    const band = (f0: number, f1: number, peak: number, level: number, color: "pink" | "white" | "brown", q = 1.5) => {
      const n = new Tone.Noise(color);
      const f = new Tone.Filter({ type: "bandpass", frequency: f0, Q: q });
      const g = new Tone.Gain(0.0001);
      const pan = new Tone.Panner(0);
      n.chain(f, g, pan, sat);
      f.frequency.setValueAtTime(f0, 0);
      f.frequency.exponentialRampToValueAtTime(Math.max(40, f1), t);
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.exponentialRampToValueAtTime(level, Math.max(0.015, t * peak));
      g.gain.exponentialRampToValueAtTime(0.0001, t);
      pan.pan.setValueAtTime(-0.4, 0);
      pan.pan.linearRampToValueAtTime(0.4, t);
      n.start(0).stop(t);
    };

    switch (d.kind) {
      case "orb-glass": {
        const s = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 2,
          modulationIndex: 4,
          envelope: { attack: 0.005, decay: 0.55, sustain: 0, release: 0.45 },
        }).connect(verb);
        s.volume.value = -8;
        ["C5", "E5", "G5", "B5"].forEach((note, idx) => s.triggerAttackRelease(note, 0.28, idx * 0.035));
        break;
      }
      case "block-fan": {
        const wood = new Tone.MembraneSynth({
          pitchDecay: 0.012,
          octaves: 2,
          envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.03 },
        }).connect(out);
        wood.volume.value = -6;
        const notes = ["G4", "A4", "C5", "D5", "E5", "G5"];
        notes.forEach((n, idx) => wood.triggerAttackRelease(n, 0.03, idx * 0.028));
        break;
      }
      case "bezel-dive": {
        band(320, 2400, 0.55, 0.75, "pink", 1.4);
        band(900, 380, 0.8, 0.4, "brown", 1.2);
        const sub = new Tone.Oscillator(110, "sine");
        const sg = new Tone.Gain(0.0001).connect(out);
        sub.connect(sg);
        sub.frequency.exponentialRampToValueAtTime(46, t * 0.85);
        sg.gain.exponentialRampToValueAtTime(0.45, t * 0.35);
        sg.gain.exponentialRampToValueAtTime(0.0001, t);
        sub.start(0).stop(t);
        break;
      }
      case "callout-open": {
        const ping = new Tone.Synth({
          oscillator: { type: "sine" },
          envelope: { attack: 0.002, decay: 0.06, sustain: 0, release: 0.04 },
        }).connect(verb);
        ping.volume.value = -10;
        ping.triggerAttackRelease("D6", 0.04, 0);
        break;
      }
      case "orbit-whip": {
        band(420, 3800, 0.85, 0.85, "pink", 1.6);
        break;
      }
      case "riser": {
        band(220, 5600, 0.98, 0.72, "pink", 1.2);
        const o = new Tone.Oscillator(130.81, "triangle"); // C3
        const f = new Tone.Filter(600, "lowpass");
        const g = new Tone.Gain(0.0001);
        o.chain(f, g, sat);
        o.frequency.exponentialRampToValueAtTime(523.25, t); // C5
        f.frequency.exponentialRampToValueAtTime(4200, t);
        g.gain.setValueAtTime(0.0001, 0);
        g.gain.exponentialRampToValueAtTime(0.22, t * 0.97);
        g.gain.linearRampToValueAtTime(0, t);
        o.start(0).stop(t);
        break;
      }
      case "sub-impact": {
        const sub = new Tone.Oscillator(68, "sine");
        const sg = new Tone.Gain(0.85).connect(out);
        sub.connect(sg);
        sub.frequency.setValueAtTime(68, 0);
        sub.frequency.exponentialRampToValueAtTime(34, 0.42);
        sg.gain.setValueAtTime(0.85, 0);
        sg.gain.exponentialRampToValueAtTime(0.0001, 0.55);
        sub.start(0).stop(0.58);
        const kick = new Tone.MembraneSynth({
          pitchDecay: 0.05,
          octaves: 4,
          envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.1 },
        }).connect(sat);
        kick.volume.value = -4;
        kick.triggerAttackRelease("C1", 0.25, 0);
        break;
      }
      case "wif-burn": {
        // Warm ember sizzle + upward resonant shimmer (1.4 kHz -> 5.2 kHz, 380ms)
        band(1400, 5200, 0.45, 0.65, "white", 2.8);
        band(450, 1600, 0.3, 0.45, "pink", 1.5);
        const s = new Tone.PolySynth(Tone.FMSynth, {
          harmonicity: 3,
          modulationIndex: 6,
          envelope: { attack: 0.003, decay: 0.32, sustain: 0, release: 0.25 },
        }).connect(verb);
        s.volume.value = -9;
        ["E5", "G5", "B5", "E6"].forEach((note, idx) => s.triggerAttackRelease(note, 0.16, idx * 0.045));
        break;
      }
    }
  }, d.seconds + 0.6, 2, SR);

  return toInt16Base64(stereoOf(buf.get() as AudioBuffer));
}

// ── Layer 3: Variant A 120 BPM Instrumental Score ────────────────────────────────────────
// Saigon Lo-Fi Fingerpicked Nylon Acoustic Guitar + Warm Fender Rhodes + Tabletop Rimshot/Brushed
// Percussion + Upright Sub-Bass + Lush Warm Emerald Analog Polysynth Drops (C Major / A Dorian).
type SectionName =
  | "intro"
  | "grooveA"
  | "grooveB"
  | "build"
  | "drop1"
  | "breakdown"
  | "drop2"
  | "bridge"
  | "quickstart"
  | "silence"
  | "outro";

interface SectionSpec {
  name: SectionName;
  from: number;
  to: number;
}

const CHORDS_STREET = [
  { root: "C2", voicings: ["C4", "E4", "G4", "B4"], arp: ["C4", "G4", "B4", "E5", "G4", "B4", "E5", "D5"] }, // Cmaj7
  { root: "A1", voicings: ["A3", "C4", "E4", "G4"], arp: ["A3", "E4", "G4", "C5", "E4", "G4", "C5", "B4"] }, // Am7
  { root: "D2", voicings: ["D4", "F4", "A4", "C5"], arp: ["D4", "A4", "C5", "F5", "A4", "C5", "E5", "C5"] }, // Dm9
  { root: "G1", voicings: ["G3", "B3", "D4", "F4"], arp: ["G3", "D4", "F4", "A4", "B4", "G4", "E4", "D4"] }, // G13
];

const CHORDS_BARGAIN = [
  { root: "A1", voicings: ["A3", "C4", "E4", "G4"], arp: ["A3", "E4", "A4", "C5", "B4", "G4", "E4", "C4"] }, // Am7
  { root: "D2", voicings: ["D4", "F4", "A4", "C5"], arp: ["D4", "F4", "A4", "E5", "D5", "C5", "A4", "F4"] }, // Dm9
  { root: "G1", voicings: ["G3", "B3", "E4", "F4"], arp: ["G3", "D4", "E4", "B4", "A4", "G4", "F4", "D4"] }, // G13
  { root: "E1", voicings: ["E3", "G3", "B3", "D4"], arp: ["E3", "B3", "D4", "G4", "F#4", "E4", "D4", "B3"] }, // Em7
];

const CHORDS_DROP = [
  { root: "F1", voicings: ["F3", "A3", "C4", "E4"], arp: ["F4", "A4", "C5", "E5", "G5", "E5", "C5", "A4"] }, // Fmaj9
  { root: "G1", voicings: ["G3", "B3", "D4", "F4"], arp: ["G4", "B4", "D5", "G5", "A5", "G5", "D5", "B4"] }, // G6/9
  { root: "C2", voicings: ["C4", "E4", "G4", "B4"], arp: ["E4", "G4", "B4", "E5", "G5", "E5", "D5", "B4"] }, // Cmaj9
  { root: "A1", voicings: ["A3", "C4", "E4", "G4"], arp: ["A4", "C5", "E5", "G5", "A5", "G5", "E5", "C5"] }, // Am9
];

async function score(sections: SectionSpec[], seconds: number): Promise<string> {
  const BAR_SEC = 2.0; // 120 BPM, 4/4 -> 1 beat = 0.5s, 1 bar = 2.0s
  const BEAT_SEC = 0.5;

  const buf = await Tone.Offline(async ({ transport }) => {
    transport.bpm.value = 120;

    // Master bus with hard silence gate support so [silence] windows are -inf exact zero
    const silenceGate = new Tone.Gain(1).toDestination();
    const limiter = new Tone.Limiter(-1.5).connect(silenceGate);
    const comp = new Tone.Compressor({ threshold: -16, ratio: 2.4, attack: 0.018, release: 0.22 }).connect(limiter);
    // Carve -2.5 dB around 1.8 kHz so UI clicks and chimes cut cleanly
    const midDip = new Tone.Filter({ type: "peaking", frequency: 1800, Q: 1.2, gain: -2.5 }).connect(comp);

    const verb = new Tone.Reverb({ decay: 2.8, wet: 0.25 }).connect(midDip);
    await verb.ready;
    const stereoDelay = new Tone.PingPongDelay({ delayTime: 0.375, feedback: 0.2, wet: 0.16 }).connect(verb);

    // 1. Warm Fender Rhodes Electric Piano
    const rhodesChorus = new Tone.Chorus(1.2, 2.5, 0.35).start().connect(verb);
    const rhodes = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 1,
      modulationIndex: 1.8,
      oscillator: { type: "sine" },
      modulation: { type: "triangle" },
      envelope: { attack: 0.012, decay: 1.1, sustain: 0.35, release: 1.2 },
      modulationEnvelope: { attack: 0.008, decay: 0.35, sustain: 0.05, release: 0.4 },
    }).connect(rhodesChorus);
    rhodes.volume.value = -13;

    // 2. Fingerpicked Saigon Nylon Acoustic Guitar
    const nylonFilter = new Tone.Filter(2600, "lowpass").connect(stereoDelay);
    nylonFilter.connect(midDip);
    const nylon = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: { attack: 0.004, decay: 0.34, sustain: 0.04, release: 0.38 },
    }).connect(nylonFilter);
    nylon.volume.value = -12;

    // 3. Warm Emerald Analog Polysynth (Drops 1 & 2)
    const emeraldFilter = new Tone.Filter(2400, "lowpass").connect(verb);
    const emerald = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "fatsawtooth", count: 3, spread: 20 },
      envelope: { attack: 0.035, decay: 0.6, sustain: 0.65, release: 0.9 },
    }).connect(emeraldFilter);
    emerald.volume.value = -15;

    // 4. Sparkling Bell Pluck on Drop 2
    const bell = new Tone.PolySynth(Tone.FMSynth, {
      harmonicity: 3.0,
      modulationIndex: 5,
      envelope: { attack: 0.002, decay: 0.45, sustain: 0, release: 0.4 },
    }).connect(stereoDelay);
    bell.volume.value = -17;

    // 5. Round Upright / Sub Bass
    const bassFilter = new Tone.Filter(280, "lowpass").connect(midDip);
    const bass = new Tone.MonoSynth({
      oscillator: { type: "triangle" },
      envelope: { attack: 0.01, decay: 0.35, sustain: 0.45, release: 0.25 },
      filterEnvelope: { attack: 0.005, decay: 0.2, sustain: 0.2, baseFrequency: 90, octaves: 1.8 },
    }).connect(bassFilter);
    bass.volume.value = -9;

    // 6. Cozy Lo-Fi Pocket Drums (Kick, Wooden Rimshot, Brushed Snare, Bamboo Shaker)
    const kick = new Tone.MembraneSynth({
      pitchDecay: 0.045,
      octaves: 4.5,
      envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.08 },
    }).connect(midDip);
    kick.volume.value = -8;

    const rim = new Tone.MembraneSynth({
      pitchDecay: 0.008,
      octaves: 1.8,
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.02 },
    }).connect(verb);
    rim.volume.value = -13;

    const brushFilter = new Tone.Filter({ type: "bandpass", frequency: 2400, Q: 1.2 }).connect(verb);
    const brush = new Tone.NoiseSynth({
      noise: { type: "pink" },
      envelope: { attack: 0.004, decay: 0.09, sustain: 0, release: 0.04 },
    }).connect(brushFilter);
    brush.volume.value = -16;

    const shakerFilter = new Tone.Filter({ type: "highpass", frequency: 5200 }).connect(midDip);
    const shaker = new Tone.NoiseSynth({
      noise: { type: "white" },
      envelope: { attack: 0.002, decay: 0.032, sustain: 0, release: 0.015 },
    }).connect(shakerFilter);
    shaker.volume.value = -23;

    for (const sec of sections) {
      const startSec = sec.from * BAR_SEC;
      const endSec = sec.to * BAR_SEC;

      if (sec.name === "silence") {
        // Hard mute all audio and tails to -inf across the 1-beat pre-lockup silence!
        silenceGate.gain.setValueAtTime(1, Math.max(0, startSec - 0.015));
        silenceGate.gain.linearRampToValueAtTime(0, startSec);
        silenceGate.gain.setValueAtTime(0, endSec - 0.002);
        silenceGate.gain.linearRampToValueAtTime(1, endSec + 0.005);
        continue;
      }

      if (sec.name === "outro") {
        // Single warm resolved Cmaj9 acoustic + Rhodes bloom with natural decay to silence
        const t0 = startSec;
        rhodes.triggerAttackRelease(["C3", "E3", "G3", "B3", "D4"], 3.4, t0, 0.85);
        ["C4", "E4", "G4", "B4", "D5", "G5"].forEach((n, idx) => {
          nylon.triggerAttackRelease(n, 2.6, t0 + idx * 0.055, 0.8);
        });
        bass.triggerAttackRelease("C2", 2.8, t0, 0.85);
        // Smooth fade to zero before clip end
        const fadeStart = Math.max(t0 + 1.8, endSec - 1.4);
        silenceGate.gain.setValueAtTime(1, fadeStart);
        silenceGate.gain.linearRampToValueAtTime(0, endSec - 0.05);
        continue;
      }

      // Iterate bar-by-bar inside this section
      const wholeBars = Math.ceil(sec.to - sec.from);
      for (let b = 0; b < wholeBars; b++) {
        const barIndex = Math.floor(sec.from) + b;
        const barStart = (sec.from + b) * BAR_SEC;
        if (barStart >= endSec - 0.05) break;
        const barLimit = Math.min(endSec, barStart + BAR_SEC);

        const palette =
          sec.name === "grooveB"
            ? CHORDS_BARGAIN
            : sec.name === "drop1" || sec.name === "drop2"
              ? CHORDS_DROP
              : CHORDS_STREET;
        const chord = palette[barIndex % palette.length];

        // Rhodes chord on Beat 1 (and warm syncopated anticipation on Beat 3.5 during grooves/drops)
        rhodes.triggerAttackRelease(
          chord.voicings,
          sec.name === "breakdown" || sec.name === "intro" ? 1.85 : 1.35,
          barStart,
          sec.name === "drop1" || sec.name === "drop2" ? 0.78 : 0.62,
        );
        if (
          (sec.name === "grooveA" || sec.name === "grooveB" || sec.name === "drop1" || sec.name === "drop2") &&
          barStart + 1.25 < barLimit - 0.1
        ) {
          rhodes.triggerAttackRelease(chord.voicings, 0.55, barStart + 1.25, 0.42);
        }

        // Emerald Analog Polysynth on Drop 1 & Drop 2
        if (sec.name === "drop1" || sec.name === "drop2") {
          emerald.triggerAttackRelease(chord.voicings, 1.75, barStart, sec.name === "drop2" ? 0.85 : 0.72);
        }

        // Fingerpicked Saigon Nylon Guitar 8th-note pattern
        const playNylon =
          sec.name !== "breakdown" || b >= wholeBars - 2;
        if (playNylon) {
          for (let eighth = 0; eighth < 8; eighth++) {
            const tNote = barStart + eighth * 0.25;
            if (tNote >= barLimit - 0.04) break;
            if (sec.name === "intro" && eighth % 2 === 1 && b < 2) continue;
            const vel = eighth % 2 === 0 ? 0.68 : 0.46;
            nylon.triggerAttackRelease(chord.arp[eighth % chord.arp.length], 0.22, tNote, vel);
            if (sec.name === "drop2" && eighth % 2 === 0) {
              bell.triggerAttackRelease(chord.arp[(eighth + 2) % chord.arp.length], 0.18, tNote, 0.45);
            }
          }
        }

        // Upright / Sub Bassline
        if (sec.name !== "intro" && sec.name !== "build") {
          const bassHits: [number, number, string][] =
            sec.name === "breakdown" || sec.name === "quickstart"
              ? [[0, 0.9, chord.root]]
              : [
                  [0, 0.42, chord.root],
                  [0.75, 0.22, chord.root],
                  [1.0, 0.42, chord.root],
                  [1.75, 0.2, chord.voicings[2].replace(/[345]/, "2")],
                ];
          for (const [off, dur, note] of bassHits) {
            if (barStart + off < barLimit - 0.05) {
              bass.triggerAttackRelease(note, dur, barStart + off, 0.8);
            }
          }
        }

        // Drums & Tabletop Percussion
        if (sec.name === "intro") {
          // Gentle shaker pulse on beats 1 and 3
          if (barStart < barLimit) shaker.triggerAttackRelease(0.03, barStart, 0.4);
          if (barStart + 1.0 < barLimit) shaker.triggerAttackRelease(0.03, barStart + 1.0, 0.35);
        } else if (sec.name === "build") {
          // Rising snare/rimshot build toward the drop
          const subdiv = b === wholeBars - 1 ? 8 : 4;
          const step = BAR_SEC / subdiv;
          for (let k = 0; k < subdiv; k++) {
            const tk = barStart + k * step;
            if (tk >= barLimit - 0.03) break;
            const v = 0.3 + 0.55 * ((b + k / subdiv) / wholeBars);
            rim.triggerAttackRelease("C4", 0.03, tk, v);
            shaker.triggerAttackRelease(0.025, tk, v * 0.7);
          }
        } else if (sec.name !== "breakdown") {
          // Pocket lo-fi groove (grooveA, grooveB, drop1, drop2, bridge, quickstart)
          const isDrop = sec.name === "drop1" || sec.name === "drop2";
          const kickOffsets = isDrop ? [0, 0.75, 1.0, 1.5] : [0, 1.0, 1.625];
          for (const ko of kickOffsets) {
            if (barStart + ko < barLimit - 0.04) {
              kick.triggerAttackRelease("C1", 0.18, barStart + ko, isDrop ? 0.9 : 0.72);
            }
          }
          // Crisp wooden rimshot + brushed snare on Beats 2 and 4 (+ syncopated 1.25 ghost note in grooveB)
          const rimHits: [number, string, number, number, boolean][] =
            sec.name === "grooveB"
              ? [
                  [0.5, "D4", 0.035, 0.72, false],
                  [1.25, "G4", 0.025, 0.48, false],
                  [1.5, "D4", 0.035, 0.72, false],
                ]
              : [
                  [0.5, "D4", 0.035, 0.72, isDrop || sec.name === "grooveA" || sec.name === "bridge"],
                  [1.5, "D4", 0.035, 0.72, isDrop || sec.name === "grooveA" || sec.name === "bridge"],
                ];
          for (const [so, note, dur, vel, withBrush] of rimHits) {
            if (barStart + so < barLimit - 0.04) {
              rim.triggerAttackRelease(note, dur, barStart + so, vel);
              if (withBrush) {
                brush.triggerAttackRelease(0.07, barStart + so, isDrop ? 0.75 : 0.5);
              }
            }
          }
          // 8th-note bamboo shaker
          for (let eighth = 0; eighth < 8; eighth++) {
            const ts = barStart + eighth * 0.25;
            if (ts >= barLimit - 0.03) break;
            shaker.triggerAttackRelease(0.025, ts, eighth % 2 === 0 ? 0.55 : 0.32);
          }
        }
      }
    }
  }, seconds, 2, SR);

  return toInt16Base64(stereoOf(buf.get() as AudioBuffer));
}

(window as unknown as { sound: unknown }).sound = { SR, appCue, designed, score };
