// LLM parsing layer: natural language -> structured intent.
// Uses Groq (free tier, OpenAI-compatible API) with JSON mode.
// Reads GROQ_API_KEY from env; model overridable via GROQ_MODEL.

import { CATEGORIES, SOURCES, INTENTS } from "./constants.js";
import { todayISTymd } from "./dates.js";

const DEFAULT_MODEL = "openai/gpt-oss-120b";
const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt(text, today) {
  return `You are an expense-parsing engine for a personal finance app used by someone in India.
Today's date in IST is ${today} (YYYY-MM-DD). All amounts are INR. All dates are IST.
Input is casual Indian English: abbreviations, mixed context, and slang are all valid.

Classify the message into EXACTLY ONE intent and extract structured data.

INTENTS:
- ADD: a single new expense.
- SPLIT: an expense shared with other people; compute ONLY the user's share.
- UPDATE: correct/modify the most recent matching PAST expense.
- DELETE: remove the most recent matching PAST expense.

CATEGORIES (choose the single best fit): ${CATEGORIES.join(", ")}.
Infer "Investment" for SIPs, stocks, mutual funds, gold, FD, crypto, etc.

ITEM: set "item" to the actual item(s) or purpose spent on, as the user said them —
e.g. "spent 400 on biscuits and milk" -> item="biscuits, milk" (category="Groceries").
NEVER just repeat the category name. Only if the user gives no specific item
(e.g. "spent 400 on groceries") may item be the generic term.

PAYMENT SOURCE: set "source" to the payment method stated, lightly cleaned and
Title-Cased. It can be ANY custom card/wallet name, e.g. "Amazon ICICI Card",
"Amazon Pay Balance", "Flipkart Axis Card", "HDFC Debit Card". Short forms:
"gpay"/"google pay"->"GPay", "phonepe"->"PhonePe", "cc"->"Credit Card".
Generic options for reference: ${SOURCES.join(", ")}. If none mentioned, use "Other".

DATE: resolve relative dates ("today","yesterday","2 days ago","on the 3rd")
against today's IST date above. Output as YYYY-MM-DD. If none mentioned, use today.

SPLIT rules:
- Decide which items/amounts are the user's alone vs shared by the group.
- splitWith = total number of people sharing, INCLUDING the user.
- myShare = (sum of user's own items) + (shared amount / splitWith). Round to 2 decimals.
- The top-level "amount" MUST equal myShare.

UPDATE / DELETE rules:
- Never invent an id. Provide "match" to locate the most recent matching transaction:
  category and/or item keywords, and optional date (YYYY-MM-DD).
- For UPDATE also provide "patch" containing ONLY the fields that change.

Return ONLY a JSON object (no prose) with this shape:
{
  "intent": one of ${JSON.stringify(INTENTS)},
  "amount": number,            // ADD/SPLIT only; for SPLIT this is myShare
  "category": string,          // ADD/SPLIT
  "item": string,              // ADD/SPLIT: the actual item(s)/purpose, NOT the category
  "source": string,            // ADD/SPLIT
  "date": "YYYY-MM-DD",        // ADD/SPLIT
  "splitInfo": {               // SPLIT only
    "totalBill": number,
    "myItems": [string],
    "sharedItems": [string],
    "splitWith": number,
    "myShare": number
  },
  "match": {                   // UPDATE/DELETE only
    "category": string,        // optional
    "keywords": [string],      // optional words from the item/description
    "date": "YYYY-MM-DD"       // optional
  },
  "patch": {                   // UPDATE only; only changed fields
    "amount": number,
    "category": string,
    "item": string,
    "source": string
  }
}

User message: """${text}"""`;
}

const closest = (val, allowed, fallback) => {
  if (!val) return fallback;
  const hit = allowed.find((a) => a.toLowerCase() === String(val).toLowerCase());
  return hit || fallback;
};

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

/** Validate + coerce the model's raw output into a trusted shape. */
function normalize(raw, today) {
  const intent = String(raw.intent || "").toUpperCase();
  if (!INTENTS.includes(intent)) {
    throw new Error(`Model returned unknown intent: ${raw.intent}`);
  }

  if (intent === "ADD" || intent === "SPLIT") {
    const out = {
      intent,
      amount: num(raw.amount),
      category: closest(raw.category, CATEGORIES, "Other"),
      item: String(raw.item || "").trim(),
      source: raw.source ? String(raw.source).trim() : "Other", // free-form
      date: /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : today,
    };
    if (out.amount === undefined || out.amount < 0) {
      throw new Error("Model did not return a valid amount");
    }
    if (intent === "SPLIT" && raw.splitInfo) {
      const s = raw.splitInfo;
      out.splitInfo = {
        totalBill: num(s.totalBill),
        myItems: Array.isArray(s.myItems) ? s.myItems.map(String) : [],
        sharedItems: Array.isArray(s.sharedItems) ? s.sharedItems.map(String) : [],
        splitWith: num(s.splitWith),
        myShare: num(s.myShare) ?? out.amount,
      };
      if (out.splitInfo.myShare !== undefined) out.amount = out.splitInfo.myShare;
    }
    return out;
  }

  // UPDATE / DELETE
  const match = raw.match || {};
  const out = {
    intent,
    match: {
      category: match.category ? closest(match.category, CATEGORIES, undefined) : undefined,
      keywords: Array.isArray(match.keywords) ? match.keywords.map(String).filter(Boolean) : [],
      date: /^\d{4}-\d{2}-\d{2}$/.test(match.date) ? match.date : undefined,
    },
  };
  if (intent === "UPDATE") {
    const p = raw.patch || {};
    const patch = {};
    if (num(p.amount) !== undefined) patch.amount = num(p.amount);
    if (p.category) patch.category = closest(p.category, CATEGORIES, undefined);
    if (typeof p.item === "string" && p.item.trim()) patch.item = p.item.trim();
    if (p.source) patch.source = String(p.source).trim(); // free-form
    Object.keys(patch).forEach((k) => patch[k] === undefined && delete patch[k]);
    if (Object.keys(patch).length === 0) {
      throw new Error("UPDATE intent but no fields to patch were found");
    }
    out.patch = patch;
  }
  return out;
}

/** Parse a natural-language message into a structured, validated intent object. */
export async function parseExpense(text, env) {
  if (!env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set");
  if (!text || !text.trim()) throw new Error("Empty input text");

  const today = todayISTymd();
  const model = env.GROQ_MODEL || DEFAULT_MODEL;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are an expense-parsing engine. Respond with only a single JSON object." },
        { role: "user", content: buildPrompt(text, today) },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Groq API error ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Model returned no content");

  let raw;
  try {
    raw = JSON.parse(content);
  } catch {
    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    raw = JSON.parse(cleaned);
  }

  return normalize(raw, today);
}
