import type {
  Account,
  Plan,
  CompleteAccountDataExport,
} from "../types/projectionlab.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateAccount(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Account must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) {
    errors.push("Account must have a non-empty string 'id'");
  }
  if (typeof obj.name !== "string") {
    errors.push("Account must have a string 'name'");
  }
  if (typeof obj.balance !== "number") {
    errors.push("Account must have a numeric 'balance'");
  }

  return { valid: errors.length === 0, errors };
}

export function validatePlan(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Plan must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) {
    errors.push("Plan must have a non-empty string 'id'");
  }
  if (typeof obj.name !== "string") {
    errors.push("Plan must have a string 'name'");
  }

  return { valid: errors.length === 0, errors };
}

export function validateExport(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Export data must be an object"] };
  }

  const obj = data as Record<string, unknown>;

  if (obj.plans !== undefined) {
    if (!Array.isArray(obj.plans)) {
      errors.push("'plans' must be an array if present");
    } else {
      for (let i = 0; i < obj.plans.length; i++) {
        const planResult = validatePlan(obj.plans[i]);
        for (const err of planResult.errors) {
          errors.push(`plans[${i}]: ${err}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateAccountUpdate(data: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Update data must be an object"] };
  }

  const obj = data as Record<string, unknown>;
  if (obj.balance !== undefined && typeof obj.balance !== "number") {
    errors.push("'balance' must be a number if provided");
  }
  if (obj.costBasis !== undefined && typeof obj.costBasis !== "number") {
    errors.push("'costBasis' must be a number if provided");
  }

  return { valid: errors.length === 0, errors };
}
