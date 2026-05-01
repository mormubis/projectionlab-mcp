// ---------------------------------------------------------------------------
// Primitives & shared types
// ---------------------------------------------------------------------------

export type Owner = "me" | "spouse" | "joint";

export interface DateRef {
  type: "keyword" | "date" | "milestone";
  value: string;
  modifier?: "include" | "exclude";
  logic?: "or" | "and";
}

export interface YearlyChange {
  type: "match-inflation" | "increase" | "none" | "appreciate";
  amount: number;
  amountType: string;
  limit: number;
  limitEnabled: boolean;
  limitType: string;
  custom?: {
    type: string;
    data: Array<{ x: number; y: number }>;
  };
}

export interface WithdrawAge {
  type: "keyword" | "date";
  value: string;
  modifier?: "include" | "exclude";
}

// ---------------------------------------------------------------------------
// Accounts (Current Finances / Starting Conditions)
// ---------------------------------------------------------------------------

export interface SavingsAccount {
  id: string;
  name: string;
  type: "savings";
  title: string;
  balance: number;
  owner: Owner;
  color: string;
  icon: string;
  liquid?: boolean;
  withdraw?: boolean;
  repurpose?: boolean;
  withdrawAge?: WithdrawAge;
  investmentGrowthRate: number;
  investmentGrowthType: string;
  dividendRate: number;
  dividendType: string;
  [key: string]: unknown;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: "taxable" | "401k" | "ira" | "roth-ira" | "hsa" | "crypto" | string;
  title: string;
  subtitle?: string;
  balance: number;
  costBasis?: number;
  owner: Owner;
  color: string;
  icon: string;
  liquid?: boolean;
  withdraw?: boolean;
  withdrawAge?: WithdrawAge;
  investmentGrowthRate: number;
  investmentGrowthType: string;
  dividendRate: number;
  dividendType: string;
  isPassiveIncome?: boolean;
  yearlyFee?: number;
  yearlyFeeType?: string;
  notes?: string;
  hasNotes?: boolean;
  [key: string]: unknown;
}

export type Account = SavingsAccount | InvestmentAccount;

// ---------------------------------------------------------------------------
// Income events
// ---------------------------------------------------------------------------

export interface IncomeEvent {
  id: string;
  name: string;
  type: "salary" | "pension" | "rsu" | "other" | string;
  title: string;
  amount: number;
  amountType: string;
  frequency: "yearly" | "monthly" | "once" | string;
  frequencyChoices?: boolean;
  owner: Owner;
  icon: string;
  start: DateRef;
  end: DateRef;
  planPath: "income";
  key: number;

  // Tax
  taxExempt: boolean;
  taxCharacter: "auto" | "wage" | "selfEmployment" | string;
  withholdingRate: number;
  withholdingMode: "fixed" | string;
  contribsReduceTaxableIncome?: boolean;

  // Part-time
  goPartTime: boolean;
  partTimeStart?: DateRef;
  partTimeEnd?: DateRef;
  partTimeRate?: number;

  // Pension-specific
  hasPension?: boolean;
  pensionContribution?: number;
  pensionContributionType?: string;
  pensionPayoutRate?: number;
  pensionPayoutAmount?: number;
  pensionPayoutType?: string;
  pensionPayoutsAreTaxFree?: boolean;
  pensionPayoutsStart?: DateRef;
  pensionPayoutsEnd?: DateRef;

  // Growth
  yearlyChange: YearlyChange;

  // Display
  hidden?: boolean;
  repeat?: boolean;
  hasExtraOptions?: boolean;
  preventOverflow?: boolean;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Expense events
// ---------------------------------------------------------------------------

export interface ExpenseEvent {
  id: string;
  name: string;
  type: "rent" | "living-expenses" | "vacation" | "dependent-support" | string;
  title: string;
  amount: number;
  amountType: string;
  frequency: "monthly" | "yearly" | "quarterly" | "once" | string;
  frequencyChoices?: boolean;
  owner: Owner;
  icon: string;
  color: string;
  start: DateRef;
  end: DateRef;
  planPath: "expenses";
  key: number;
  spendingType?: "essential" | "discretionary" | string;
  taxDeductible?: boolean;
  itemized?: boolean;
  deductFromIncomeId?: string;
  yearlyChange: YearlyChange;
  repeat?: boolean;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

export interface MilestoneCriteria {
  type: "milestone" | "year" | "liquidNetWorth" | string;
  value: string | number;
  modifier?: "include" | "exclude";
  logic?: "or" | "and";
  // For liquidNetWorth type
  measurement?: "avg" | string;
  range?: number;
  valueType?: "expenses" | string;
  operator?: ">" | "<" | ">=" | "<=" | string;
  fixedRange?: boolean;
}

export interface Milestone {
  id: string;
  name: string;
  icon: string;
  color: string;
  criteria: MilestoneCriteria[];
  schema?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Cash flow priorities
// ---------------------------------------------------------------------------

export interface CashFlowPriority {
  id: string;
  name: string;
  type: "taxable" | "savings" | "401k" | "ira" | string;
  title: string;
  subtitle?: string;
  owner: Owner;
  ownerName?: string;
  accountId: string;
  icon: string;
  color: string;
  frequency: "yearly" | "monthly" | string;
  amount: number;
  amountType: string;
  start: DateRef;
  end: DateRef;
  planPath: "priorities";
  key?: number;
  goalIntent: "invest" | "maintain" | string;
  desiredContribution: "%-remaining" | "max" | string;
  persistent: boolean;

