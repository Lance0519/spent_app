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

// Non-item filter regular expressions
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
 * Extracts a price value from text (e.g. "? 1,250.50" -> 1250.50)
 */
export function extractPrice(text: string): number | null {
  const cleaned = text.replace(/[?$P]/g, '').trim();
  const match = cleaned.match(/(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(/,/g, ''));
  return isNaN(num) || num <= 0 ? null : num;
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
      // Clean up common receipt header prefixes
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
 * Searches for keywords like 'Total' or 'Amount Due' and extracts the highest numeric value for final cost.
 */
export function extractTotalAmount(blocks: MLKitTextBlock[], rawText: string): number {
  const totalKeywords = /\b(?:grand\s*total|total\s*amount(?:\s*due)?|amount\s*due|total|net\s*amount|please\s*pay|balance\s*due)\b/i;
  const candidates: number[] = [];

  for (const block of blocks) {
    for (const line of block.lines) {
      if (totalKeywords.test(line.text)) {
        // Extract all price candidates in this line
        const numMatches = line.text.match(/(?:[?$P]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))/g);
        if (numMatches) {
          for (const m of numMatches) {
            const clean = m.replace(/[?$P,\s]/g, '');
            const parsed = parseFloat(clean);
            if (!isNaN(parsed) && parsed > 0 && parsed < 1000000) {
              candidates.push(parsed);
            }
          }
        }
      }
    }
  }

  // If keyword matches found, return the highest numeric value among them
  if (candidates.length > 0) {
    return Math.max(...candidates);
  }

  // Fallback: Scan lines with 'Total' in the raw text
  const lines = rawText.split('\n');
  for (const line of lines) {
    if (totalKeywords.test(line)) {
      const numMatches = line.match(/(?:[?$P]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))/g);
      if (numMatches) {
        for (const m of numMatches) {
          const clean = m.replace(/[?$P,\s]/g, '');
          const parsed = parseFloat(clean);
          if (!isNaN(parsed) && parsed > 0 && parsed < 1000000) {
            candidates.push(parsed);
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

    // Pattern: Description followed by a price at the end (e.g. "Iced Caramel Macchiato 210.00")
    const match = text.match(/^(.*?)\s+(?:[?$P]\s*)?(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2}))$/i);
    if (match) {
      const desc = match[1].trim().replace(/^[\d\s*xX.\-]+/, '').trim();
      const price = parseFloat(match[2].replace(/,/g, ''));
      if (desc.length >= 2 && !isNonItemLine(desc) && !isNaN(price) && price > 0) {
        items.push({
          id: `item_${items.length + 1}_${Date.now()}`,
          description: desc,
          price,
          rawLine: text
        });
        continue;
      }
    }

    // If line is separate, classify into description or price candidate
    if (line.frame) {
      const centerY = line.frame.top + line.frame.height / 2;
      const purePrice = text.replace(/^[?$P\s]+/, '').replace(/,/g, '');
      if (/^\d+(?:\.\d{1,2})?$/.test(purePrice)) {
        const val = parseFloat(purePrice);
        if (!isNaN(val) && val > 0 && val < 500000) {
          priceCandidates.push({
            text,
            price: val,
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
      // Adaptive tolerance based on line height
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

/**
 * Formats extracted receipt data into a clean, human-readable note string.
 */
export function generateFormattedNotes(
  merchant: string,
  date: string | null,
  totalAmount: number,
  items: ReceiptItem[],
  currencySymbol: string = '?'
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
      lines.push(`� ${item.description}: ${currencySymbol}${item.price.toFixed(2)}`);
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
 */
export function parseReceipt(ocrResult: MLKitRecognitionResult, currencySymbol: string = '?'): ParsedReceipt {
  const blocks = ocrResult.blocks || [];
  const rawText = ocrResult.text || '';

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
