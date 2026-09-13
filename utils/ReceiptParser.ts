export interface BoundingFrame {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface MLKitTextElement {
  text: string;
  frame?: BoundingFrame;
}

export interface MLKitTextLine {
  text: string;
  frame?: BoundingFrame;
  elements?: MLKitTextElement[];
}

export interface MLKitTextBlock {
  text: string;
  frame?: BoundingFrame;
  lines: MLKitTextLine[];
}

export interface MLKitRecognitionResult {
  text: string;
  blocks: MLKitTextBlock[];
}

export interface ReceiptItem {
  id: string;
  description: string;
  price: number;
  rawLine?: string;
}

export interface ParsedReceipt {
  merchant: string;
  date: string | null;
  totalAmount: number;
  items: ReceiptItem[];
  rawText: string;
  formattedNotes: string;
}

// ---------------------------------------------------------------------------
// Utility Bill & Meralco OCR Validation Types
// ---------------------------------------------------------------------------

export interface ValidatedAmountResult {
  /** The final parsed monetary value in Pesos/currency units */
  amount: number;
  /** The raw numeric string extracted from OCR */
  rawString: string;
  /** Whether a decimal period was present in the extracted string */
  hasPeriod: boolean;
  /** Whether the missing period fallback (/ 100) was applied */
  wasAdjustedByFallback: boolean;
}

export interface MeralcoChargeCategoryDef {
  key: string;
  label: string;
  patterns: RegExp[];
}

export interface MeralcoChargeItem {
  key: string;
  label: string;
  amount: number;
  rawString: string;
  hasPeriod: boolean;
  wasAdjustedByFallback: boolean;
}

export interface ParsedMeralcoBill extends ParsedReceipt {
  isUtilityBill: true;
  accountNumber: string | null;
  dueDate: string | null;
  pleasePayTotal: number;
  pleasePayRawString: string;
  pleasePayHasPeriod: boolean;
  pleasePayWasAdjusted: boolean;
  charges: Record<string, MeralcoChargeItem>;
  chargesList: MeralcoChargeItem[];
  totalFromCharges: number;
  confidenceScore: number;
}

// ---------------------------------------------------------------------------
// Meralco Charge Categories Definition
// ---------------------------------------------------------------------------

export const MERALCO_CHARGE_CATEGORIES: MeralcoChargeCategoryDef[] = [
  {
    key: 'generation',
    label: 'Generation',
    patterns: [
      /\bgeneration(?:\s*charges?|\s*cost)?\b/i,
      /\bgen\s*charge\b/i,
    ],
  },
  {
    key: 'transmission',
    label: 'Transmission',
    patterns: [
      /\btransmission(?:\s*charges?|\s*cost|wheel(?:ing)?)?\b/i,
      /\btrans\s*charge\b/i,
    ],
  },
  {
    key: 'system_loss',
    label: 'System Loss',
    patterns: [
      /\bsystem\s*loss(?:\s*charges?|\s*cost)?\b/i,
      /\bsys\s*loss\b/i,
    ],
  },
  {
    key: 'distribution',
    label: 'Distribution (Meralco)',
    patterns: [
      /\bdistribution\s*\(meralco\)/i,
      /\bdistribution(?:\s*charges?|\s*cost)?\b/i,
      /\bsupply\s*charge\b/i,
      /\bmetering\s*charge\b/i,
      /\bdist\s*charge\b/i,
    ],
  },
  {
    key: 'senior_citizen',
    label: 'Senior Citizen',
    patterns: [
      /\bsenior\s*citizen(?:\s*subsidy|\s*discount)?\b/i,
    ],
  },
  {
    key: 'government_taxes',
    label: 'Government Taxes',
    patterns: [
      /\bgovernment\s*taxes?\b/i,
      /\bgovt\s*taxes?\b/i,
      /\blocal\s*franchise\s*tax\b/i,
      /\bvalue\s*added\s*tax\b/i,
      /\bvat\s*(?:charges?|components?)?\b/i,
    ],
  },
  {
    key: 'universal_charges',
    label: 'Universal Charges',
    patterns: [
      /\buniversal\s*charges?\b/i,
      /\bmissionary\s*electrification\b/i,
      /\benvironmental\s*charge\b/i,
      /\bstranded\s*(?:debts|contract\s*costs?)\b/i,
      /\buc\s*(?:me|sd|ec)?\b/i,
    ],
  },
  {
    key: 'fit_all',
    label: 'FIT-All (Renewable)',
    patterns: [
      /\bfit[\s-]*all(?:\s*\(?renewable\)?)?\b/i,
      /\bfeed[\s-]*in\s*tariff(?:\s*allowance)?\b/i,
    ],
  },
  {
    key: 'gea_all',
    label: 'GEA-All (Renewable)',
    patterns: [
      /\bgea[\s-]*all(?:\s*\(?renewable\)?)?\b/i,
      /\bgreen\s*energy\s*auction(?:\s*allowance)?\b/i,
    ],
  },
  {
    key: 'lifeline',
    label: 'Lifeline',
    patterns: [
      /\blifeline(?:\s*rate)?(?:\s*subsidy|\s*discount)?\b/i,
    ],
  },
  {
    key: 'other_charges',
    label: 'Other Charges',
    patterns: [
      /\bother\s*charges?\b/i,
      /\bapplied\s*credits?\b/i,
      /\benergy\s*bill\b/i,
      /\badjustments?\b/i,
    ],
  },
];

// ---------------------------------------------------------------------------
// OCR Centavo Validation & Fallback
// ---------------------------------------------------------------------------

/**
 * Validation step: Checks the extracted number string for a decimal period.
 * Due to scanner hardware limitations (low DPI, binarization thresholding,
 * faint dot-matrix or thermal print), decimal points are frequently lost in OCR.
 *
 * If the period is missing:
 * Converts the string to a number and divides it by 100 to restore correct centavo placement.
 *
 * Examples:
 * - "3,542.50" -> hasPeriod: true  -> 3542.50
 * - "354250"   -> hasPeriod: false -> 3542.50 (restored by dividing 354250 / 100)
 * - "184215"   -> hasPeriod: false -> 1842.15
 * - "4500"     -> hasPeriod: false -> 45.00
 * - "45.00"    -> hasPeriod: true  -> 45.00
 *
 * @param raw - The raw numeric string extracted from OCR (e.g., "354250", "3,542.50", "₱ 184215")
 * @returns ValidatedAmountResult containing the normalized monetary amount and audit flags
 */
export function validateAndParseCentavoAmount(raw: string): ValidatedAmountResult {
  if (!raw || typeof raw !== 'string') {
    return { amount: 0, rawString: '', hasPeriod: false, wasAdjustedByFallback: false };
  }

  // 1. Check for negative sign or parentheses (e.g. -0.10 or (0.10) for discounts/subsidies)
  const isNegative = raw.includes('-') || /\(\s*[\d.,]+\s*\)/.test(raw);

  // 2. Strip currency symbols (₱, P, Php, PHP, $), spaces, and non-numeric characters
  const sanitized = raw.replace(/[₱\$\s]|PHP|Php|php/gi, '').trim();

  // 3. Extract contiguous numeric pattern (with optional comma grouping and optional decimal)
  const match = sanitized.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (!match) {
    return { amount: 0, rawString: raw, hasPeriod: false, wasAdjustedByFallback: false };
  }

  const extractedNumStr = match[0];

  // 4. Validation Step: Check if the extracted number string contains a period
  const hasPeriod = extractedNumStr.includes('.');

  // 5. Remove comma thousands separators
  const digitsOnlyStr = extractedNumStr.replace(/,/g, '');
  const parsedValue = parseFloat(digitsOnlyStr);

  if (isNaN(parsedValue)) {
    return { amount: 0, rawString: extractedNumStr, hasPeriod, wasAdjustedByFallback: false };
  }

  if (parsedValue === 0) {
    return { amount: 0, rawString: extractedNumStr, hasPeriod: true, wasAdjustedByFallback: false };
  }

  if (!hasPeriod) {
    // Hardware limitation fallback:
    // Period is missing; convert string to number and divide by 100 to restore centavo placement.
    const signedVal = isNegative ? -parsedValue : parsedValue;
    const restoredAmount = Number((signedVal / 100).toFixed(2));
    return {
      amount: restoredAmount,
      rawString: extractedNumStr,
      hasPeriod: false,
      wasAdjustedByFallback: true,
    };
  }

  // Period is present; format to 2 decimal places with proper sign
  const signedAmount = isNegative ? -parsedValue : parsedValue;
  return {
    amount: Number(signedAmount.toFixed(2)),
    rawString: extractedNumStr,
    hasPeriod: true,
    wasAdjustedByFallback: false,
  };
}

/**
 * Convenience wrapper returning directly the parsed amount with fallback.
 */
export function parseAmountWithCentavoFallback(raw: string): number {
  return validateAndParseCentavoAmount(raw).amount;
}

/**
 * Standard monetary parser for commercial receipts (does not divide by 100).
 * Handles numbers with or without comma separators and decimal points.
 * E.g. "1,862.95" -> 1862.95, "52.00" -> 52.00, "20" -> 20.00
 */
export function parseCurrencyAmount(raw: string): number {
  if (!raw || typeof raw !== 'string') return 0;
  const sanitized = raw.replace(/[₱\$\s]|PHP|Php|php/gi, '').trim();
  const match = sanitized.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  if (!match) return 0;
  const digits = match[0].replace(/,/g, '');
  const parsed = parseFloat(digits);
  return isNaN(parsed) || parsed <= 0 ? 0 : Number(parsed.toFixed(2));
}

/**
 * Checks whether a line represents a quantity multiplier (e.g. "2 X 61.75", "4 X 25.25", "2 @ 40.00")
 */
export function isMultiplierLine(text: string): boolean {
  return /^\s*\d{1,3}\s*[xX@*]\s*[\d,.]+\s*$/.test(text.trim());
}

/**
 * Extracts quantity and unit price from a multiplier line.
 */
export function parseMultiplier(text: string): { qty: number; unitPrice: number } | null {
  const match = text.trim().match(/^(\d{1,3})\s*[xX@*]\s*([\d,.]+)/);
  if (!match) return null;
  const qty = parseInt(match[1], 10);
  const unitPrice = parseCurrencyAmount(match[2]);
  return qty > 0 ? { qty, unitPrice } : null;
}

/**
 * Strips leading tax indicators (+, -, *, •, V, T), bullet points, and trailing symbols from item names.
 */
export function cleanItemDescription(desc: string): string {
  return desc
    .replace(/^[\s+*\-•vVtT]\s*/, '')
    .replace(/^[\d\s*xX.\-]+/, '')
    .replace(/[*\-=_#~]+$/, '')
    .trim();
}

// ---------------------------------------------------------------------------
// Non-item filter regular expressions
// ---------------------------------------------------------------------------

const EXCLUDED_PATTERNS = [
  // Tax lines & percentages
  /\b(?:tax|vat|vatable|vat-exempt|exempt|zero-rated|12%|percentage)\b/i,
  // Barcodes, SKUs, card numbers, and long number identifiers
  /\b(?:barcode|ean|sku|upc|item#|code#)\b/i,
  /\b\d{10,}\b/,
  /\b\d{4}[-\s]?\d{4}[-\s]?[xX0-9]{4}[-\s]?[xX0-9]{4}\b/,
  // Addresses, branches, and locations
  /\b(?:street|st\.|ave\.|avenue|blvd\.|boulevard|rd\.|road|brgy\.|barangay|city|bldg\.|building|mall|flr|floor|unit|drive|dr\.|poblacion)\b/i,
  // Contact & Business Registration (only match sn/min when followed by #, :, or digits)
  /\b(?:tin|tel|telephone|phone|fax|mobile|cel|contact|permit)\b/i,
  /\b(?:sn|min|serial)\s*[:#\d]/i,
  /\b(?:sn#|min#|si#)\b/i,
  // POS & transaction metadata
  /\b(?:cashier|terminal|pos|station|receipt\s*(?:no|#)?|invoice\s*(?:no|#)?|or\s*(?:no|#)?|txn\s*(?:no|#)?|trans\s*(?:no|#)?|order\s*(?:no|#)?|table|pax|guest|server|clerk|shift)\b/i,
  // Payment methods and tendering
  /\b(?:cash\s*tendered|change\s*due|offline\s*bdo|bdo\s*credit|visa\s*credit|mastercard|card\s*number)\b/i,
  // Summary header lines
  /\b(?:subtotal|sub-total|grand\s*total|amount\s*due|balance\s*due|please\s*pay)\b/i,
  // Greeting, courtesy, and footer notes
  /\b(?:thank\s*you|please\s*come\s*again|visit\s*again|customer\s*copy|store\s*copy|merchant\s*copy|keep\s*this\s*copy|powered\s*by|system\s*generated)\b/i,
  // Footer metadata (Auth, Terminal, Items Purchased, Loyalty)
  /\b(?:issuer(?:\s*name|\s*id)?|auth(?:\s*code)?|trace\s*no|ref\s*no|approval\s*code|items?\s*purchased|member\s*id|member\s*name|loyalty|points\s*earned)\b/i,
  /\b(?:vatable\s*sales?|vat\s*amount|net\s*sales?)\b/i,
  /^[*\-=_#~]+$/,
  /^php$/i,
];

/**
 * Checks whether a line matches non-item criteria (tax %, address, metadata, barcode, etc.)
 */
export function isNonItemLine(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  for (const pattern of EXCLUDED_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }
  return false;
}

/**
 * Extracts a price value from text (e.g. "₱ 1,250.50" -> 1250.50)
 */
export function extractPrice(text: string): number | null {
  const res = parseCurrencyAmount(text);
  return res > 0 ? res : null;
}

/**
 * Extracts the merchant name by taking the topmost recognized line of text.
 * Prioritizes recognizable store and supermarket brands.
 */
export function extractMerchant(blocks: MLKitTextBlock[], defaultFallback: string = 'Scanned Receipt'): string {
  const allLines: MLKitTextLine[] = [];
  for (const block of blocks) {
    if (block.lines) {
      allLines.push(...block.lines);
    }
  }

  // Sort lines by vertical position (y / top coordinate) ascending
  allLines.sort((a, b) => {
    const topA = a.frame?.top ?? 99999;
    const topB = b.frame?.top ?? 99999;
    return topA - topB;
  });

  // Check top 12 lines for common store brand identifiers
  const brandKeywords = /\b(?:savemore|sm\s*(?:supermarket|hypermarket|markets?|store|bonus)?|puregold|robinsons|walmart|wal-mart|7-eleven|alfamart|target|costco|meralco|starbucks|jollibee|mcdonald|kfc)\b/i;
  for (let i = 0; i < Math.min(12, allLines.length); i++) {
    const text = allLines[i].text.trim();
    if (brandKeywords.test(text) && !isNonItemLine(text)) {
      return cleanItemDescription(text);
    }
  }

  // Fallback: pick first substantive line that doesn't look like an address, barcode, or metadata
  for (const line of allLines) {
    const text = line.text.trim();
    if (text.length >= 3 && !isNonItemLine(text) && /[a-zA-Z]/.test(text)) {
      return cleanItemDescription(text);
    }
  }

  return defaultFallback;
}

/**
 * Parses date formats: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YY, Month DD YYYY
 * Normalizes into ISO YYYY-MM-DD.
 */
export function extractDate(fullText: string): string | null {
  // Regex 1: YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = fullText.match(/\b(20\d{2})[-/.](0[1-9]|1[0-2])[-/.](0[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  // Regex 2: MM/DD/YYYY or MM-DD-YYYY
  const mdyMatch = fullText.match(/\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](20\d{2})\b/);
  if (mdyMatch) {
    const m = mdyMatch[1].padStart(2, '0');
    const d = mdyMatch[2].padStart(2, '0');
    const y = mdyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Regex 3: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = fullText.match(/\b(0?[1-9]|[12]\d|3[01])[-/.](0?[1-9]|1[0-2])[-/.](20\d{2})\b/);
  if (dmyMatch) {
    const d = dmyMatch[1].padStart(2, '0');
    const m = dmyMatch[2].padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // Regex 4: MM/DD/YY or DD/MM/YY (2-digit year)
  const shortYearMatch = fullText.match(/\b(0?[1-9]|1[0-2])[-/.](0?[1-9]|[12]\d|3[01])[-/.](2\d)\b/);
  if (shortYearMatch) {
    const m = shortYearMatch[1].padStart(2, '0');
    const d = shortYearMatch[2].padStart(2, '0');
    const y = `20${shortYearMatch[3]}`;
    return `${y}-${m}-${d}`;
  }

  // Regex 5: Named months (e.g. Oct 25, 2026 or 25 Oct 2026 or October 25 2026)
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
    january: '01', february: '02', march: '03', april: '04', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };

  const namedMonthMatch = fullText.match(/\b([a-zA-Z]{3,9})\s+(\d{1,2})[,\s]+(20\d{2})\b/i) ||
                          fullText.match(/\b(\d{1,2})\s+([a-zA-Z]{3,9})[,\s]+(20\d{2})\b/i);

  if (namedMonthMatch) {
    const isFirstAlpha = isNaN(parseInt(namedMonthMatch[1], 10));
    const monthStr = (isFirstAlpha ? namedMonthMatch[1] : namedMonthMatch[2]).toLowerCase();
    const dayStr = (isFirstAlpha ? namedMonthMatch[2] : namedMonthMatch[1]).padStart(2, '0');
    const yearStr = namedMonthMatch[3];

    const monthNum = monthMap[monthStr] || monthMap[monthStr.substring(0, 3)];
    if (monthNum) {
      return `${yearStr}-${monthNum}-${dayStr}`;
    }
  }

  return null;
}

/**
 * Searches for keywords like 'Total', 'Amount Due', 'Subtotal', or 'Please Pay' and extracts
 * the numeric value. Handles both single-line and multi-column (two-block) receipt layouts.
 */
export function extractTotalAmount(blocks: MLKitTextBlock[], rawText: string): number {
  const totalKeywords = /\b(?:grand\s*total|total\s*amount(?:\s*due)?|amount\s*due|total\b|net\s*amount|please\s*pay(?:\s*on\s*or\s*before)?|balance\s*due)\b/i;
  const subtotalKeywords = /\b(?:subtotal|sub-total)\b/i;
  const paymentKeywords = /\b(?:offline\s*bdo|bdo\s*credit|visa|mastercard|debit\s*card|cash\s*tendered)\b/i;

  let grandTotalCandidate = 0;
  let subtotalCandidate = 0;
  let paymentCandidate = 0;

  // Flatten lines
  const allLines: MLKitTextLine[] = [];
  for (const block of blocks) {
    if (block.lines) {
      allLines.push(...block.lines);
    }
  }

  // Pass 1: Direct single-line regex match on block lines
  for (const line of allLines) {
    const text = line.text.trim();
    if (totalKeywords.test(text)) {
      const numMatches = text.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g);
      if (numMatches) {
        for (const m of numMatches) {
          const val = parseCurrencyAmount(m);
          if (val > grandTotalCandidate && val < 1000000) {
            grandTotalCandidate = val;
          }
        }
      }
    } else if (subtotalKeywords.test(text)) {
      const numMatches = text.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g);
      if (numMatches) {
        for (const m of numMatches) {
          const val = parseCurrencyAmount(m);
          if (val > subtotalCandidate && val < 1000000) {
            subtotalCandidate = val;
          }
        }
      }
    } else if (paymentKeywords.test(text)) {
      const numMatches = text.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g);
      if (numMatches) {
        for (const m of numMatches) {
          const val = parseCurrencyAmount(m);
          if (val > paymentCandidate && val < 1000000) {
            paymentCandidate = val;
          }
        }
      }
    }
  }

  // Pass 2: Multi-column bounding frame alignment (Total label in left block, price in right block)
  if (grandTotalCandidate === 0 && allLines.length > 0) {
    for (const line of allLines) {
      if (totalKeywords.test(line.text) && line.frame) {
        const centerY = line.frame.top + line.frame.height / 2;
        const tol = Math.max(30, line.frame.height * 1.5);
        for (const other of allLines) {
          if (!other.frame) continue;
          if (other.frame.left < line.frame.left + 5) continue; // must be to the right
          const diff = Math.abs((other.frame.top + other.frame.height / 2) - centerY);
          if (diff <= tol) {
            const val = parseCurrencyAmount(other.text);
            if (val > grandTotalCandidate && val < 1000000) {
              grandTotalCandidate = val;
            }
          }
        }
      }
      if (grandTotalCandidate > 0) break;
    }
  }

  // Pass 3: Raw text lines fallback
  if (grandTotalCandidate === 0) {
    const rawLines = rawText.split('\n');
    for (const line of rawLines) {
      if (totalKeywords.test(line)) {
        const numMatches = line.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g);
        if (numMatches) {
          for (const m of numMatches) {
            const val = parseCurrencyAmount(m);
            if (val > grandTotalCandidate && val < 1000000) {
              grandTotalCandidate = val;
            }
          }
        }
      }
    }
  }

  return grandTotalCandidate || subtotalCandidate || paymentCandidate || 0;
}

interface PriceItemBox {
  text: string;
  price: number;
  frame: BoundingFrame;
  centerY: number;
}

interface DescItemBox {
  text: string;
  frame: BoundingFrame;
  centerY: number;
}

/**
 * Builds a line-item parser supporting:
 * 1. Single-line item formats: "[+][Description] [Price]"
 * 2. Multi-line quantity headers: "2 X 61.75" followed by "DwnyFbconPessn6+1 123.50"
 * 3. Multi-column layouts where ML Kit separates descriptions and prices into distinct blocks
 * 4. Automatic suppression of footer metadata (AUTH CODE, ITEMS PURCHASED, MEMBER ID, etc.)
 */
export function extractLineItems(blocks: MLKitTextBlock[], rawText?: string): ReceiptItem[] {
  // Strategy 1: Check rawText lines (most accurate when lines have description and price together)
  const fullText = rawText || (blocks ? blocks.map(b => b.text).join('\n') : '');
  const rawLines = fullText.split('\n').map(l => l.trim()).filter(Boolean);

  let hasHitTotal = false;
  let pendingMult: { qty: number; unitPrice: number } | null = null;
  const singleLineItems: ReceiptItem[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Stop item parsing once summary/total section begins
    if (/\b(?:subtotal|sub-total|grand\s*total|total\b|amount\s*due|please\s*pay)\b/i.test(line)) {
      hasHitTotal = true;
      break;
    }
    if (hasHitTotal) break;

    // Check for quantity multiplier line (e.g. "2 X 61.75", "4 X 25.25", "2 @ 40.00")
    const mult = parseMultiplier(line);
    if (mult) {
      pendingMult = mult;
      continue;
    }

    if (isNonItemLine(line)) {
      pendingMult = null;
      continue;
    }

    // Match item description with price at the end
    const itemMatch = line.match(/^(.+?)\s+(?:[₱\$\s]|PHP|Php)?((?:\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?))$/i);
    if (itemMatch) {
      const rawDesc = itemMatch[1];
      const cleanDesc = cleanItemDescription(rawDesc);
      const price = parseCurrencyAmount(itemMatch[2]);

      if (cleanDesc.length >= 2 && price > 0 && !isNonItemLine(cleanDesc)) {
        let desc = cleanDesc;
        if (pendingMult) {
          desc = `${cleanDesc} (${pendingMult.qty}x @ ₱${pendingMult.unitPrice.toFixed(2)})`;
        }
        singleLineItems.push({
          id: `item_${singleLineItems.length + 1}_${Date.now()}`,
          description: desc,
          price,
          rawLine: line,
        });
        pendingMult = null;
        continue;
      }
    }

    pendingMult = null;
  }

  // If Strategy 1 successfully extracted items, return them
  if (singleLineItems.length >= 2) {
    return singleLineItems;
  }

  // Strategy 2: Multi-column bounding frame alignment
  const allLines: MLKitTextLine[] = [];
  for (const b of blocks) {
    if (b.lines) allLines.push(...b.lines);
  }

  if (allLines.length === 0) {
    return singleLineItems;
  }

  // Identify where total/subtotal starts vertically to avoid parsing footer metadata
  let totalBoundaryY = 999999;
  for (const line of allLines) {
    if (/\b(?:subtotal|sub-total|grand\s*total|total\b|amount\s*due|please\s*pay)\b/i.test(line.text) && line.frame) {
      if (line.frame.top < totalBoundaryY) {
        totalBoundaryY = line.frame.top;
      }
    }
  }

  const descCandidates: DescItemBox[] = [];
  const priceCandidates: PriceItemBox[] = [];
  const multiplierLines: { text: string; centerY: number; frame: BoundingFrame; mult: { qty: number; unitPrice: number } | null }[] = [];

  for (const line of allLines) {
    const text = line.text.trim();
    if (!line.frame) continue;

    // Skip lines below total boundary for item parsing
    if (line.frame.top >= totalBoundaryY) continue;

    if (isMultiplierLine(text)) {
      multiplierLines.push({
        text,
        centerY: line.frame.top + line.frame.height / 2,
        frame: line.frame,
        mult: parseMultiplier(text),
      });
      continue;
    }

    // Check if line is purely a price
    const cleanNum = text.replace(/^[₱\$\s]|PHP|Php/gi, '').trim();
    if (/^\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?$/.test(cleanNum)) {
      const pVal = parseCurrencyAmount(cleanNum);
      if (pVal > 0 && pVal < 500000) {
        priceCandidates.push({
          text: cleanNum,
          price: pVal,
          frame: line.frame,
          centerY: line.frame.top + line.frame.height / 2,
        });
      }
    } else if (/[a-zA-Z]/.test(text) && !isNonItemLine(text)) {
      descCandidates.push({
        text,
        frame: line.frame,
        centerY: line.frame.top + line.frame.height / 2,
      });
    }
  }

  descCandidates.sort((a, b) => a.centerY - b.centerY);
  priceCandidates.sort((a, b) => a.centerY - b.centerY);
  multiplierLines.sort((a, b) => a.centerY - b.centerY);

  const multiColumnItems: ReceiptItem[] = [];
  const usedPriceIndices = new Set<number>();
  const usedMultIndices = new Set<number>();

  for (const desc of descCandidates) {
    let bestIdx = -1;
    let minDiff = 9999;
    const tolerance = Math.max(30, desc.frame.height * 1.6);

    for (let i = 0; i < priceCandidates.length; i++) {
      if (usedPriceIndices.has(i)) continue;
      const p = priceCandidates[i];
      if (p.frame.left < desc.frame.left + 5) continue;
      const diff = Math.abs(desc.centerY - p.centerY);
      if (diff <= tolerance && diff < minDiff) {
        minDiff = diff;
        bestIdx = i;
      }
    }

    if (bestIdx !== -1) {
      usedPriceIndices.add(bestIdx);
      const cleanDesc = cleanItemDescription(desc.text);

      let multInfo = '';
      for (let m = 0; m < multiplierLines.length; m++) {
        if (usedMultIndices.has(m)) continue;
        const mult = multiplierLines[m];
        if (mult.centerY < desc.centerY && (desc.centerY - mult.centerY) <= desc.frame.height * 2.5) {
          usedMultIndices.add(m);
          if (mult.mult) {
            multInfo = ` (${mult.mult.qty}x @ ₱${mult.mult.unitPrice.toFixed(2)})`;
          }
          break;
        }
      }

      if (cleanDesc.length >= 2 && !isNonItemLine(cleanDesc)) {
        multiColumnItems.push({
          id: `item_${multiColumnItems.length + 1}_${Date.now()}`,
          description: `${cleanDesc}${multInfo}`,
          price: priceCandidates[bestIdx].price,
          rawLine: `${desc.text} ${priceCandidates[bestIdx].price}`,
        });
      }
    }
  }

  // Return whichever strategy yielded more items
  return multiColumnItems.length > singleLineItems.length ? multiColumnItems : singleLineItems;
}

// ---------------------------------------------------------------------------
// Specialized Utility Bill / Meralco OCR Parser
// ---------------------------------------------------------------------------

/**
 * Checks if the OCR text corresponds to a Meralco electric bill or similar utility bill.
 */
export function isMeralcoBill(rawText: string): boolean {
  const lower = rawText.toLowerCase();
  if (lower.includes('meralco') || lower.includes('manila electric')) {
    return true;
  }
  const matchedCategories = MERALCO_CHARGE_CATEGORIES.filter(cat =>
    cat.patterns.some(p => p.test(lower))
  );
  if (matchedCategories.length >= 3) {
    return true;
  }
  const hasTotal = /please\s*pay|total\s*amount\s*due|amount\s*due/i.test(lower);
  return hasTotal && matchedCategories.length >= 2;
}

/**
 * Parses a Meralco electricity utility bill from ML Kit OCR results or raw text.
 * Applies the period validation step and /100 division fallback to:
 * 1. The "Please Pay" / "Total Amount Due" total
 * 2. All individual Meralco charge categories (including subsidies/negative numbers and zero charges)
 */
export function parseMeralcoBill(
  input: MLKitRecognitionResult | string,
  currencySymbol: string = '₱'
): ParsedMeralcoBill {
  const rawText = typeof input === 'string' ? input : input.text || '';
  const blocks = typeof input === 'string' ? [] : input.blocks || [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  // 1. Account Number Extraction
  let accountNumber: string | null = null;
  const accMatch = rawText.match(/\b(?:account\s*(?:no|#|num)?[:\s]*)(\d{4}[-\s]?\d{4}[-\s]?\d{4}|\d{10,12})\b/i);
  if (accMatch) {
    accountNumber = accMatch[1].replace(/[-\s]/g, '');
  }

  // 2. Dates Extraction (Bill Date, Due Date)
  let billDate: string | null = null;
  let dueDate: string | null = null;

  const billDateMatch = rawText.match(/bill\s*date[:\s]*([a-zA-Z0-9\s,/-]+)/i);
  if (billDateMatch) {
    billDate = extractDate(billDateMatch[1]);
  }
  const dueDateMatch = rawText.match(/due\s*date[:\s]*([a-zA-Z0-9\s,/-]+)/i);
  if (dueDateMatch) {
    dueDate = extractDate(dueDateMatch[1]);
  }
  if (!billDate) billDate = extractDate(rawText);

  // 3. Extract "Please Pay" / "Total Amount Due" Total
  const pleasePayRegex = /\b(?:please\s*pay(?:\s*on\s*or\s*before)?|total\s*amount\s*due|total\s*current\s*amount|total\b|amount\s*due)\b/i;
  let pleasePayResult: ValidatedAmountResult = { amount: 0, rawString: '', hasPeriod: false, wasAdjustedByFallback: false };

  // Pass A: Check same line for total amount
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (pleasePayRegex.test(line)) {
      const numMatches = line.match(/(?:-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)/g);
      if (numMatches && numMatches.length > 0) {
        const valRes = validateAndParseCentavoAmount(numMatches[numMatches.length - 1]);
        if (valRes.amount > 0) {
          pleasePayResult = valRes;
          break;
        }
      }
    }
  }

  // Pass B: Bounding frame alignment for Total Amount Due (two-column layout)
  if (pleasePayResult.amount === 0 && blocks.length > 0) {
    const allBlockLines: MLKitTextLine[] = [];
    for (const b of blocks) {
      if (b.lines) allBlockLines.push(...b.lines);
    }
    for (const bLine of allBlockLines) {
      if (pleasePayRegex.test(bLine.text) && bLine.frame) {
        const centerY = bLine.frame.top + bLine.frame.height / 2;
        const tol = Math.max(30, bLine.frame.height * 1.5);
        for (const other of allBlockLines) {
          if (!other.frame) continue;
          if (other.frame.left < bLine.frame.left + 5) continue;
          const diff = Math.abs((other.frame.top + other.frame.height / 2) - centerY);
          if (diff <= tol) {
            const numMatch = other.text.match(/(?:-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)/);
            if (numMatch) {
              const valRes = validateAndParseCentavoAmount(numMatch[0]);
              if (valRes.amount > 0) {
                pleasePayResult = valRes;
                break;
              }
            }
          }
        }
      }
      if (pleasePayResult.amount > 0) break;
    }
  }

  // Pass C: Fallback to next line in lines array
  if (pleasePayResult.amount === 0) {
    for (let i = 0; i < lines.length; i++) {
      if (pleasePayRegex.test(lines[i]) && i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (/^(?:[₱\$\s]|PHP|Php)*\s*[\d,]+(?:\.\d+)?\s*$/i.test(nextLine)) {
          const res = validateAndParseCentavoAmount(nextLine);
          if (res.amount > 0) {
            pleasePayResult = res;
            break;
          }
        }
      }
    }
  }

  // 4. Extract All Individual Meralco Charge Categories
  const charges: Record<string, MeralcoChargeItem> = {};
  const chargesList: MeralcoChargeItem[] = [];

  // Strategy 1: Check lines where label and price are together
  const lineMatchedItems: MeralcoChargeItem[] = [];
  for (const catDef of MERALCO_CHARGE_CATEGORIES) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!catDef.patterns.some(p => p.test(line))) continue;

      const numMatches = line.match(/(?:-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)/g);
      if (numMatches && numMatches.length > 0) {
        const rawNum = numMatches[numMatches.length - 1];
        const valRes = validateAndParseCentavoAmount(rawNum);
        lineMatchedItems.push({
          key: catDef.key,
          label: catDef.label,
          amount: valRes.amount,
          rawString: valRes.rawString,
          hasPeriod: valRes.hasPeriod,
          wasAdjustedByFallback: valRes.wasAdjustedByFallback,
        });
        break;
      }
    }
  }

  if (lineMatchedItems.length >= 3) {
    for (const item of lineMatchedItems) {
      charges[item.key] = item;
      chargesList.push(item);
    }
  } else if (blocks.length > 0) {
    // Strategy 2: Multi-column bounding box search with best candidate pairing
    const allBlockLines: MLKitTextLine[] = [];
    for (const b of blocks) {
      if (b.lines) allBlockLines.push(...b.lines);
    }

    const usedPriceIndices = new Set<number>();
    for (const catDef of MERALCO_CHARGE_CATEGORIES) {
      let bestCandidate: { idx: number; item: MeralcoChargeItem } | null = null;
      let minDiff = 9999;

      for (const bLine of allBlockLines) {
        if (!catDef.patterns.some(p => p.test(bLine.text))) continue;
        if (!bLine.frame) continue;
        const centerY = bLine.frame.top + bLine.frame.height / 2;

        for (let c = 0; c < allBlockLines.length; c++) {
          if (usedPriceIndices.has(c)) continue;
          const candidate = allBlockLines[c];
          if (!candidate.frame) continue;
          if (candidate.frame.left < bLine.frame.left + 5) continue;
          const diff = Math.abs((candidate.frame.top + candidate.frame.height / 2) - centerY);
          if (diff <= Math.max(25, bLine.frame.height * 1.5) && diff < minDiff) {
            const numMatch = candidate.text.match(/(?:-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:\.\d+)?)/);
            if (numMatch) {
              const valRes = validateAndParseCentavoAmount(numMatch[0]);
              minDiff = diff;
              bestCandidate = {
                idx: c,
                item: {
                  key: catDef.key,
                  label: catDef.label,
                  amount: valRes.amount,
                  rawString: valRes.rawString,
                  hasPeriod: valRes.hasPeriod,
                  wasAdjustedByFallback: valRes.wasAdjustedByFallback,
                }
              };
            }
          }
        }
      }

      if (bestCandidate) {
        usedPriceIndices.add(bestCandidate.idx);
        charges[bestCandidate.item.key] = bestCandidate.item;
        chargesList.push(bestCandidate.item);
      }
    }
  }

  // 5. Total from individual charges & confidence score calculation
  const totalFromCharges = Number(chargesList.reduce((sum, item) => sum + item.amount, 0).toFixed(2));

  let confidenceScore = 0.5;
  if (pleasePayResult.amount > 0 && totalFromCharges > 0) {
    const diff = Math.abs(pleasePayResult.amount - totalFromCharges);
    if (diff < 1.0) {
      confidenceScore = 1.0; // High confidence: Breakdown sum exactly reconciles with Please Pay
    } else if (diff < 10.0) {
      confidenceScore = 0.85;
    }
  }

  // Map individual Meralco charge categories into ReceiptItem list
  const receiptItems: ReceiptItem[] = chargesList.map((item, idx) => {
    const isNeg = item.amount < 0;
    const formattedPrice = isNeg 
      ? `-${currencySymbol}${Math.abs(item.amount).toFixed(2)}` 
      : `${currencySymbol}${item.amount.toFixed(2)}`;
    return {
      id: `meralco_${item.key}_${Date.now()}_${idx}`,
      description: item.label,
      price: item.amount,
      rawLine: `${item.label}: ${formattedPrice}${item.wasAdjustedByFallback ? ' (centavos restored)' : ''}`
    };
  });

  // Determine final total
  const finalTotal = pleasePayResult.amount > 0 ? pleasePayResult.amount : totalFromCharges;

  // Generate formatted notes
  const notesLines: string[] = [];
  notesLines.push('=== UTILITY BILL: MERALCO ===');
  if (accountNumber) notesLines.push(`Account No: ${accountNumber}`);
  if (billDate) notesLines.push(`Bill Date: ${billDate}`);
  if (dueDate) notesLines.push(`Due Date: ${dueDate}`);
  notesLines.push('------------------------------');
  notesLines.push('BREAKDOWN OF CHARGES:');
  for (const c of chargesList) {
    const fallbackFlag = c.wasAdjustedByFallback ? ' [missing period fixed]' : '';
    const formattedVal = c.amount < 0 
      ? `-${currencySymbol}${Math.abs(c.amount).toFixed(2)}` 
      : `${currencySymbol}${c.amount.toFixed(2)}`;
    notesLines.push(`• ${c.label}: ${formattedVal}${fallbackFlag}`);
  }
  notesLines.push('------------------------------');
  notesLines.push(`Charges Subtotal: ${currencySymbol}${totalFromCharges.toFixed(2)}`);
  const pleasePayFallbackFlag = pleasePayResult.wasAdjustedByFallback ? ' [missing period fixed]' : '';
  notesLines.push(`PLEASE PAY: ${currencySymbol}${finalTotal.toFixed(2)}${pleasePayFallbackFlag}`);

  return {
    merchant: 'MERALCO',
    date: dueDate || billDate || new Date().toISOString().split('T')[0],
    totalAmount: finalTotal,
    items: receiptItems,
    rawText,
    formattedNotes: notesLines.join('\n'),
    isUtilityBill: true,
    accountNumber,
    dueDate,
    pleasePayTotal: finalTotal,
    pleasePayRawString: pleasePayResult.rawString,
    pleasePayHasPeriod: pleasePayResult.hasPeriod,
    pleasePayWasAdjusted: pleasePayResult.wasAdjustedByFallback,
    charges,
    chargesList,
    totalFromCharges,
    confidenceScore,
  };
}

// ---------------------------------------------------------------------------
// Formatted Notes & Master Receipt Parser
// ---------------------------------------------------------------------------

/**
 * Formats extracted receipt data into a clean, human-readable note string.
 */
export function generateFormattedNotes(
  merchant: string,
  date: string | null,
  totalAmount: number,
  items: ReceiptItem[],
  currencySymbol: string = '₱'
): string {
  const lines: string[] = [];
  lines.push(`=== RECEIPT: ${merchant.toUpperCase()} ===`);
  if (date) {
    lines.push(`Date: ${date}`);
  }
  lines.push('------------------------------');

  let breakdownSum = 0;
  if (items.length > 0) {
    for (const item of items) {
      lines.push(`• ${item.description}: ${currencySymbol}${item.price.toFixed(2)}`);
      breakdownSum += item.price;
    }
    lines.push('------------------------------');
    lines.push(`Items Total: ${currencySymbol}${breakdownSum.toFixed(2)}`);
  }

  lines.push(`Grand Total: ${currencySymbol}${totalAmount.toFixed(2)}`);
  return lines.join('\n');
}

/**
 * Master parser function taking an ML Kit OCR response and extracting all required receipt fields.
 * Automatically detects Meralco and utility bills to apply the centavo fallback to
 * "Please Pay" total and all individual charge categories.
 */
export function parseReceipt(ocrResult: MLKitRecognitionResult, currencySymbol: string = '₱'): ParsedReceipt {
  const blocks = ocrResult.blocks || [];
  const rawText = ocrResult.text || '';

  // If detected as a Meralco / utility bill, use the specialized utility bill parser
  if (isMeralcoBill(rawText)) {
    return parseMeralcoBill(ocrResult, currencySymbol);
  }

  const merchant = extractMerchant(blocks);
  const extractedDate = extractDate(rawText);
  const date = extractedDate || new Date().toISOString().split('T')[0];
  const totalAmount = extractTotalAmount(blocks, rawText);
  const items = extractLineItems(blocks, rawText);

  // If totalAmount was 0, but items were found, sum of items can serve as calculated total
  const finalTotal = totalAmount > 0 
    ? totalAmount 
    : Number(items.reduce((sum, item) => sum + item.price, 0).toFixed(2));

  const formattedNotes = generateFormattedNotes(merchant, date, finalTotal, items, currencySymbol);

  return {
    merchant,
    date,
    totalAmount: finalTotal,
    items,
    rawText,
    formattedNotes
  };
}
