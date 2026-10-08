// Pure natural-language parser for the Smart Hustle AI chat.
// Understands Kenyan business chat in English, Swahili and Sheng:
//   "I sold 3 shirts for KES 1500"     -> sale  {product: shirts, qty: 3, amount: 1500}
//   "Nimeuza mashati matatu kwa 1500"  -> sale
//   "Nimeuza viatu mbili 2000"         -> sale (Sheng)
//   "Paid transport KES 300"           -> expense {category: transport, amount: 300}
//   "Bought 10 pencils at KES 500"     -> purchase
//   "Nimenunua kalamu 10 kwa 500"      -> purchase
//   "Nimelipa transport 300"           -> expense
//   "John owes me 500" / "deni ya John 500" -> debt
//   "John paid 200" / "John alipa 200" -> payment_received
// Command questions ("sales today", "show profit", "low stock", ...) are
// parsed into structured commands.

export type TxType =
  | "sale"
  | "expense"
  | "purchase"
  | "payment_received"
  | "debt";

export interface ExtractedTx {
  type: TxType;
  productName?: string;
  quantity?: number;
  amount: number; // 0 when missingAmount
  missingAmount?: boolean;
  customerName?: string;
}

export type ChatCommand =
  | "sales"
  | "profit"
  | "expenses"
  | "inventory"
  | "low_stock"
  | "customers"
  | "top_customers"
  | "report"
  | "help"
  | "summary"
  | "inventory_query"
  | "customer_balance"
  | "customer_history";

export type ParseResult =
  | { kind: "transaction"; tx: ExtractedTx }
  | { kind: "command"; command: ChatCommand; range: Range; name?: string }
  | { kind: "unknown" };

import type { Range } from "./time";

// ---------------------------------------------------------------------------
// Number words (1-99 composed + simple hundred/thousand patterns)
// ---------------------------------------------------------------------------

const SMALL: Record<string, number> = {
  a: 1, an: 1,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14,
  fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8,
  tisa: 9, kumi: 10,
  // Swahili noun-class prefixed forms: "mashati matatu" = 3 shirts,
  // "muda miwili" = 2, "vipodozi vitatu" = 3, etc.
  mawili: 2, matatu: 3, manne: 4, matano: 5,
  miwili: 2, mitatu: 3, minne: 4, mitano: 5,
  viwili: 2, vitatu: 3, vinne: 4, vitano: 5,
};

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
  ishirini: 20, thelathini: 30, arobaini: 40, hamsini: 50, sitini: 60,
  sabini: 70, themanini: 80, tisini: 90,
};

const HUNDREDS = new Set(["hundred", "mia"]);
const THOUSANDS = new Set(["thousand", "elfu"]);
const HUNDRED_WORDS = HUNDREDS;
const THOUSAND_WORDS = THOUSANDS;
const AND_WORDS = new Set(["na", "and"]);
const NUMBER_WORD = new Set<string>([
  ...Object.keys(SMALL),
  ...Object.keys(TENS),
  ...HUNDRED_WORDS,
  ...THOUSAND_WORDS,
  ...AND_WORDS,
]);

