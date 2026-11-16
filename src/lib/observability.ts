// Deliberately independent of any vendor SDK. The user owns the future Flowmark integration.
export type ProcessEvent = {
  process: string;
  execution: "success" | "failure";
  durationMs: number;
  outcomes: Record<string, string | number | boolean>;
};
export type EventSink = (event: ProcessEvent) => void | Promise<void>;
const log: EventSink = (event) => console.info(JSON.stringify({ service: "signal", ...event }));
export async function observe<T>(
  process: string,
  work: () => Promise<T>,
  outcomes: (result: T) => ProcessEvent["outcomes"] = () => ({}),
  sink: EventSink = log,
): Promise<T> {
  const start = Date.now();
  const emit = (
    execution: ProcessEvent["execution"],
    getOutcomes: () => ProcessEvent["outcomes"],
  ) => {
    try {
      const delivery = sink({
        process,
        execution,
        durationMs: Date.now() - start,
        outcomes: getOutcomes(),
      });
      if (delivery) void delivery.catch(() => {});
    } catch {
      /* Telemetry must never interrupt application work. */
    }
  };
  try {
    const result = await work();
    emit("success", () => outcomes(result));
    return result;
  } catch (error) {
    emit("failure", () => ({}));
    throw error;
  }
}
