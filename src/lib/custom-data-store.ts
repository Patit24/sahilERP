export const DEFAULT_CATEGORIES = [
  'TMT Bars',
  'Steel Plates',
  'Coils',
  'Pipes & Tubes',
  'Angles & Channels',
  'Structural Steel',
  'Sponge Iron',
  'General'
]

export const DEFAULT_UNITS = [
  { value: 'MT', label: 'Metric Ton (MT)' },
  { value: 'KG', label: 'Kilogram (KG)' },
  { value: 'PCS', label: 'Pieces (PCS)' },
  { value: 'TON', label: 'Ton (TON)' },
  { value: 'BAG', label: 'Bag (BAG)' },
  { value: 'BOX', label: 'Box (BOX)' },
  { value: 'BUNDLE', label: 'Bundle (BUNDLE)' },
  { value: 'LTR', label: 'Litre (LTR)' }
]

export function getCustomCategories(): string[] {
  try {
    const saved = localStorage.getItem('custom_item_categories')
    if (saved) {
      const parsed = JSON.parse(saved)
      return Array.from(new Set([...DEFAULT_CATEGORIES, ...parsed]))
    }
  } catch (e) {
    console.error('Failed to load categories', e)
  }
  return DEFAULT_CATEGORIES
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

export function getCustomUnits(): { value: string; label: string }[] {
  try {
    const saved = localStorage.getItem('custom_item_units')
    if (saved) {
      const parsed = JSON.parse(saved)
      const combined = [...DEFAULT_UNITS]
      parsed.forEach((u: { value: string; label: string }) => {
        if (!combined.some(item => item.value === u.value)) {
          combined.push(u)
        }
      })
      return combined
    }
  } catch (e) {
    console.error('Failed to load units', e)
  }
  return DEFAULT_UNITS
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
