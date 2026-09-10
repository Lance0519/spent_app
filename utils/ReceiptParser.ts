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

  // 1. Strip currency symbols (₱, P, Php, PHP, $), spaces, and non-numeric characters
  const sanitized = raw.replace(/[₱\$\s]|PHP|Php|php/gi, '').trim();

  // 2. Extract contiguous numeric pattern (with optional comma grouping and optional decimal)
  const match = sanitized.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
  if (!match) {
    return { amount: 0, rawString: raw, hasPeriod: false, wasAdjustedByFallback: false };
  }

  const extractedNumStr = match[0];

  // 3. Validation Step: Check if the extracted number string contains a period
  const hasPeriod = extractedNumStr.includes('.');

  // 4. Remove comma thousands separators
  const digitsOnlyStr = extractedNumStr.replace(/,/g, '');
  const parsedValue = parseFloat(digitsOnlyStr);

  if (isNaN(parsedValue) || parsedValue <= 0) {
    return { amount: 0, rawString: extractedNumStr, hasPeriod, wasAdjustedByFallback: false };
  }

  if (!hasPeriod) {
    // Hardware limitation fallback:
    // Period is missing; convert string to number and divide by 100 to restore centavo placement.
    const restoredAmount = Number((parsedValue / 100).toFixed(2));
    return {
      amount: restoredAmount,
      rawString: extractedNumStr,
      hasPeriod: false,
      wasAdjustedByFallback: true,
    };
  }

  // Period is present; format to 2 decimal places
  return {
    amount: Number(parsedValue.toFixed(2)),
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

// ---------------------------------------------------------------------------
// Non-item filter regular expressions
// ---------------------------------------------------------------------------

const EXCLUDED_PATTERNS = [
  // Tax lines & percentages
  /\b(?:tax|vat|vatable|vat-exempt|exempt|zero-rated|12%|percentage)\b/i,
  // Barcodes, SKUs, and long number identifiers
  /\b(?:barcode|ean|sku|upc|item#|code#)\b/i,
  /\b\d{10,}\b/,
  // Addresses, branches, and locations
  /\b(?:street|st\.|ave\.|avenue|blvd\.|boulevard|rd\.|road|brgy\.|barangay|city|bldg\.|building|mall|flr|floor|unit|drive|dr\.|poblacion)\b/i,
  // Contact & Business Registration
  /\b(?:tin|tel|telephone|phone|fax|mobile|cel|contact|permit|min|sn|serial|reg)\b/i,
  // POS & transaction metadata
  /\b(?:cashier|terminal|pos|station|receipt\s*(?:no|#)?|invoice\s*(?:no|#)?|or\s*(?:no|#)?|txn\s*(?:no|#)?|trans\s*(?:no|#)?|order\s*(?:no|#)?|table|pax|guest|server|clerk|shift)\b/i,
  // Payment methods and tendering
  /\b(?:cash|change|tender|tendered|change\s*due|visa|mastercard|amex|debit|credit|card|gcash|maya|paymaya|wallet|points|discount|round|rounding)\b/i,
  // Summary header lines
  /\b(?:subtotal|sub-total|total|amount\s*due|grand\s*total|balance\s*due|please\s*pay|net\s*amount)\b/i,
  // Greeting, courtesy, and footer notes
  /\b(?:thank\s*you|please\s*come\s*again|visit\s*again|customer\s*copy|store\s*copy|merchant\s*copy|keep\s*this\s*copy|powered\s*by|system\s*generated)\b/i,
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
  const res = validateAndParseCentavoAmount(text);
  return res.amount > 0 ? res.amount : null;
}

/**
 * Extracts the merchant name by taking the topmost recognized line of text.
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

  // Pick first substantive line that doesn't look like an address, barcode, or telephone number
  for (const line of allLines) {
    const text = line.text.trim();
    if (text.length >= 3 && !isNonItemLine(text) && /[a-zA-Z]/.test(text)) {
      return text
        .replace(/^[*\-=_#~]+\s*/, '')
        .replace(/\s*[*\-=_#~]+$/, '')
        .trim();
    }
  }

  return defaultFallback;
}

/**
 * Parses date formats: MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, Month DD YYYY
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

  // Regex 4: Named months (e.g. Oct 25, 2026 or 25 Oct 2026 or October 25 2026)
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
 * Searches for keywords like 'Total', 'Amount Due', or 'Please Pay' and extracts
 * the numeric value, applying the centavo decimal fallback if a period was missed by the scanner.
 */
export function extractTotalAmount(blocks: MLKitTextBlock[], rawText: string): number {
  const totalKeywords = /\b(?:grand\s*total|total\s*amount(?:\s*due)?|amount\s*due|total|net\s*amount|please\s*pay(?:\s*on\s*or\s*before)?|balance\s*due)\b/i;
  const candidates: number[] = [];

  for (const block of blocks) {
    for (const line of block.lines) {
      if (totalKeywords.test(line.text)) {
        // Extract candidate number strings on this line
        const numMatches = line.text.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g);
        if (numMatches) {
          for (const m of numMatches) {
            const val = validateAndParseCentavoAmount(m).amount;
            if (val > 0 && val < 1000000) {
              candidates.push(val);
            }
          }
        }
      }
    }
  }

  // If keyword matches found in blocks, return highest
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  // Fallback: Scan lines in raw text
  const lines = rawText.split('\n');
  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const numMatches = line.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g);
      if (numMatches) {
        for (const m of numMatches) {
          const val = validateAndParseCentavoAmount(m).amount;
          if (val > 0 && val < 1000000) {
            candidates.push(val);
          }
        }
      }
    }
  }

  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  return 0;
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
 * Builds a line-item parser using bounding box vertical alignment (Y-axis coordinates)
 * to match an item description with its corresponding price on the same line.
 */
