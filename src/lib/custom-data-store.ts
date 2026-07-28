export const DEFAULT_CATEGORIES: string[] = []

export const DEFAULT_UNITS: { value: string; label: string }[] = []

export function getCustomCategories(): string[] {
  try {
    const saved = localStorage.getItem('custom_item_categories')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return Array.from(new Set(parsed.map(c => String(c).trim()).filter(Boolean)))
      }
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
  try {
    const saved = localStorage.getItem('custom_item_units')
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed
      }
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
