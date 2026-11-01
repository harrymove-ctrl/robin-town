/**
 * src/ui/audio.ts
 *
 * Procedural Web Audio API synthesizer for robin-town.
 * Synthesizes tile placement pops, coin payout arpeggios, deal stamp thuds,
 * phase transition fanfares, and error buzzers with zero external audio assets.
 * Resilient to headless and Node.js testing environments.
 */

export interface AudioSettings {
  volume: number;
  muted: boolean;
}

const STORAGE_KEY = 'robin_town_audio_config';
const DEFAULT_SETTINGS: AudioSettings = {
  volume: 0.7,
  muted: false,
};

export interface PhaseTrackSpec {
  beatDuration: number;
  chords: number[][];
  waveType: OscillatorType;
  filterCutoff: number;
}

export const PHASE_TRACKS: Record<string, PhaseTrackSpec> = {
  receive: {
    beatDuration: 0.34,
    chords: [
      [60, 64, 67, 71],
      [57, 60, 64, 67],
      [62, 65, 69, 72],
      [55, 59, 62, 65],
    ],
    waveType: 'triangle',
    filterCutoff: 1400,
  },
  trade: {
    beatDuration: 0.30,
    chords: [
      [57, 60, 64, 67],
      [62, 65, 69, 72],
      [55, 59, 62, 65],
      [64, 67, 71, 74],
    ],
    waveType: 'triangle',
    filterCutoff: 1250,
  },
  build: {
    beatDuration: 0.37,
    chords: [
      [60, 64, 67, 69],
      [65, 69, 72, 76],
      [62, 65, 69, 72],
      [55, 59, 62, 69],
    ],
    waveType: 'sine',
    filterCutoff: 1100,
  },
  income: {
    beatDuration: 0.31,
    chords: [
      [65, 69, 72, 76],
      [67, 71, 74, 77],
      [60, 64, 67, 71],
      [60, 64, 67, 72],
    ],
    waveType: 'triangle',
    filterCutoff: 1550,
  },
  ended: {
    beatDuration: 0.42,
    chords: [
      [60, 64, 67, 71],
      [65, 69, 72, 76],
      [62, 65, 69, 72],
      [60, 64, 67, 72],
    ],
    waveType: 'sine',
    filterCutoff: 1000,
  },
};

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Procedural audio synthesizer utilizing Web Audio API nodes.
 */
