
export class SpeedMonitor {
  private static timers: Map<string, number> = new Map();

  static start(operationId: string) {
    this.timers.set(operationId, Date.now());
  }

  static end(operationId: string): number {
    const startTime = this.timers.get(operationId);
    if (!startTime) {
      console.warn(`[SpeedMonitor] No start time found for ${operationId}`);
      return 0;
    }

    const elapsed = (Date.now() - startTime) / 1000;
    this.timers.delete(operationId);

    // Log if operation took longer than 6 seconds
    if (elapsed > 6) {
      console.warn(`⚠️ [SpeedMonitor] ${operationId} took ${elapsed.toFixed(1)}s (target: 6s)`);
    } else {
      console.log(`✓ [SpeedMonitor] ${operationId} completed in ${elapsed.toFixed(1)}s`);
    }

    return elapsed;
  }

  static async measure<T>(operationId: string, fn: () => Promise<T>): Promise<T> {
    this.start(operationId);
    try {
      const result = await fn();
      this.end(operationId);
      return result;
    } catch (error) {
      this.end(operationId);
      throw error;
    }
  }
}