  // Savings-specific
  mode?: "target" | "unbounded" | string;
  tapFund?: boolean;
  tapRate?: number;
  contribution?: number;
  contributionType?: string;

  // Display
  showChartIcon?: boolean;
  maxMsg?: string;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Assets (real estate, etc.)
// ---------------------------------------------------------------------------

export interface AssetEvent {
  id: string;
  name: string;
  type: "real-estate" | string;
  title: string;
  icon: string;
  owner: Owner;
  classification?: "residential" | "commercial" | string;
  amount: number;
  amountType: string;
  initialValue: number;
  initialValueType: string;
  start: DateRef;
  end: DateRef;
  planPath: "assets";

  // Financing
  paymentMethod: "financed" | "cash" | string;
  downPayment?: number;
  downPaymentType?: string;
  monthlyPayment?: number;
  monthlyPaymentType?: string;
  interestRate?: number;
  interestType?: string;
  balance?: number;
  balanceType?: string;

  // Costs
  taxRate?: number;
  taxRateType?: string;
  insuranceRate?: number;
  insuranceRateType?: string;
  maintenanceRate?: number;
  maintenanceRateType?: string;
  monthlyHOA?: number;
  monthlyHOAType?: string;
  managementRate?: number;
  managementRateType?: string;
  improvementRate?: number;
  improvementRateType?: string;

  // Rental
  generateIncome?: boolean;
  isPassiveIncome?: boolean;
  incomeRate?: number;
  incomeRateType?: string;
  percentRented?: number;

  // Other
  cancelRent?: boolean;
  sellIfNeeded?: boolean;
  brokersFee?: number;
  yearlyChange: YearlyChange;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Withdrawal strategy
// ---------------------------------------------------------------------------

export interface WithdrawalStrategyParams {
  amount: number;
  min?: number;
  minType?: string;
  minEnabled?: boolean;
  max?: number;
  maxType?: string;
  maxEnabled?: boolean;
}

export interface GuytonKlingerParams extends WithdrawalStrategyParams {
  guardrail: number;
  adjustment: number;
}

export interface KitcesRatchetParams extends WithdrawalStrategyParams {
  threshold: number;
  ratchet: number;
  cooldown: number;
}

export type WithdrawalStrategyType =
  | "initial-%"
  | "fixed-%"
  | "fixed-amount"
  | "1/N"
  | "vpw"
  | "kitces-ratchet"
  | "clyatt-95%"
  | "guyton-klinger";

export interface WithdrawalStrategy {
  enabled: boolean;
  strategy: WithdrawalStrategyType;
  start: DateRef;
  income: string;
  spendMode: string;
  "initial-%"?: WithdrawalStrategyParams;
  "fixed-%"?: WithdrawalStrategyParams;
  "fixed-amount"?: { amount: number; amountType: string; adjust: boolean };
  "1/N"?: WithdrawalStrategyParams;
  vpw?: WithdrawalStrategyParams;
  "kitces-ratchet"?: KitcesRatchetParams;
  "clyatt-95%"?: WithdrawalStrategyParams & { percentOfPrevious: number };
  "guyton-klinger"?: GuytonKlingerParams;
}

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

export interface MonteCarloConfig {
  trials: number;
  iterations: number;
  sampling: "backtest-random-restart" | "backtest-no-loop" | "random" | string;
  mode: "custom" | "default" | string;
  blockSize: number;
  metric: string;
  trialMetric: string;
  statsMetric: string;
  metrics: string[];
  splitPoint: string;
  splitPointModifier: string;

  investmentReturn: "backtest" | "custom" | string;
  investmentReturnMean: number;
  investmentReturnStdDev: number;

  bondReturn: "backtest" | "custom" | string;
  bondReturnMean: number;
  bondReturnStdDev: number;

  inflation: "custom" | "backtest" | string;
  inflationMean: number;
  inflationStdDev: number;

