// Deterministic, resumable PRNG (mulberry32). The whole engine derives every
// random choice from one of these so a game is fully reproducible from its
// seed. The integer `state()` can be persisted into GameState and the stream
// resumed across phases with makeRng(state) — this is what lets a saved game be
// replayed bit-for-bit.

export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Fisher–Yates shuffle into a new array. */
  shuffle<T>(items: readonly T[]): T[];
  /** Current internal state — persist this to resume the stream later. */
  state(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    pick: <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!,
    shuffle: <T>(items: readonly T[]) => {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
    state: () => a >>> 0,
  };
}