/** Compose a run of number words into a value, or null if it isn't one. */
function composeNumber(words: string[]): number | null {
  if (words.length === 0) return null;
  // Swahili pattern: "mia mbili" (200), "elfu tano" (5000)
  if (
    words.length === 2 &&
    (HUNDREDS.has(words[0]) || THOUSANDS.has(words[0]))
  ) {
    const mult = HUNDREDS.has(words[0]) ? 100 : 1000;
    const rest = composeNumber([words[1]]);
    if (rest !== null && rest > 0 && rest < 10) return rest * mult;
  }
  let total = 0;
  let cur = 0;
  let any = false;
  for (const w of words) {
    if (AND_WORDS.has(w)) {
      if (!any) return null;
      continue;
    }
    const small = SMALL[w];
    if (small !== undefined) {
      cur += small;
      any = true;
      continue;
    }
    const tens = TENS[w];
    if (tens !== undefined) {
      cur += tens;
      any = true;
      continue;
    }
    if (HUNDREDS.has(w)) {
      cur = (cur || 1) * 100;
      any = true;
      continue;
    }
    if (THOUSANDS.has(w)) {
      total += (cur || 1) * 1000;
      cur = 0;
      any = true;
      continue;
    }
    return null;
  }
  if (!any) return null;
  return total + cur;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeText(input: string): string {
  let t = input.toLowerCase().trim();
  t = t.replace(/[/=]/g, " "); // "1500/=" -> "1500 "
  t = t.replace(/(\d),(\d{3})/g, "$1$2"); // 1,500 -> 1500
  t = t.replace(/(\d),(\d{3})/g, "$1$2"); // 1,500,000 -> 1500000
  t = t.replace(/(\d)\s*k\b/g, (_m, d: string) => ` ${Number(d) * 1000} `); // 2k -> 2000
  t = t.replace(/[,;:!?."'()]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

const DIGIT_RE = /^\d+(?:\.\d+)?$/;
const CURRENCY_WORDS = new Set([
  "kes", "ksh", "kshs", "sh", "shs", "shilingi", "shilling", "shillings",
  "bob", "tzs", "ugx",
]);
const PREP_WORDS = new Set([
  "for", "kwa", "at", "@", "ya", "wa", "la", "cha", "za", "vya", "to",
]);

interface NumHit {
  value: number;
  start: number; // token index (inclusive)
  end: number; // token index (exclusive)
}

interface Scan {
  tokens: string[];
  nums: NumHit[];
}

/** Find digit tokens and number-word runs in a normalized token list. */
function scanNumbers(tokens: string[]): Scan {
  const nums: NumHit[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (DIGIT_RE.test(tok)) {
      nums.push({ value: Number(tok), start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (NUMBER_WORD.has(tok)) {
      let j = i;
      while (j < tokens.length && NUMBER_WORD.has(tokens[j])) j += 1;
      const value = composeNumber(tokens.slice(i, j));
      if (value !== null && value > 0) nums.push({ value, start: i, end: j });
      i = j;
      continue;
    }
    i += 1;
  }
  return { tokens, nums };
}

// ---------------------------------------------------------------------------
// Verb dictionaries
// ---------------------------------------------------------------------------

const SALE_VERBS = new Set([
  "sold", "sell", "sells", "sale", "uza", "kuuza", "nauza", "nimeuza",
]);

const PURCHASE_VERBS = new Set([
  "bought", "buy", "buys", "purchase", "purchased", "restock", "restocked",
  "restocking", "nunua", "kununua", "nimenunua", "ninanunua", "agiza",
  "nimeagiza", "kuagiza",
]);

const EXPENSE_VERBS = new Set([
  "paid", "pay", "pays", "spent", "spend", "nimelipa", "nilipa",
  "ninalipa", "kulipa", "lipa", "nimetumia", "tumia", "gharama",
  "expense", "expensed",
]);

const PAYMENT_VERBS = new Set([
  "alipa", "amelipa", "amenilipa", "alinilipa", "walipa", "wamelipa",
  "alinipa", "amenipa", "anipa",
]);

const DEBT_VERBS = new Set([
  "owes", "owe", "owed", "deni", "madeni", "mkopo", "mikopo", "credit",
  "credits", "anadai", "ananidai", "anadaiwa", "ananidaiwa",
]);

const FILLER_WORDS = new Set([
  "pairs", "pair", "pieces", "piece", "pcs", "units", "unit", "items",
  "item", "packets", "packet", "crates", "crate", "cartons", "carton",
  "boxes", "box", "kg", "kgs", "litre", "litres", "ltr", "bunch",
  "bunches", "dozen", "dozens",
]);

const STOP_WORDS = new Set([
  "i", "we", "my", "our", "me", "the", "a", "an", "some", "just",
  "now", "today", "leo", "jana", "yesterday", "then", "so", "did",
  "do", "have", "has", "had", "was", "were", "am", "is", "are",
  "ni", "its", "it", "with", "and", "na", "also", "please",
  "tafadhali", "customer", "mteja", "client", "from", "of", "that",
  "this", "hii", "record", "records", "recorded", "add", "added",
  // Question words — "who owes me money" is a query, not a debt from "Who"
  "who", "whom", "whose", "nani", "where", "when",
]);

const CUSTOMER_LABELS = new Set(["customer", "mteja", "client"]);

// ---------------------------------------------------------------------------
// Debt patterns (multi-word)
// ---------------------------------------------------------------------------

// "deni ya john 300", "mkopo wa alice 500", "debt for musa 200"
const DEBT_OF_RE =
  /\b(?:deni|madeni|debt|mkopo|mikopo|credit)\s+(?:ya|wa|la|za|cha|kwa|for|of)?\s*([a-z][a-z0-9 ]*?)\s+(\d+(?:\.\d+)?)\b/;

// "john ana deni 500", "jane anadai 300"
const ANA_DENI_RE = /\b([a-z][a-z0-9]*)\s+ana\s?deni\b/;

// "received 500 from john", "nimepokea 500 kutoka kwa john"
const RECEIVED_FROM_RE =
  /\b(?:received|nimepokea|pokea)\s+(?:kes\s*|ksh\s*)?(\d+(?:\.\d+)?)\s+(?:from|kutoka)\s+(?:kwa\s+)?([a-z][a-z0-9]*(?:\s[a-z][a-z0-9]*){0,2})/;

// "john took goods on credit worth 1000"
const CREDIT_TAKE_RE =
  /\b([a-z][a-z0-9]{1,15})\s+took\s+(?:goods\s+|bidhaa\s+)?(?:on\s+)?credit\b(?:\s+(?:worth\s+|ya\s+)?(?:kes\s*|ksh\s*)?(\d+(?:\.\d+)?))?/;

// ---------------------------------------------------------------------------
// Transaction parsing
// ---------------------------------------------------------------------------

interface VerbHit {
  type: TxType;
  index: number; // first token of the verb
  span: number; // tokens consumed
}

function findVerb(tokens: string[]): VerbHit | null {
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // "ana deni" two-token verb
    if (tok === "ana" && tokens[i + 1] === "deni") {
      return { type: "debt", index: i, span: 2 };
    }
    if (PAYMENT_VERBS.has(tok)) return { type: "payment_received", index: i, span: 1 };
    if (DEBT_VERBS.has(tok)) return { type: "debt", index: i, span: 1 };
    if (PURCHASE_VERBS.has(tok)) {
      // "nimeongeza stock" counts; bare "nimeongeza" is too vague
      if (tok === "nimeongeza") {
        const rest = tokens.slice(i + 1, i + 4).join(" ");
        if (!/\b(stock|bidhaa|stock)\b/.test(rest)) continue;
      }
      return { type: "purchase", index: i, span: 1 };
    }
    if (EXPENSE_VERBS.has(tok)) return { type: "expense", index: i, span: 1 };
    if (SALE_VERBS.has(tok)) return { type: "sale", index: i, span: 1 };
  }
  return null;
}

function nameFromTokens(tokens: string[]): string | null {
  const parts: string[] = [];
  for (const t of tokens) {
    if (CUSTOMER_LABELS.has(t)) continue;
    if (STOP_WORDS.has(t) || FILLER_WORDS.has(t)) continue;
    if (CURRENCY_WORDS.has(t) || PREP_WORDS.has(t)) break;
    if (DIGIT_RE.test(t) || NUMBER_WORD.has(t)) break;
    if (/^[a-z][a-z0-9]*$/.test(t)) parts.push(t);
    if (parts.length >= 3) break;
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** "john doe" -> "John Doe" for nicer stored/displayed names. */
function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Try to read the message as one business transaction. Null if it isn't one. */
function tryParseTransaction(normalized: string): ExtractedTx | null {
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 0) return null;

  const scan = scanNumbers(tokens);
  const verb = findVerb(scan.tokens);

  // Debt handled via patterns even without a clean single-token verb.
  const debtOf = DEBT_OF_RE.exec(normalized);
  const anaDeni = ANA_DENI_RE.exec(normalized);

  // --- explicit payment / credit patterns (win over generic verb logic) ---
  const receivedFrom = RECEIVED_FROM_RE.exec(normalized);
  if (receivedFrom) {
    return {
      type: "payment_received",
      amount: Number(receivedFrom[1]),
      customerName: titleCase(receivedFrom[2]),
    };
  }
  const creditTake = CREDIT_TAKE_RE.exec(normalized);
  if (creditTake) {
    return {
      type: "debt",
      amount: creditTake[2] ? Number(creditTake[2]) : 0,
      missingAmount: creditTake[2] ? undefined : true,
      customerName: titleCase(creditTake[1]),
    };
  }

  if (!verb && !debtOf && !anaDeni) return null;

  // --- customer name (words before the verb, or from debt patterns) ---
  let customerName: string | undefined;
  if (verb) {
    customerName =
      nameFromTokens(scan.tokens.slice(0, verb.index)) ?? undefined;
  }
  if (!customerName && debtOf) customerName = debtOf[1]?.trim();
  if (!customerName && anaDeni) customerName = anaDeni[1];
  if (customerName) customerName = titleCase(customerName.trim());

  // --- pick a type ---
  let type: TxType;
  if (debtOf && (!verb || verb.type === "debt" || verb.type === "expense")) {
    // "nilipa deni ya john 300" (paying down a debt) -> payment_received
    type = verb && verb.type === "expense" ? "payment_received" : "debt";
  } else {
    type = verb ? verb.type : "debt";
  }
  if (type === "expense" && customerName) type = "payment_received";

  // --- amount + quantity ---
  const { tokens: toks, nums } = scan;
  let amount = 0;
  let qty: number | undefined;
  let missingAmount = false;

  const amountCandidates = nums.map((n, idx) => ({ n, idx }));
  let amountIdx = -1;
  for (let k = amountCandidates.length - 1; k >= 0; k--) {
    const { n } = amountCandidates[k];
    const prev = toks[n.start - 1];
    const next = toks[n.end];
    if (
      (prev && (CURRENCY_WORDS.has(prev) || PREP_WORDS.has(prev) || prev === "=")) ||
      (next && CURRENCY_WORDS.has(next))
    ) {
      amountIdx = k;
      break;
    }
  }
  if (amountIdx === -1 && amountCandidates.length > 0) {
    amountIdx = amountCandidates.length - 1; // last number wins by default
  }

  if (amountIdx === -1) {
    missingAmount = true;
  } else {
    amount = amountCandidates[amountIdx].n.value;
    const firstQty = amountCandidates.find((_, idx) => idx !== amountIdx);
    if (firstQty) qty = firstQty.n.value;
    // A lone number followed by product words is more likely a quantity:
    // "sold 3 shirts" (price missing) rather than "sold shirts for 3".
    if (amountCandidates.length === 1) {
      const n = amountCandidates[0].n;
      const after = toks.slice(n.end);
      const hasWordsAfter = after.some(
        (t) => /^[a-z][a-z0-9]*$/.test(t) &&
          !CURRENCY_WORDS.has(t) && !PREP_WORDS.has(t) && !STOP_WORDS.has(t),
      );
      const prev = toks[n.start - 1];
      const hasMoneyContext =
        (prev && (CURRENCY_WORDS.has(prev) || PREP_WORDS.has(prev))) ||
        (toks[n.end] && CURRENCY_WORDS.has(toks[n.end]));
      if (hasWordsAfter && !hasMoneyContext) {
        qty = n.value;
        amount = 0;
        missingAmount = true;
      }
    }
  }
  if (qty === undefined) qty = 1;
  if (amount > 1_000_000_000 || qty > 1_000_000) return null;

  // --- product / category ---
  let productName: string | undefined;
  const verbEnd = verb ? verb.index + verb.span : 0;
  const after: string[] = [];
  let skipUntil = verbEnd;
  const numTokenIdx = new Set<number>();
  for (const n of nums) {
    for (let i = n.start; i < n.end; i++) numTokenIdx.add(i);
  }
  for (let i = verbEnd; i < toks.length; i++) {
    const tok = toks[i];
    if (i < skipUntil) continue;
    if (numTokenIdx.has(i)) continue;
    if (CURRENCY_WORDS.has(tok) || PREP_WORDS.has(tok) || tok === "=") continue;
    if (FILLER_WORDS.has(tok) || STOP_WORDS.has(tok)) continue;
    if (tok === "deni" || tok === "debt" || tok === "mkopo") continue;
    // trailing "to <name>" / "kwa <name>" -> customer, not product
    if (
      (tok === "to" || tok === "kwa") &&
      i + 1 < toks.length &&
      i + 2 === toks.length &&
      /^[a-z][a-z0-9]*$/.test(toks[i + 1])
    ) {
      customerName = customerName ?? toks[i + 1];
      skipUntil = i + 2;
      continue;
    }
    after.push(tok);
  }
  if (after.length > 0) {
    productName = after.slice(0, 4).join(" ").trim();
  }

  // --- validation per type ---
  if (type === "debt" || type === "payment_received") {
    if (!customerName) return null;
    if (missingAmount) {
      // Only debt may proceed with a missing amount (assistant asks for it).
      return type === "debt"
        ? { type, amount: 0, missingAmount: true, customerName }
        : null;
    }
    return { type, amount, customerName, productName };
  }
  if (!productName) return null;
  return {
    type,
    productName,
    quantity: qty,
    amount,
    missingAmount: missingAmount || undefined,
    customerName,
  };
}

// ---------------------------------------------------------------------------
// Command matching (only reached when the message is not a transaction)
// ---------------------------------------------------------------------------

interface CmdPattern {
  command: ChatCommand;
  re: RegExp;
}

const COMMAND_PATTERNS: CmdPattern[] = [
  {
    command: "help",
    re: /\b(help|msaada|commands?|manual|what can (you|u) do|how (do|does) (you|u|it) work)\b/,
  },
  {
    command: "low_stock",
    re: /\blow\s?stock|stock\s+(is\s+)?low|iko\s+chini|za\s+chini|bidhaa\s+chini|out of stock|chini ya stock\b/,
  },
  { command: "report", re: /\b(report|ripoti|statement|pdf)\b/ },
  {
    command: "top_customers",
    re: /\b(?:top|best|bora|juu)\s+(?:customers?|wateja)|wateja\s+bora\b/,
  },
  {
    command: "customers",
    re: /\b(customers?|wateja|debts?|madeni|balance|balansi|deni|who\s+owes|owes\s+me|nani\s+ananidai)\b/,
  },
  { command: "inventory", re: /\b(inventory|stock|stocks|bidhaa)\b/ },
  { command: "profit", re: /\b(profit|faida|margin|gain)\b/ },
  { command: "expenses", re: /\b(expenses?|gharama|matumizi|spending)\b/ },
  { command: "sales", re: /\b(sales?|mauzo|revenue|mapato|sold|sell|nimeuza)\b/ },
  {
    command: "summary",
    re: /\b(summary|muhtasari|overview|dashboard|how am i doing|hali)\b/,
  },
];

function detectRange(text: string): Range {
  if (/\b(today|leo)\b/.test(text)) return "today";
  if (/\b(this week|last week|week|weekly|wiki|juma|7 days)\b/.test(text)) return "week";
  if (/\b(this month|last month|month|monthly|mwezi|30 days)\b/.test(text)) return "month";
  if (/\b(all time|all|yote|ever|so far|kuanzia)\b/.test(text)) return "all";
  return "today";
}

// ---------------------------------------------------------------------------
// Inventory question engine: "how many shirts left", "stock imebaki ngapi",
// "shirts remaining?", "stock of shirts", ...
// ---------------------------------------------------------------------------

const INV_Q_RE =
  /\b(?:how many|how much|ngapi|mangapi|kiasi gani|remaining|left|imebaki|zimebaki|nimebaki|baki|stock of|stock levels?|levels? ya|onyesha stock|do i have|niko na|iko na)\b/;

const INV_Q_STOP = new Set([
  "how", "many", "much", "left", "remaining", "remain", "remains", "stock",
  "stocks", "of", "show", "do", "i", "we", "have", "has", "is", "are",
  "there", "what", "about", "check", "level", "levels", "inventory",
  "balance", "ngapi", "mangapi", "kiasi", "gani", "imebaki", "zimebaki",
  "nimebaki", "baki", "onyesha", "na", "the", "a", "an", "for", "still",
  "yet", "quantity", "qty", "in", "it", "my", "me", "please", "tafadhali",
  "bidhaa", "products", "product", "item", "items", "all", "value",
]);

/**
 * Detect an inventory question and extract the product being asked about.
 * Returns null when the message isn't an inventory question, undefined when
 * it is a general one ("show inventory" / "onyesha stock"), or the product
 * name ("shirts").
 */
function detectInventoryQuery(normalized: string): string | undefined | null {
  if (!INV_Q_RE.test(normalized)) return null;
  const tokens = normalized.split(" ").filter(Boolean);
  const product = tokens
    .filter((t) => !INV_Q_STOP.has(t) && !/^\d+(?:\.\d+)?$/.test(t))
    .slice(0, 3)
    .join(" ")
    .trim();
  return product.length > 0 ? product : undefined;
}

// ---------------------------------------------------------------------------
// Per-customer queries: "john balance", "balance ya john", "mary history",
// "show john transactions"
// ---------------------------------------------------------------------------

const GENERIC_NAME_WORDS = new Set([
  "customer", "customers", "wateja", "stock", "debt", "debts", "madeni",
  "balance", "balances", "report", "sales", "profit", "expenses",
  "inventory", "summary", "help", "show", "check", "my", "who", "what",
  "mimi", "i", "we", "the", "low", "top", "all", "today", "week", "month",
]);

function extractCustomerQuery(
  normalized: string,
): { command: "customer_balance" | "customer_history"; name: string } | null {
  const balance =
    /\b(?:balance|balansi|saldo|deni)\s+(?:ya|wa|of|for|la)\s+([a-z][a-z0-9]{1,15})\b/.exec(
      normalized,
    ) ??
    /\b([a-z][a-z0-9]{1,15})\s+(?:balance|balansi|saldo)\b/.exec(normalized);
  if (balance && !GENERIC_NAME_WORDS.has(balance[1])) {
    return { command: "customer_balance", name: balance[1] };
  }
  const history =
    /\b(?:history|historia|transactions?|statement)\s+(?:of|for|ya|wa)\s+([a-z][a-z0-9]{1,15})\b/.exec(
      normalized,
    ) ??
    /\b([a-z][a-z0-9]{1,15})\s+(?:history|historia|transactions?)\b/.exec(
      normalized,
    ) ??
    /\b(?:show|onyesha)\s+([a-z][a-z0-9]{1,15})\s+transactions?\b/.exec(
      normalized,
    );
  if (history && !GENERIC_NAME_WORDS.has(history[1])) {
    return { command: "customer_history", name: history[1] };
  }
  return null;
}

function matchCommand(
  normalized: string,
): { kind: "command"; command: ChatCommand; range: Range; name?: string } | null {
  // Inventory questions win over the generic inventory command so that
  // "how many shirts left" is not treated as a full stock listing.
  const invProduct = detectInventoryQuery(normalized);
  if (invProduct !== null) {
    return {
      kind: "command",
      command: "inventory_query",
      range: "all",
      name: invProduct,
    };
  }

  const customerQuery = extractCustomerQuery(normalized);
  if (customerQuery) {
    return {
      kind: "command",
      command: customerQuery.command,
      range: "all",
      name: titleCase(customerQuery.name),
    };
  }

  for (const p of COMMAND_PATTERNS) {
    if (p.re.test(normalized)) {
      let range = detectRange(normalized);
      const stateful =
        p.command === "inventory" ||
        p.command === "low_stock" ||
        p.command === "customers" ||
        p.command === "top_customers";
      // Stock & customer questions are about current state, not a period.
      if (stateful && !/\b(today|leo)\b/.test(normalized)) range = "all";
      if (
        p.command === "report" &&
        !/\b(today|leo|week|weekly|wiki|juma|month|monthly|mwezi|all|yote)\b/.test(
          normalized,
        )
      ) {
        range = "month";
      }
      return { kind: "command", command: p.command, range };
    }
  }
  return null;
}

/**
 * Entry point: parse a raw chat message from the business owner.
 * Transactions win over commands so "I sold 3 shirts" is never mistaken
 * for a sales question.
 */
export function parseMessage(raw: string): ParseResult {
  const normalized = normalizeText(raw);
  if (!normalized) return { kind: "unknown" };
  const tx = tryParseTransaction(normalized);
  if (tx) return { kind: "transaction", tx };
  const cmd = matchCommand(normalized);
  if (cmd) return cmd;
  return { kind: "unknown" };
}

// ---------------------------------------------------------------------------
// Multi-command input: split one message into several independent commands,
// e.g. "Bought stock KES 5000\nPaid transport KES 500\nSold shirts KES 2000".
// ---------------------------------------------------------------------------

const SEGMENT_SPLIT_RE = /\n+|;+|\s+(?:and then|then|kisha|halafu)\s+/i;

/**
 * Parse a raw message, splitting it on newlines / semicolons / "then" when
 * that yields at least two recognizable commands. Falls back to parsing the
 * whole message as one when the split doesn't clearly help, so existing
 * single-command behaviour is preserved.
 */
export function parseInput(
  raw: string,
): { text: string; result: ParseResult }[] {
  const segments = raw
    .split(SEGMENT_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  if (segments.length > 1) {
    const parts = segments.map((s) => ({ text: s, result: parseMessage(s) }));
    const meaningful = parts.filter((p) => p.result.kind !== "unknown");
    if (meaningful.length >= 2) return parts;
  }
  return [{ text: raw, result: parseMessage(raw) }];
}
