import { useState, useMemo } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Calendar } from '@phosphor-icons/react'
import { getFYFromDate } from '@/lib/calculations'

export type PeriodType = 'current_fy' | 'current_month' | 'all_time' | 'specific_fy' | 'custom'

export interface PeriodFilterState {
  periodType: PeriodType
  specificFY: string
  fromDate: string
  toDate: string
}

export const defaultPeriodFilterState: PeriodFilterState = {
  periodType: 'current_fy',
  specificFY: '',
  fromDate: '',
  toDate: ''
}

interface PeriodDateFilterProps {
  currentFY: string
  availableFYs?: string[]
  value: PeriodFilterState
  onChange: (newState: PeriodFilterState) => void
  className?: string
}

export function PeriodDateFilter({
  currentFY,
  availableFYs = ['FY2026-27', 'FY2025-26', 'FY2024-25', 'FY2023-24'],
  value,
  onChange,
  className = ''
}: PeriodDateFilterProps) {
  const normCurrentFY = currentFY ? (currentFY.startsWith('FY') ? currentFY : `FY${currentFY}`) : 'FY2026-27'

  const allFYs = useMemo(() => {
    const list = new Set(availableFYs.map(f => f.startsWith('FY') ? f : `FY${f}`))
    list.add(normCurrentFY)
    return Array.from(list).sort().reverse()
  }, [availableFYs, normCurrentFY])

  const handlePeriodSelect = (val: string) => {
    if (val === 'current_fy') {
      onChange({ ...value, periodType: 'current_fy', specificFY: '' })
    } else if (val === 'current_month') {
      onChange({ ...value, periodType: 'current_month', specificFY: '' })
    } else if (val === 'all_time') {
      onChange({ ...value, periodType: 'all_time', specificFY: '' })
    } else if (val === 'custom') {
      onChange({ ...value, periodType: 'custom', specificFY: '' })
    } else if (val.startsWith('FY')) {
      onChange({ ...value, periodType: 'specific_fy', specificFY: val })
    }
  }

  const selectedSelectValue = value.periodType === 'specific_fy'
    ? value.specificFY
    : value.periodType

  const currentMonthLabel = useMemo(() => {
    const now = new Date()
    return now.toLocaleString('en-IN', { month: 'short', year: 'numeric' })
  }, [])

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1.5 bg-background border rounded-md px-2.5 py-1 text-sm shadow-sm">
        <Calendar className="text-muted-foreground w-4 h-4 shrink-0" />
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Period:</span>
        <Select value={selectedSelectValue} onValueChange={handlePeriodSelect}>
          <SelectTrigger className="h-7 border-0 bg-transparent p-0 text-xs font-medium focus:ring-0 min-w-[140px] focus:outline-none">
            <SelectValue placeholder="Select Period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current_fy">Current FY ({normCurrentFY})</SelectItem>
            <SelectItem value="current_month">Current Month ({currentMonthLabel})</SelectItem>
            <SelectItem value="all_time">All Time (Historical)</SelectItem>
            {allFYs.filter(fy => fy !== normCurrentFY).map(fy => (
              <SelectItem key={fy} value={fy}>Previous Year ({fy})</SelectItem>
            ))}
            <SelectItem value="custom">Custom Date Range</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.periodType === 'custom' && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={value.fromDate}
            onChange={(e) => onChange({ ...value, fromDate: e.target.value })}
            className="h-8 text-xs w-[130px]"
            placeholder="From Date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={value.toDate}
            onChange={(e) => onChange({ ...value, toDate: e.target.value })}
            className="h-8 text-xs w-[130px]"
            placeholder="To Date"
          />
        </div>
      )}
    </div>
  )
}

/**
 * Helper function to test if a transaction record matches the active period filter.
 */
export function isRecordInPeriod(
  recordDate?: string,
  recordFY?: string,
  filterState?: PeriodFilterState,
  currentFYSetting?: string
): boolean {
  if (!filterState) return true
  const { periodType, specificFY, fromDate, toDate } = filterState

  if (periodType === 'all_time') return true

  const computedFY = recordDate ? getFYFromDate(recordDate) : ''
  const normRecordFY = recordFY
    ? (recordFY.startsWith('FY') ? recordFY : `FY${recordFY}`)
    : computedFY

  const currentFYNorm = currentFYSetting
    ? (currentFYSetting.startsWith('FY') ? currentFYSetting : `FY${currentFYSetting}`)
    : 'FY2026-27'

  if (periodType === 'current_fy') {
    return normRecordFY === currentFYNorm || computedFY === currentFYNorm
  }

  if (periodType === 'specific_fy') {
    const targetFY = specificFY.startsWith('FY') ? specificFY : `FY${specificFY}`
    return normRecordFY === targetFY || computedFY === targetFY
  }

  if (periodType === 'current_month') {
    if (!recordDate) return false
    const now = new Date()
    const recordD = new Date(recordDate)
    return (
      recordD.getFullYear() === now.getFullYear() &&
      recordD.getMonth() === now.getMonth()
    )
  }

  if (periodType === 'custom') {
    if (!recordDate) return false
    const dStr = recordDate.slice(0, 10)
    if (fromDate && dStr < fromDate) return false
    if (toDate && dStr > toDate) return false
    return true
  }

  return true
}