export function extractLineItems(blocks: MLKitTextBlock[]): ReceiptItem[] {
  const items: ReceiptItem[] = [];
  const descCandidates: DescItemBox[] = [];
  const priceCandidates: PriceItemBox[] = [];

  // Flatten lines
  const allLines: MLKitTextLine[] = [];
  for (const b of blocks) {
    if (b.lines) allLines.push(...b.lines);
  }

  // 1. First Pass: Check lines that contain BOTH description and price
  for (const line of allLines) {
    const text = line.text.trim();
    if (isNonItemLine(text)) continue;

    // Pattern: Description followed by a price at the end
    const match = text.match(/^(.*?)\s+(?:[₱\$\s]|PHP|Php)?((?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?))$/i);
    if (match) {
      const desc = match[1].trim().replace(/^[\d\s*xX.\-]+/, '').trim();
      const valRes = validateAndParseCentavoAmount(match[2]);
      if (desc.length >= 2 && !isNonItemLine(desc) && valRes.amount > 0) {
        items.push({
          id: `item_${items.length + 1}_${Date.now()}`,
          description: desc,
          price: valRes.amount,
          rawLine: text
        });
        continue;
      }
    }

    // If line is separate, classify into description or price candidate
    if (line.frame) {
      const centerY = line.frame.top + line.frame.height / 2;
      const purePriceMatch = text.replace(/^[₱\$\s]|PHP|Php/gi, '').trim().match(/^(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)$/);
      if (purePriceMatch) {
        const valRes = validateAndParseCentavoAmount(purePriceMatch[0]);
        if (valRes.amount > 0 && valRes.amount < 500000) {
          priceCandidates.push({
            text,
            price: valRes.amount,
            frame: line.frame,
            centerY
          });
        }
      } else if (/[a-zA-Z]/.test(text) && !isNonItemLine(text)) {
        descCandidates.push({
          text,
          frame: line.frame,
          centerY
        });
      }
    }
  }

  // 2. Second Pass: Bounding box vertical alignment for multi-column layouts
  const usedPriceIndices = new Set<number>();

  for (const desc of descCandidates) {
    let bestPriceIdx = -1;
    let minVerticalDist = 99999;

    for (let i = 0; i < priceCandidates.length; i++) {
      if (usedPriceIndices.has(i)) continue;
      const p = priceCandidates[i];

      // Must be horizontally positioned to the right of the description
      if (p.frame.left + 5 < desc.frame.left) continue;

      // Vertical distance
      const vDist = Math.abs(desc.centerY - p.centerY);
      const tolerance = Math.max(16, desc.frame.height * 0.85);

      if (vDist <= tolerance && vDist < minVerticalDist) {
        minVerticalDist = vDist;
        bestPriceIdx = i;
      }
    }

    if (bestPriceIdx !== -1) {
      const matchedPrice = priceCandidates[bestPriceIdx];
      usedPriceIndices.add(bestPriceIdx);

      const cleanDesc = desc.text.replace(/^[\d\s*xX.\-]+/, '').trim();
      if (cleanDesc.length >= 2 && !isNonItemLine(cleanDesc)) {
        items.push({
          id: `item_${items.length + 1}_${Date.now()}`,
          description: cleanDesc,
          price: matchedPrice.price,
          rawLine: `${cleanDesc} ${matchedPrice.price}`
        });
      }
    }
  }

  return items;
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
  const hasPleasePay = /please\s*pay/i.test(lower);
  const matchedCategories = MERALCO_CHARGE_CATEGORIES.filter(cat =>
    cat.patterns.some(p => p.test(lower))
  );
  return hasPleasePay && matchedCategories.length >= 2;
}

