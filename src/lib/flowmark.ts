import "server-only";
import {
  createFlowmark as createNodeFlowmark,
  type Flow,
  type FlowmarkClient,
} from "@flowmarkdev/node";
import { createFlowmark as createNextFlowmark } from "@flowmarkdev/node/next";

/**
 * One module owns both documented entry points for briefing generation.
 * Cron runs inside a Route Handler, so the Next client drains with after().
 * The maintenance script has no request scope — after() throws there — so that
 * process uses the Node client and shuts it down before exit.
 */
const nextFlowmark = createNextFlowmark();
const workflowName = "briefing.generate";
let nodeClient: FlowmarkClient | null | undefined;
let nodeUsed = false;

export function startBriefingRun(date: string, executionId?: string): Flow | null {
  const options = {
    properties: { date },
    ...(executionId ? { id: executionId } : {}),
  };
  try {
    return nextFlowmark.workflow(workflowName, options);
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("outside a request scope")) {
      console.warn("[Flowmark] instrumentation unavailable");
      return null;
    }
  }
  if (nodeClient === undefined) {
    try {
      nodeClient = createNodeFlowmark();
    } catch {
      nodeClient = null;
      console.warn("[Flowmark] instrumentation unavailable");
      return null;
    }
  }
  if (!nodeClient) return null;
  try {
    const flow = nodeClient.workflow(workflowName, options);
    nodeUsed = true;
    return flow;
  } catch {
    console.warn("[Flowmark] instrumentation unavailable");
    return null;
  }
}

/** Drains the Node client used by the maintenance script. The Next client drains itself. */
export async function drainBriefingTelemetry(): Promise<void> {
  const client = nodeClient;
  if (!client || !nodeUsed) return;
  nodeClient = undefined;
  nodeUsed = false;
  try {
    await client.shutdown();
  } catch {
    console.error("[Flowmark] Workflow delivery failed; application changes are unaffected.");
  }
}
