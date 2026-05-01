export type ActionType = "navigate" | "evaluate" | "snapshot" | "click" | "wait";

export interface ActionStep {
  action: ActionType;
  description: string;
  url?: string;
  script?: string;
  selector?: string;
  expected?: string;
  timeout?: number;
}

export interface ActionSequence {
  tool: string;
  steps: ActionStep[];
  verify?: ActionStep;
  requestId?: string;
  done?: boolean;
}

export interface ContinueInput {
  requestId: string;
  result: unknown;
}
