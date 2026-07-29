import { Item } from './types'

export const DEFAULT_CATEGORIES: string[] = [
  'PIPE',
  'TMT BARS',
  'STEEL & STRUCTURE',
  'SHEETS & PLATES',
  'BEAMS & CHANNELS',
  'ANGLES & FLATS',
  'FASTENERS & HARDWARE',
  'CEMENT & CONCRETE',
  'GENERAL TRADING'
]

export const DEFAULT_UNITS: { value: string; label: string }[] = [
  { value: 'MT', label: 'Metric Tonne (MT)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'BOX', label: 'Box (BOX)' },
  { value: 'PKT', label: 'Packet (PKT)' },
  { value: 'BTL', label: 'Bottle (BTL)' },
  { value: 'JAR', label: 'Jar (JAR)' },
  { value: 'TIN', label: 'Tin (TIN)' },
  { value: 'MTR', label: 'Meter (MTR)' },
  { value: 'FT', label: 'Feet (FT)' },
  { value: 'SET', label: 'Set (SET)' },
  { value: 'QTL', label: 'Quintal (QTL)' },
  { value: 'BUNDLE', label: 'Bundle (BUNDLE)' },
  { value: 'NOS', label: 'Numbers (NOS)' }
]

export function getCustomCategories(): string[] {
  let categories = [...DEFAULT_CATEGORIES]
  try {
    const saved = localStorage.getItem('custom_item_categories')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const customCats = parsed.map(c => String(c).trim()).filter(Boolean)
        categories = Array.from(new Set([...categories, ...customCats]))
      }
    }
  } catch (e) {
    console.error('Failed to load categories', e)
  }
  return categories
}

export function saveCustomCategory(category: string): string[] {
  const clean = category.trim()
  if (!clean) return getCustomCategories()
  const current = getCustomCategories()
  if (!current.includes(clean)) {
    const updated = [...current, clean]
    localStorage.setItem('custom_item_categories', JSON.stringify(updated))
    window.dispatchEvent(new Event('custom-categories-updated'))
    return updated
  }
  return current
}

export function updateCustomCategory(oldName: string, newName: string): string[] {
  const clean = newName.trim()
  if (!clean || clean === oldName) return getCustomCategories()
  const current = getCustomCategories()
  const updated = current.map(cat => cat === oldName ? clean : cat)
  localStorage.setItem('custom_item_categories', JSON.stringify(updated))
  window.dispatchEvent(new Event('custom-categories-updated'))
  return updated
}

export function deleteCustomCategory(name: string): string[] {
  const current = getCustomCategories()
  const updated = current.filter(cat => cat !== name)
  localStorage.setItem('custom_item_categories', JSON.stringify(updated))
  window.dispatchEvent(new Event('custom-categories-updated'))
  return updated
}

export function getCustomUnits(): { value: string; label: string }[] {
  let units = [...DEFAULT_UNITS]
  try {
    const saved = localStorage.getItem('custom_item_units')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const customUnitsList: { value: string; label: string }[] = parsed
        for (const u of customUnitsList) {
          if (u && u.value && !units.some(existing => existing.value === u.value)) {
            units.push(u)
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to load units', e)
  }
  return units
}

export function saveCustomUnit(unitCode: string, unitLabel?: string): { value: string; label: string }[] {
  const code = unitCode.trim().toUpperCase()
  const label = unitLabel?.trim() || code
  if (!code) return getCustomUnits()

  const current = getCustomUnits()
  if (!current.some(u => u.value === code)) {
    const newUnit = { value: code, label: `${label} (${code})` }
    const updated = [...current, newUnit]
    localStorage.setItem('custom_item_units', JSON.stringify(updated))
    window.dispatchEvent(new Event('custom-units-updated'))
    return updated
  }
  return current
}

export function updateCustomUnit(oldCode: string, newCode: string, newLabel?: string): { value: string; label: string }[] {
  const code = newCode.trim().toUpperCase()
  const label = newLabel?.trim() || code
  if (!code) return getCustomUnits()

  const current = getCustomUnits()
  const updated = current.map(u => u.value === oldCode ? { value: code, label: `${label} (${code})` } : u)
  localStorage.setItem('custom_item_units', JSON.stringify(updated))
  window.dispatchEvent(new Event('custom-units-updated'))
  return updated
}

export function deleteCustomUnit(code: string): { value: string; label: string }[] {
  const current = getCustomUnits()
  const updated = current.filter(u => u.value !== code)
  localStorage.setItem('custom_item_units', JSON.stringify(updated))
  window.dispatchEvent(new Event('custom-units-updated'))
  return updated
}

export function getAvailableUnits(items?: Item[]): { value: string; label: string }[] {
  const customUnits = getCustomUnits()
  const unitMap = new Map<string, string>()

  customUnits.forEach(u => {
    if (u && u.value) {
      const val = u.value.trim().toUpperCase()
      unitMap.set(val, val)
    }
  })

  if (items && Array.isArray(items)) {
    items.forEach(i => {
      if (i.unit && i.unit.trim()) {
        const u = i.unit.trim().toUpperCase()
        unitMap.set(u, u)
      }
      if (i.alternativeUnit && i.alternativeUnit !== 'NONE' && i.alternativeUnit.trim()) {
        const u = i.alternativeUnit.trim().toUpperCase()
        unitMap.set(u, u)
      }
    })
  }

  if (unitMap.size === 0) {
    unitMap.set('MT', 'MT')
  }

  return Array.from(unitMap.keys()).map(code => ({
    value: code,
    label: code
  }))
}
