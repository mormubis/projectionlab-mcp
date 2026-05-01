export interface Account {
  id: string;
  name: string;
  type: string;
  balance: number;
  costBasis?: number;
  [key: string]: unknown;
}

export interface Milestone {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface IncomeEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface ExpenseEvent {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  name: string;
  accounts?: Account[];
  milestones?: Milestone[];
  incomeEvents?: IncomeEvent[];
  expenseEvents?: ExpenseEvent[];
  [key: string]: unknown;
}

export interface StartingConditions {
  accounts?: Account[];
  [key: string]: unknown;
}

export interface ProgressState {
  [key: string]: unknown;
}

export interface SettingsState {
  [key: string]: unknown;
}

export interface CompleteAccountDataExport {
  plans?: Plan[];
  startingConditions?: StartingConditions;
  progress?: ProgressState;
  settings?: SettingsState;
  [key: string]: unknown;
}

export interface PluginKeyParam {
  key: string;
}

export interface UpdateAccountOptions {
  balance?: number;
  costBasis?: number;
  [key: string]: unknown;
}
