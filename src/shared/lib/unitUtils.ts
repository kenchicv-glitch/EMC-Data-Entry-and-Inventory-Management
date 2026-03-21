/**
 * Canonical unit values used across the application.
 * All product units should be one of these lowercase values.
 */
export const CANONICAL_UNITS = [
  'pc', 'box', 'elf', 'set', 'roll', 'meter', 'sheet', 'length', 'ft', 'bag', 'can', 'kg'
] as const;

export type CanonicalUnit = typeof CANONICAL_UNITS[number];

/**
 * Infers the appropriate unit for a product based on its name.
 *
 * Examples:
 * - "GRAVEL - 1 ELF"            -> "elf"
 * - "CEMENT - 40KG BAG"         -> "bag"
 * - "WIRE - 100M ROLL"          -> "roll"
 * - "INSULATION - PER ROLL 50M" -> "roll"
 * - "ELECTRICAL WIRE - PER METER"-> "meter"
 * - "PLYWOOD > 1/2 3X6"         -> "sheet"
 * - "STEEL > ANGLE BAR > 1X1"   -> "length"
 * - "NAILS > PER BOX (25KLS)"   -> "box"
 * - "RIB TYPE > (PER FT)"       -> "ft"
 */
export function inferUnitFromName(name: string): CanonicalUnit {
  const upper = name.toUpperCase();

  // ── ELF (cubic volume) ──────────────────────────────
  if (/\bELF\b/.test(upper)) return 'elf';

  // ── PER ROLL / ROLL ────────────────────────────────
  if (/\bPER ROLL\b/.test(upper) || /\bROLL\b/.test(upper) && !upper.includes('RIDGE ROLL')) return 'roll';

  // ── PER METER / PER MTR ────────────────────────────
  if (/\bPER MET(?:ER|RE)\b/i.test(upper) || /\bPER MTR\b/.test(upper)) return 'meter';

  // ── PER FT / PER FOOT ─────────────────────────────
  if (/\bPER FT\b/.test(upper) || /\bPER FOOT\b/.test(upper)) return 'ft';

  // ── PER BOX / BOX ──────────────────────────────────
  if (/\bPER BOX\b/.test(upper)) return 'box';

  // ── BAG ────────────────────────────────────────────
  if (/\bBAG\b/.test(upper)) return 'bag';

  // ── SET ────────────────────────────────────────────
  if (/\bSET\b/.test(upper) && !upper.includes('OFFSET')) return 'set';

  // ── KG ─────────────────────────────────────────────
  if (/\bKG\b/.test(upper) || /\bKILO\b/.test(upper)) return 'kg';

  // ── CAN / TIN ──────────────────────────────────────
  if (/ CAN$/.test(upper) || / TIN$/.test(upper)) return 'can';

  // ── SHEET (plywood, boards) ────────────────────────
  // Plywood, marine plywood, hardiboard, fiber cement boards
  if (/\bPLYWOOD\b/.test(upper) || /\bHARDI\b/.test(upper) || /\bFIBER CEMENT\b/.test(upper)) return 'sheet';
  if (upper.startsWith('PLYWOOD')) return 'sheet';

  // ── LENGTH (steel bars, pipes, tubes, angles) ──────
  // Steel products: angle bars, flat bars, deformed bars, pipes, tubing
  if (upper.startsWith('STEEL') || upper.startsWith('PIPES AND FITTINGS')) {
    // Fittings/connectors are PC, but pipes/tubes/bars are length
    if (/\bBAR\b|\bTUBE\b|\bTUBING\b|\bPIPE\b|\bC-PURLINS?\b|\bBI\b/.test(upper)) {
      // Except small fittings
      if (!/\bELBOW\b|\bTEE\b|\bCOUPLING\b|\bADAPT\b|\bVALVE\b|\bFAUCET\b|\bCLAMP\b|\bNIPPLE\b|\bBUSHING\b/.test(upper)) {
        return 'length';
      }
    }
  }

  // ── Default: pc ────────────────────────────────────
  return 'pc';
}

/**
 * Normalizes a unit string to its canonical lowercase form.
 * Handles the various formats found in the database.
 */
export function normalizeUnit(unit: string | null | undefined): CanonicalUnit {
  if (!unit) return 'pc';
  const u = unit.trim().toLowerCase();

  // Direct matches
  if (CANONICAL_UNITS.includes(u as CanonicalUnit)) return u as CanonicalUnit;

  // Mapping aliases
  if (u === 'per mtr' || u === 'mtr' || u === 'per meter') return 'meter';
  if (u === 'per ft' || u === 'per foot') return 'ft';
  if (u === 'per roll') return 'roll';
  if (u === 'per box') return 'box';
  if (u === 'pcs' || u === 'piece' || u === 'pieces') return 'pc';

  return 'pc';
}
