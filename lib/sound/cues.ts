import type { Tone } from "@/lib/tracking/types";

/**
 * Short synthesized cues (10월 4일 요청 ③: 소리와 디자인의 조화). No audio files: a few Web Audio oscillators, each
 * under half a second and quiet. Loaded on demand only after the customer turned sound on, and never played without
 * a click first (browsers block that anyway).
 */
export type Cue = "on" | "done" | "delivered" | "problem";

let context: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") return null;
  context ??= new window.AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

/** One soft bell note: a sine with a quick attack and an exponential fade. */
function note(ctx: AudioContext, frequency: number, start: number, length: number, peak: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.02);
}

/** The customs stamp: a low thump with a short filtered click on top. */
function stamp(ctx: AudioContext, start: number): void {
  note(ctx, 130, start, 0.16, 0.12);
  const frames = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) samples[index] = (Math.random() * 2 - 1) * (1 - index / frames);
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  source.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  gain.gain.value = 0.18;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(start);
}

export function cueForTone(tone: Tone): Cue {
  if (tone === "done") return "delivered";
  if (tone === "problem" || tone === "attention") return "problem";
  return "done";
}

export function playCue(cue: Cue): void {
  const ctx = audio();
  if (ctx === null) return;
  const now = ctx.currentTime + 0.01;
  switch (cue) {
    case "on":
      note(ctx, 880, now, 0.18, 0.06);
      return;
    case "done":
      note(ctx, 659.25, now, 0.32, 0.07);
      note(ctx, 987.77, now + 0.11, 0.42, 0.06);
      return;
    case "delivered":
      stamp(ctx, now);
      note(ctx, 783.99, now + 0.14, 0.36, 0.06);
      note(ctx, 1046.5, now + 0.25, 0.46, 0.05);
      return;
    case "problem":
      note(ctx, 392, now, 0.3, 0.06);
      note(ctx, 329.63, now + 0.16, 0.4, 0.05);
      return;
  }
}
