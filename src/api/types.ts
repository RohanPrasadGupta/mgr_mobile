// Types come from the generated OpenAPI schema (src/api/schema.d.ts) — nothing here is hand-maintained.
import type { components, paths } from "./schema";

type S = components["schemas"];
export type User = S["User"];
export type Account = S["Account"];
export type Category = S["Category"];
export type Currency = S["Currency"];
export type Transaction = S["Transaction"];
export type Summary = S["Summary"];
export type ByCategory = S["ByCategory"];
export type BudgetStatus = S["BudgetStatus"];
export type BudgetStatusItem = S["BudgetStatusItem"];
export type AccountType = Account["type"];
export type BudgetPeriod = S["Budget"]["period"];
export type Page<T> = { data: T[]; meta: { nextCursor: string | null } };
/** JSON request body type of an operation, e.g. `Body<"/accounts", "post">`. */
export type Body<P extends keyof paths, M extends "post" | "patch" | "delete"> = NonNullable<paths[P][M]> extends { requestBody: { content: { "application/json": infer B } } } ? B : never;

export type Budget = S["Budget"];
export type Asset = S["Asset"];
export type Holding = S["Holding"];
export type Portfolio = S["Portfolio"];
export type Trade = S["Trade"];
export type PricePoint = S["PricePoint"];
export type SipResult = S["SipResult"];
export type RecurringRule = S["RecurringRule"];
export type RunReport = S["RunReport"];
export type AssetClass = Asset["class"];
export type CostMethod = Asset["costMethod"];
export type TradeType = Trade["type"];
export type Frequency = RecurringRule["frequency"];

export type Tag = S["Tag"];
export type Attachment = S["Attachment"];
export type Goal = S["Goal"];
export type GoalDetail = S["GoalDetail"];
export type Debt = S["Debt"];
export type DebtDetail = S["DebtDetail"];
export type Note = S["Note"];
export type Report = S["Report"];
export type ImportReport = S["ImportReport"];
