import type { ActionStep, ActionSequence } from "../types/actions.js";

export function navigate(url: string, description: string): ActionStep {
  return { action: "navigate", url, description };
}

export function evaluate(
  script: string,
  description: string,
  expected?: string,
): ActionStep {
  return { action: "evaluate", script, description, expected };
}

export function snapshot(description: string): ActionStep {
  return { action: "snapshot", description };
}

export function click(
  selector: string,
  description: string,
  expected?: string,
): ActionStep {
  return { action: "click", selector, description, expected };
}

export function wait(
  selector: string,
  description: string,
  timeout?: number,
): ActionStep {
  return { action: "wait", selector, description, timeout };
}

export function sequence(
  tool: string,
  steps: ActionStep[],
  options?: { verify?: ActionStep; requestId?: string; done?: boolean },
): ActionSequence {
  return {
    tool,
    steps,
    verify: options?.verify,
    requestId: options?.requestId,
    done: options?.done,
  };
}
