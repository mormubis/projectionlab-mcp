/**
 * Generates JavaScript strings that execute against the ProjectionLab
 * Plugin API in the browser. These are used as `script` values in
 * evaluate ActionSteps.
 */

export function validateApiKeyScript(key: string): string {
  return `await window.projectionlabPluginAPI.validateApiKey({ key: ${JSON.stringify(key)} })`;
}

export function exportDataScript(key: string): string {
  return `await window.projectionlabPluginAPI.exportData({ key: ${JSON.stringify(key)} })`;
}

export function updateAccountScript(
  key: string,
  accountId: string,
  data: Record<string, unknown>,
): string {
  return `await window.projectionlabPluginAPI.updateAccount(${JSON.stringify(accountId)}, ${JSON.stringify(data)}, { key: ${JSON.stringify(key)} })`;
}

export function restorePlansScript(key: string, plans: unknown[]): string {
  return `await window.projectionlabPluginAPI.restorePlans(${JSON.stringify(plans)}, { key: ${JSON.stringify(key)} })`;
}

export function restoreCurrentFinancesScript(
  key: string,
  startingConditions: unknown,
): string {
  return `await window.projectionlabPluginAPI.restoreCurrentFinances(${JSON.stringify(startingConditions)}, { key: ${JSON.stringify(key)} })`;
}

export function checkPluginApiScript(): string {
  return `typeof window.projectionlabPluginAPI !== 'undefined'`;
}