  dividendRate: "backtest" | "custom" | string;
  dividendRateMean: number;
  dividendRateStdDev: number;

  cryptoReturn: "custom" | string;
  cryptoReturnMean: number;
  cryptoReturnStdDev: number;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tax brackets & configuration (in plan variables)
// ---------------------------------------------------------------------------

export interface TaxBracket {
  rate: number;
  start: number;
  end?: number;
}

export interface TaxSchedule {
  name: string;
  icon: string;
  brackets: TaxBracket[];
  standardDeduction?: number;
  taxType?: string;
  notProgressive?: boolean;
  isPercentOfNationalIncomeTax?: boolean;
  reducesTaxableIncome?: boolean;
  ignoresDeductions?: boolean;
  jurisdiction?: string;
  isPayroll?: boolean;
  exemptions?: Array<{
    incomeTypes: string[];
    note?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Plan variables (growth assumptions, taxes, etc.)
// ---------------------------------------------------------------------------

export interface PlanVariables {
  assumptionsMode: "historical" | "fixed" | string;
  startYear: number;
  loopYear: number;
  startDate: string;
  projectFrom: string;

  investmentReturn: number;
  inflation: number;
  dividendRate: number;
  bondInvestmentReturn: number;
  bondDividendRate: number;

  investmentReturnModifier: number;
  inflationModifier: number;
  dividendRateModifier: number;
  bondInvestmentReturnModifier: number;
  bondDividendRateModifier: number;

  estimateTaxes: boolean;
  filingStatus: string;
  effectiveIncomeTaxRate: number;
  incomeTaxMode: string;
  incomeTaxModifier: number;
  incomeTaxNational: TaxSchedule;
  incomeTaxExtra: TaxSchedule[];
  localIncomeTaxRate: number;

  capGainsMode: string;
  capGains: { brackets: TaxBracket[]; offset: string; notProgressive: boolean; allowance: number };
  capGainsTaxRate: number;
  capGainsTaxablePercent: number;
  capGainsTaxAsIncome: boolean;
  capGainsModifier: number;

  dividendTaxMode: string;
  dividendTaxRate: number;
  dividendTax: { brackets: TaxBracket[]; offset: string; allowance?: number };

  wealthTaxMode: string;
  wealthTaxRate: number;
  wealthTaxMetric: string;
  wealthTax: { brackets: TaxBracket[]; offset: string; notProgressive: boolean; standardDeduction: number };

  withholding: { taxable: number; conversions: number; taxDeferred: number };
  drawdownOrder: string[];

  showFutureDollars: boolean;
  showRothConversionIcons: boolean;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export interface Plan {
  id: string;
  name: string;
  schema: number;
  icon?: string;
  active?: boolean;
  initialized?: boolean;
  simKey?: string;
  hasNotes?: boolean;
  lastUpdated?: number;
  startingConditionsType?: string;

  milestones: Milestone[];
  income: { events: IncomeEvent[] };
  expenses: { events: ExpenseEvent[] };
  priorities: { events: CashFlowPriority[] };
  assets: { events: AssetEvent[] };
  accounts?: Record<string, unknown>;
  startingConditions?: Record<string, unknown>;
  variables: PlanVariables;
  withdrawalStrategy: WithdrawalStrategy;
  montecarlo: MonteCarloConfig;
  computedMilestones?: Record<string, unknown>;
  meta?: Record<string, unknown>;

  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Today (Current Finances)
// ---------------------------------------------------------------------------

export interface Location {
  country: string;
  [key: string]: unknown;
}

export interface Today {
  schema: number;
  location: Location;
  age: number;
  birthYear: number;
  birthMonth: number;
  yourName: string;
  yourColor: string;
  yourIcon: string;
  partnerStatus: "couple" | "single" | string;
  spouseAge?: number;
  spouseAgeGap?: number;
  spouseBirthYear?: number;
  spouseBirthMonth?: number;
  spouseName?: string;
  spouseColor?: string;
  spouseIcon?: string;
  filingStatus?: string;
  tab?: number;
  savingsAccounts: SavingsAccount[];
  investmentAccounts: InvestmentAccount[];
  debts?: unknown[];
  assets?: unknown[];
  lastUpdated?: number;
  customIcon?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Complete export
// ---------------------------------------------------------------------------

export interface Meta {
  version: string;
  lastUpdated: number;
}

export interface CompleteAccountDataExport {
  meta: Meta;
  today: Today;
  plans: Plan[];
  settings: Record<string, unknown>;
  progress: Record<string, unknown>;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Plugin API params
// ---------------------------------------------------------------------------

export interface PluginKeyParam {
  key: string;
}

export interface UpdateAccountOptions {
  balance?: number;
  costBasis?: number;
  [key: string]: unknown;
}
