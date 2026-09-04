/**
 * Setup music.
 *
 * Plays `./onboarding-theme.mp3` from the renderer's public folder when one is
 * shipped. When it is not, a small generative pad takes over: four slowly
 * breathing voices over a quiet sub, cycling through a warm four-chord loop
 * through a feedback delay. Nothing to license and nothing to download, and
 * it never repeats exactly.
 */

const MUTE_KEY = 'accordio.onboarding.muted';
const FILE_SRC = './onboarding-theme.mp3';

// Hz. Cmaj7 → Am7 → Fmaj7 → G6, each voiced across two octaves.
const CHORDS: number[][] = [
  [130.81, 196.0, 246.94, 329.63, 392.0],
  [110.0, 164.81, 196.0, 261.63, 329.63],
  [87.31, 130.81, 174.61, 220.0, 329.63],
  [98.0, 146.83, 196.0, 246.94, 293.66],
];
const CHORD_SECONDS = 14;

export interface MusicController {
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  stop: () => void;
}

export function readMutedPreference(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeMutedPreference(muted: boolean) {
  try {
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Storage unavailable — the toggle still works for this session
  }
}

class GenerativePad {
  private ctx: AudioContext;
  private master: GainNode;
  private voices: { osc: OscillatorNode[]; gain: GainNode }[] = [];
  private chordIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(private volume: number) {
    this.ctx = new AudioContext();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;

    // Space: a soft feedback delay with a darkening filter in the loop.
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.46;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    const loopFilter = ctx.createBiquadFilter();
    loopFilter.type = 'lowpass';
    loopFilter.frequency.value = 1400;
    delay.connect(loopFilter);
    loopFilter.connect(feedback);
    feedback.connect(delay);

    const bus = ctx.createGain();
    bus.gain.value = 1;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 900;
    tone.Q.value = 0.4;

    bus.connect(tone);
    tone.connect(this.master);
    tone.connect(delay);
    delay.connect(this.master);
    this.master.connect(ctx.destination);

    // Slow filter breathing.
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 260;
    lfo.connect(lfoGain);
    lfoGain.connect(tone.frequency);
    lfo.start();

    const chord = CHORDS[0];
    for (let i = 0; i < chord.length; i++) {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(bus);
      const oscs: OscillatorNode[] = [];
      for (const [type, detune] of [
        ['sine', -5],
        ['triangle', 4],
      ] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = chord[i];
        osc.detune.value = detune;
        const partial = ctx.createGain();
        partial.gain.value = type === 'sine' ? 0.6 : 0.22;
        osc.connect(partial);
        partial.connect(gain);
        osc.start();
        oscs.push(osc);
      }
      this.voices.push({ osc: oscs, gain });
    }

    this.playChord(0, true);
    this.timer = setInterval(() => {
      this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      this.playChord(this.chordIndex, false);
    }, CHORD_SECONDS * 1000);

    this.master.gain.setTargetAtTime(this.volume, ctx.currentTime, 1.6);
  }

  private playChord(index: number, first: boolean) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const chord = CHORDS[index];
    this.voices.forEach((voice, i) => {
      const target = chord[i];
      // Voices don't all arrive at once — staggered swells read as breathing.
      const at = now + (first ? 0.2 : 0.4) + i * 0.35;
      for (const osc of voice.osc) {
        osc.frequency.cancelScheduledValues(now);
        osc.frequency.setTargetAtTime(target, at, 0.9);
      }
      const level = i === 0 ? 0.18 : 0.13;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(level * 0.55, at, 1.2);
      voice.gain.gain.setTargetAtTime(level, at + 3, 2.5);
    });
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.stopped) return;
    this.master.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.4);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
    setTimeout(() => {
      void this.ctx.close().catch(() => { /* already closed */ });
    }, 1200);
  }
}

/**
 * Start the music. Resolves to a controller once either the file or the pad
 * is playing. Safe to call with `muted: true` — the source still starts so
 * unmuting is instant.
 */
export function startOnboardingMusic(initialMuted: boolean): MusicController {
  let muted = initialMuted;
  let pad: GenerativePad | null = null;
  let audio: HTMLAudioElement | null = null;
  // React StrictMode mounts twice: the first controller is stopped before the
  // <audio> 'error' event that would have started its pad. Without this flag
  // that orphaned pad played on with nothing able to mute it.
  let stopped = false;
  const FILE_VOLUME = 0.35;
  const PAD_VOLUME = 0.09;

  const applyVolume = () => {
    if (audio) audio.volume = muted ? 0 : FILE_VOLUME;
    if (pad) pad.setVolume(muted ? 0 : PAD_VOLUME);
  };

  const startPad = () => {
    if (pad || stopped) return;
    try {
      pad = new GenerativePad(muted ? 0 : PAD_VOLUME);
    } catch {
      pad = null;
    }
  };

  // Prefer a shipped track; fall through to the pad when there isn't one.
  try {
    const el = new Audio(FILE_SRC);
    el.loop = true;
    el.preload = 'auto';
    el.volume = muted ? 0 : FILE_VOLUME;
    el.addEventListener('canplay', () => {
      if (stopped) return;
      audio = el;
      applyVolume();
      void el.play().catch(() => startPad());
    }, { once: true });
    el.addEventListener('error', () => startPad(), { once: true });
  } catch {
    startPad();
  }

  return {
    setMuted(next: boolean) {
      muted = next;
      writeMutedPreference(next);
      applyVolume();
    },
    isMuted: () => muted,
    stop() {
      stopped = true;
      if (audio) {
        audio.pause();
        audio.src = '';
        audio = null;
      }
      pad?.stop();
      pad = null;
    },
  };
}
