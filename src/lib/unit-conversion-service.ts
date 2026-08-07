import { Item } from './types'

/**
 * CENTRALIZED UNIT CONVERSION SERVICE
 * ====================================
 * Single source of truth for all unit conversion logic across the ERP.
 * Enforces Strict Base Unit Normalization Architecture.
 * 
 * Rules:
 * 1. Primary (Base) Unit is the single source of truth.
 * 2. Database stores quantities and rates in the Primary Unit only.
 * 3. Base Quantity = Entered Quantity * Conversion Factor (for alternate units).
 * 4. Base Rate = Entered Rate / Conversion Factor (for alternate units).
 * 5. Base Amount = Base Quantity * Base Rate.
 */

export interface NormalizedLineItem {
  enteredQuantity: number
  enteredUnit: string
  enteredRate: number
  baseQuantity: number
  baseRate: number
  baseAmount: number
  primaryUnit: string
  conversionFactor: number
}

/**
 * Resolves conversion factor for an item and a target unit relative to item.unit (Primary Unit).
 */
export function getItemConversionFactor(item?: Item | null, targetUnit?: string): number {
  if (!item) return 1
  const primaryUnit = (item.unit || 'KG').toUpperCase()
  const currentTarget = (targetUnit || primaryUnit).toUpperCase()

  if (primaryUnit === currentTarget) return 1

  const altUnit = (item.alternativeUnit || '').toUpperCase()

  // Standard MT <-> KG handling with fallback
  if ((primaryUnit === 'KG' && (currentTarget === 'MT' || altUnit === 'MT')) ||
      (primaryUnit === 'MT' && (currentTarget === 'KG' || altUnit === 'KG'))) {
    if (item.conversionFactor && item.conversionFactor > 1) {
      return item.conversionFactor
    }
    return 1000
  }

  if (item.conversionFactor && item.conversionFactor > 0) {
    return item.conversionFactor
  }

  return 1
}

/**
 * Normalizes entered quantity into Primary (Base) Unit Quantity.
 */
export function toBaseQuantity(item?: Item | null, quantity: number = 0, unit?: string): number {
  if (!quantity || quantity <= 0) return 0
  if (!item) return quantity

  const primaryUnit = (item.unit || 'KG').toUpperCase()
  const enteredUnit = (unit || primaryUnit).toUpperCase()

  if (primaryUnit === enteredUnit) return quantity

  const factor = getItemConversionFactor(item, enteredUnit)
  return quantity * factor
}

/**
 * Normalizes entered rate into Primary (Base) Unit Rate.
 * Formula: Base Rate = Entered Rate / Conversion Factor
 */
export function toBaseRate(item?: Item | null, rate: number = 0, unit?: string): number {
  if (!rate || rate <= 0) return 0
  if (!item) return rate

  const primaryUnit = (item.unit || 'KG').toUpperCase()
  const enteredUnit = (unit || primaryUnit).toUpperCase()

  if (primaryUnit === enteredUnit) return rate

  const factor = getItemConversionFactor(item, enteredUnit)
  return factor > 0 ? rate / factor : rate
}

/**
 * Computes Base Amount from Base Quantity and Base Rate.
 */
export function toBaseAmount(baseQuantity: number, baseRate: number): number {
  return (baseQuantity || 0) * (baseRate || 0)
}

/**
 * Converts Base Quantity back to an Alternate/Display Unit for UI presentation.
 */
export function fromBaseQuantity(item?: Item | null, baseQuantity: number = 0, targetUnit?: string): number {
  if (!baseQuantity || baseQuantity <= 0) return 0
  if (!item) return baseQuantity

  const primaryUnit = (item.unit || 'KG').toUpperCase()
  const displayUnit = (targetUnit || primaryUnit).toUpperCase()

  if (primaryUnit === displayUnit) return baseQuantity

  const factor = getItemConversionFactor(item, displayUnit)
  return factor > 0 ? baseQuantity / factor : baseQuantity
}

/**
 * Converts Base Rate back to an Alternate/Display Unit Rate for UI presentation.
 */
export function fromBaseRate(item?: Item | null, baseRate: number = 0, targetUnit?: string): number {
  if (!baseRate || baseRate <= 0) return 0
  if (!item) return baseRate

  const primaryUnit = (item.unit || 'KG').toUpperCase()
  const displayUnit = (targetUnit || primaryUnit).toUpperCase()

  if (primaryUnit === displayUnit) return baseRate

  const factor = getItemConversionFactor(item, displayUnit)
  return baseRate * factor
}

/**
 * Fully normalizes an invoice line item input into Base Quantity, Base Rate, and Base Amount.
 */
export function normalizeLineItem(
  itemDef: Item | undefined | null,
  enteredQuantity: number,
  enteredUnit: string,
  enteredRate: number
): NormalizedLineItem {
  const primaryUnit = itemDef?.unit || 'KG'
  const baseQuantity = toBaseQuantity(itemDef, enteredQuantity, enteredUnit)
  const baseRate = toBaseRate(itemDef, enteredRate, enteredUnit)
  const baseAmount = toBaseAmount(baseQuantity, baseRate)
  const conversionFactor = getItemConversionFactor(itemDef, enteredUnit)

  return {
    enteredQuantity,
    enteredUnit,
    enteredRate,
    baseQuantity,
    baseRate,
    baseAmount,
    primaryUnit,
    conversionFactor
  }
}

/**
 * Calculates total quantity of a Purchase Invoice converted into the target unit (e.g. 'MT' or 'KG').
 * Uses Base Quantity normalization as single source of truth so purchases in KG, MT, BAG, BOX earn correct scheme discounts.
 */
export function getInvoiceQtyForUnit(
  inv: { items?: any[]; quantityMT?: number },
  targetUnit: string = 'MT',
  itemMap?: Map<string, Item>
): number {
  const target = (targetUnit || 'MT').toUpperCase()

  if (inv.items && Array.isArray(inv.items) && inv.items.length > 0) {
    let totalQty = 0
    inv.items.forEach(invItem => {
      const itemDef = itemMap?.get(invItem.itemId)
      const primaryUnit = (itemDef?.unit || 'KG').toUpperCase()
      const enteredUnit = (invItem.entryUnit || primaryUnit).toUpperCase()
      const rawQty = (invItem.entryQuantity !== undefined && invItem.entryQuantity !== null && invItem.entryQuantity > 0)
        ? invItem.entryQuantity
        : (invItem.quantityMT || 0)

      const baseQty = invItem.baseQuantity || toBaseQuantity(itemDef, rawQty, enteredUnit)

      if (target === 'MT') {
        const factor = primaryUnit === 'KG' ? 1000 : (itemDef?.conversionFactor || 1)
        totalQty += factor > 0 ? baseQty / factor : baseQty
      } else if (target === 'KG') {
        const factor = primaryUnit === 'MT' ? 1000 : 1
        totalQty += baseQty * factor
      } else if (target === primaryUnit) {
        totalQty += baseQty
      } else if (itemDef) {
        totalQty += fromBaseQuantity(itemDef, baseQty, target)
      } else {
        totalQty += rawQty
      }
    })
    return totalQty
  }

  // Fallback if no items array
  const rawMT = inv.quantityMT || 0
  if (target === 'KG') return rawMT * 1000
  return rawMT
}