export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private settings: AudioSettings;
  private activeTrackOscillators: OscillatorNode[] = [];
  private isTrackPlayingState = false;

  constructor() {
    this.settings = this.loadSettings();
  }

  /**
   * Lazily initializes AudioContext upon first user interaction.
   */
  public initContext(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {
          // Autoplay policy may reject if gesture is not valid yet
        });
      }
      return this.ctx;
    }

    if (typeof window === 'undefined') {
      return null;
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      return null;
    }

    try {
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(
        this.settings.muted ? 0 : this.settings.volume,
        this.ctx.currentTime
      );
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
      this.masterGain = null;
    }

    return this.ctx;
  }

  public isMuted(): boolean {
    return this.settings.muted;
  }

  public setMuted(muted: boolean): void {
    this.settings.muted = muted;
    this.saveSettings();
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(
        muted ? 0 : this.settings.volume,
        this.ctx.currentTime
      );
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.settings.muted);
    return this.settings.muted;
  }

  public getVolume(): number {
    return this.settings.volume;
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this.settings.volume = clamped;
    this.saveSettings();
    if (this.masterGain && this.ctx && !this.settings.muted) {
      this.masterGain.gain.setValueAtTime(clamped, this.ctx.currentTime);
    }
  }

  /**
   * Sound cue: Ceramic tile placement pop.
   */
  public playTilePop(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(460, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.04);

      gain.gain.setValueAtTime(0.5, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore audio synthesis errors in non-standard browsers
    }
  }

  /**
   * Sound cue: Coin payout chime arpeggio.
   */
  public playCoinChime(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      // Notes: E5 (659.25Hz), G#5 (830.61Hz), B5 (987.77Hz), E6 (1318.51Hz)
      const notes = [659.25, 830.61, 987.77, 1318.51];
      const step = 0.055;

      notes.forEach((freq, idx) => {
        const start = now + idx * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(start);
        osc.stop(start + 0.22);
      });
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Sound cue: Heavy escrow deal stamp thud.
   */
  public playDealStamp(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Sound cue: Phase progression flourish.
   */
  public playPhaseFanfare(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      // C4 (261.63Hz), E4 (329.63Hz), G4 (392.00Hz), C5 (523.25Hz)
      const notes = [261.63, 329.63, 392.0, 523.25];
      const step = 0.06;

      notes.forEach((freq, idx) => {
        const start = now + idx * step;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(start);
        osc.stop(start + 0.24);
      });
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Sound cue: Celebratory epoch completion fanfare.
   */
  public playYearFanfare(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      // Ascending triad: G4 (392Hz), C5 (523.25Hz), E5 (659.25Hz)
      const notes = [392.0, 523.25, 659.25];
      notes.forEach((freq, idx) => {
        const start = now + idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, start);

        gain.gain.setValueAtTime(0.001, start);
        gain.gain.linearRampToValueAtTime(0.3, start + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(start);
        osc.stop(start + 0.22);
      });

      // Final sustained chord at t = 0.25s: C5, E5, G5
      const chordStart = now + 0.25;
      const chord = [523.25, 659.25, 783.99];
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, chordStart);

        gain.gain.setValueAtTime(0.001, chordStart);
        gain.gain.linearRampToValueAtTime(0.25, chordStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.8);

        osc.connect(gain);
        gain.connect(this.masterGain!);

        osc.start(chordStart);
        osc.stop(chordStart + 0.85);
      });
    } catch {
      // Ignore audio synthesis errors
    }
  }

  public playGameOverFanfare(): void {
    this.playYearFanfare();
  }

  /**
   * Sound cue: Negative rejection / invalid placement buzzer.
   */
  public playErrorBuzzer(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(175, now);
      osc.frequency.linearRampToValueAtTime(115, now + 0.14);

      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  /**
   * Sound cue: Light UI navigation click.
   */
  public playClick(): void {
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch {
      // Ignore audio synthesis errors
    }
  }

  public playPhaseTrack(phase: string): void {
    this.stopPhaseTrack();
    const spec = PHASE_TRACKS[phase] || PHASE_TRACKS.receive;
    const ctx = this.initContext();
    if (!ctx || !this.masterGain || this.settings.muted) return;

    try {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(spec.filterCutoff, ctx.currentTime);
      filter.connect(this.masterGain);

      const now = ctx.currentTime;
      const chord = spec.chords[0] || [60, 64, 67];

      chord.forEach((midi) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = spec.waveType;
        osc.frequency.setValueAtTime(midiToFrequency(midi), now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, now + spec.beatDuration * 2);

        osc.connect(gain);
        gain.connect(filter);

        osc.start(now);
        osc.stop(now + spec.beatDuration * 2);
        this.activeTrackOscillators.push(osc);
      });

      this.isTrackPlayingState = true;
    } catch {
      // Safe no-op in headless
    }
  }

  public stopPhaseTrack(): void {
    this.activeTrackOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Safe no-op
      }
    });
    this.activeTrackOscillators = [];
    this.isTrackPlayingState = false;
  }

  public isPhaseTrackPlaying(): boolean {
    return this.isTrackPlayingState;
  }

  private loadSettings(): AudioSettings {
    if (typeof localStorage === 'undefined') {
      return { ...DEFAULT_SETTINGS };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      const parsed = JSON.parse(raw);
      return {
        volume: typeof parsed.volume === 'number' ? parsed.volume : DEFAULT_SETTINGS.volume,
        muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  private saveSettings(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
    } catch {
      // Ignore storage errors
    }
  }
}

// Global default synthesizer instance
let defaultSynthesizer: AudioSynthesizer | null = null;

export function getAudioSynthesizer(): AudioSynthesizer {
  if (!defaultSynthesizer) {
    defaultSynthesizer = new AudioSynthesizer();
  }
  return defaultSynthesizer;
}
