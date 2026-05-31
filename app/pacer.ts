/**
 * Playback pacer. The orchestrator awaits `gate()` at every step boundary; the
 * pacer decides when to let it through, implementing pause / single-step /
 * autoplay WITHOUT the orchestrator knowing about UI or timers. This is the
 * `options.gate` seam from the design.
 *
 * - autoplay (not paused): each boundary waits `delayMs` then proceeds.
 * - paused: each boundary blocks until a `step()` credit or `resume()`.
 */
export class Pacer {
  private paused: boolean;
  private delayMs: number;
  private credits = 0;
  private wake: (() => void) | null = null;
  private aborted = false;

  constructor(delayMs: number, startPaused = false) {
    this.delayMs = delayMs;
    this.paused = startPaused;
  }

  setDelay(ms: number): void {
    this.delayMs = ms;
  }
  isPaused(): boolean {
    return this.paused;
  }
  pause(): void {
    this.paused = true;
  }
  resume(): void {
    this.paused = false;
    this.signal();
  }
  /** Allow exactly one more boundary to proceed (single-step). */
  step(): void {
    this.credits++;
    this.signal();
  }
  abort(): void {
    this.aborted = true;
    this.signal();
  }

  private signal(): void {
    const w = this.wake;
    this.wake = null;
    w?.();
  }
  private waitSignal(): Promise<void> {
    return new Promise((res) => {
      this.wake = res;
    });
  }
  private sleep(ms: number): Promise<void> {
    return new Promise((res) => setTimeout(res, ms));
  }

  async gate(): Promise<void> {
    while (!this.aborted) {
      if (this.credits > 0) {
        this.credits--;
        return;
      }
      if (!this.paused) {
        await this.sleep(this.delayMs);
        if (this.paused && this.credits === 0) continue; // paused mid-sleep
        return;
      }
      await this.waitSignal();
    }
  }
}