/**
 * Parses a Meralco electricity utility bill from ML Kit OCR results or raw text.
 * Applies the period validation step and /100 division fallback to:
 * 1. The "Please Pay" total
 * 2. All individual Meralco charge categories
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

  // 3. Extract "Please Pay" Total (applying centavo validation fallback)
  const pleasePayRegex = /\b(?:please\s*pay(?:\s*on\s*or\s*before)?|total\s*amount\s*due|total\s*current\s*amount|amount\s*due)\b[:\s]*(?:[₱\$\s]|PHP|Php)?([0-9.,]+)?/i;
  let pleasePayResult: ValidatedAmountResult = { amount: 0, rawString: '', hasPeriod: false, wasAdjustedByFallback: false };

  // Pass A: Check lines with regex
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(pleasePayRegex);
    if (match) {
      if (match[1]) {
        pleasePayResult = validateAndParseCentavoAmount(match[1]);
        break;
      } else if (i + 1 < lines.length) {
        const nextLineMatch = lines[i + 1].match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/);
        if (nextLineMatch) {
          pleasePayResult = validateAndParseCentavoAmount(nextLineMatch[0]);
          break;
        }
      }
    }
  }

  // Pass B: Fallback search if strict pattern didn't yield an amount
  if (pleasePayResult.amount === 0) {
    for (const line of lines) {
      if (/please\s*pay/i.test(line)) {
        const numMatch = line.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g);
        if (numMatch && numMatch.length > 0) {
          pleasePayResult = validateAndParseCentavoAmount(numMatch[numMatch.length - 1]);
          break;
        }
      }
    }
  }

  // 4. Extract All Individual Meralco Charge Categories (applying centavo validation fallback)
  const charges: Record<string, MeralcoChargeItem> = {};
  const chargesList: MeralcoChargeItem[] = [];

  for (const catDef of MERALCO_CHARGE_CATEGORIES) {
    let matchedItem: MeralcoChargeItem | null = null;

    // Check lines in text
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isMatch = catDef.patterns.some(p => p.test(line));
      if (!isMatch) continue;

      const numMatches = line.match(/(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g);
      let rawNum: string | null = null;

      if (numMatches && numMatches.length > 0) {
        // Take the rightmost numeric token on this category line
        rawNum = numMatches[numMatches.length - 1];
      } else if (i + 1 < lines.length) {
        // Amount might be on the line directly below the category label
        const nextLineMatch = lines[i + 1].match(/^(?:[₱\$\s]|PHP|Php)*([\d,]+(?:\.\d+)?)$/);
        if (nextLineMatch) {
          rawNum = nextLineMatch[1];
        }
      }

      if (rawNum) {
        const valRes = validateAndParseCentavoAmount(rawNum);
        matchedItem = {
          key: catDef.key,
          label: catDef.label,
          amount: valRes.amount,
          rawString: valRes.rawString,
          hasPeriod: valRes.hasPeriod,
          wasAdjustedByFallback: valRes.wasAdjustedByFallback,
        };
        break;
      }
    }

    // Pass B: MLKit bounding box vertical alignment if blocks are present and line search didn't find price
    if (!matchedItem && blocks.length > 0) {
      // Flatten all lines from blocks
      const allBlockLines: MLKitTextLine[] = [];
      for (const b of blocks) {
        if (b.lines) allBlockLines.push(...b.lines);
      }

      for (const bLine of allBlockLines) {
        if (!catDef.patterns.some(p => p.test(bLine.text))) continue;
        if (!bLine.frame) continue;

        const centerY = bLine.frame.top + bLine.frame.height / 2;

        // Find candidate price box to the right on the same horizontal band
        for (const candidate of allBlockLines) {
          if (!candidate.frame) continue;
          if (candidate.frame.left + 5 < bLine.frame.left) continue;
          const vDist = Math.abs((candidate.frame.top + candidate.frame.height / 2) - centerY);
          if (vDist <= Math.max(16, bLine.frame.height * 0.9)) {
            const valRes = validateAndParseCentavoAmount(candidate.text);
            if (valRes.amount > 0) {
              matchedItem = {
                key: catDef.key,
                label: catDef.label,
                amount: valRes.amount,
                rawString: valRes.rawString,
                hasPeriod: valRes.hasPeriod,
                wasAdjustedByFallback: valRes.wasAdjustedByFallback,
              };
              break;
            }
          }
        }
        if (matchedItem) break;
      }
    }

    if (matchedItem) {
      charges[catDef.key] = matchedItem;
      chargesList.push(matchedItem);
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
  const receiptItems: ReceiptItem[] = chargesList.map((item, idx) => ({
    id: `meralco_${item.key}_${Date.now()}_${idx}`,
    description: item.label,
    price: item.amount,
    rawLine: `${item.label}: ${currencySymbol}${item.amount.toFixed(2)}${item.wasAdjustedByFallback ? ' (centavos restored)' : ''}`
  }));

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
    notesLines.push(`• ${c.label}: ${currencySymbol}${c.amount.toFixed(2)}${fallbackFlag}`);
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
  const date = extractDate(rawText);
  const totalAmount = extractTotalAmount(blocks, rawText);
  const items = extractLineItems(blocks);

  // If totalAmount was 0, but items were found, sum of items can serve as calculated total
  const finalTotal = totalAmount > 0 
    ? totalAmount 
    : items.reduce((sum, item) => sum + item.price, 0);

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
