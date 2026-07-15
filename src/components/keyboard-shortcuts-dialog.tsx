import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { useEffect, useMemo, useState } from 'react'
import { keyBindings } from '@/hooks/use-keyboard-shortcuts'
import {
  ChartBar,
  Database,
  Keyboard,
  Lightning,
  NavigationArrow,
  SquaresFour
} from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface KeyboardShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const categories = useMemo(() => Array.from(new Set(keyBindings.map(b => b.category))), [])
  const [activeCategory, setActiveCategory] = useState(categories[0] || 'UI')
  const categoryMeta = {
    UI: { icon: SquaresFour, tone: 'text-blue-600', summary: 'Interface controls' },
    Actions: { icon: Lightning, tone: 'text-amber-600', summary: 'System actions' },
    Navigation: { icon: NavigationArrow, tone: 'text-emerald-600', summary: 'Move between pages' },
    Reports: { icon: ChartBar, tone: 'text-indigo-600', summary: 'Open reports faster' },
    Masters: { icon: Database, tone: 'text-cyan-700', summary: 'Jump to master data' },
  } as const

  const formatKey = (key: string) => {
    const keyMap: Record<string, string> = {
      ',': 'Comma',
      '.': 'Period',
      '/': 'Slash',
      '\\': 'Backslash',
      '[': 'Left Bracket',
      ']': 'Right Bracket',
      ';': 'Semicolon',
      "'": 'Quote',
      '`': 'Backtick',
      '-': 'Minus',
      '=': 'Equals',
    }
    return keyMap[key] || key.toUpperCase()
  }

  const getKeyLabel = (binding: typeof keyBindings[0]) => {
    const parts: string[] = []
    if (binding.ctrlKey) parts.push('Ctrl')
    if (binding.shiftKey) parts.push('Shift')
    if (binding.altKey) parts.push('Alt')
    parts.push(formatKey(binding.key))
    return parts
  }

  useEffect(() => {
    if (open) setActiveCategory(categories[0] || 'UI')
  }, [categories, open])

  const activeBindings = keyBindings.filter((binding) => binding.category === activeCategory)
  const activeMeta = categoryMeta[activeCategory as keyof typeof categoryMeta]
  const ActiveIcon = activeMeta?.icon || Keyboard

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="shortcut-dialog max-w-5xl max-h-[88dvh] overflow-hidden p-0 gap-0 flex flex-col">
        <DialogHeader className="shortcut-dialog-hero">
          <div className="shortcut-dialog-icon">
            <Keyboard className="h-6 w-6" weight="duotone" />
          </div>
          <div className="min-w-0">
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="mt-2 max-w-2xl text-sm leading-6">
              Navigate, create, and open reports without leaving the keyboard.
            </DialogDescription>
          </div>
          <div className="shortcut-dialog-count">
            <span className="text-2xl font-bold">{keyBindings.length}</span>
            <span className="text-xs font-semibold uppercase text-muted-foreground">shortcuts</span>
          </div>
        </DialogHeader>

        <div className="shortcut-dialog-body">
          <div className="shortcut-category-list" aria-label="Shortcut sections">
            {categories.map((category) => {
              const meta = categoryMeta[category as keyof typeof categoryMeta]
              const Icon = meta?.icon || Keyboard
              const bindings = keyBindings.filter(b => b.category === category)
              const selected = category === activeCategory

              return (
                <button
                  key={category}
                  type="button"
                  className={cn("shortcut-section-trigger", selected && "shortcut-section-trigger-active")}
                  onClick={() => setActiveCategory(category)}
                  aria-pressed={selected}
                >
                  <div className={cn("shortcut-section-icon", meta?.tone)}>
                    <Icon className="h-5 w-5" weight="duotone" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h3 className="text-sm font-bold text-foreground">{category}</h3>
                    <p className="text-xs text-muted-foreground">{meta?.summary || 'Shortcut group'}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto shortcut-count-badge">
                    {bindings.length}
                  </Badge>
                </button>
              )
            })}
          </div>

          <section className="shortcut-detail-panel" aria-live="polite">
            <div className="shortcut-detail-header">
              <div className={cn("shortcut-section-icon", activeMeta?.tone)}>
                <ActiveIcon className="h-5 w-5" weight="duotone" />
              </div>
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-foreground">{activeCategory}</h3>
                <p className="text-sm text-muted-foreground">{activeMeta?.summary || 'Shortcut group'}</p>
              </div>
              <Badge variant="secondary" className="ml-auto shortcut-count-badge">
                {activeBindings.length}
              </Badge>
            </div>

            <div className="shortcut-list">
              {activeBindings.map((binding, idx) => (
                <div key={`${binding.action}-${idx}`} className="shortcut-row">
                  <span className="shortcut-description">
                    {binding.description}
                  </span>
                  <div className="shortcut-keys" aria-label={`${binding.description} shortcut`}>
                    {getKeyLabel(binding).map((key, keyIdx) => (
                      <kbd key={keyIdx} className="shortcut-key">
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="shortcut-dialog-footer">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Keyboard className="h-4 w-4" weight="duotone" />
            <span>
              Press <kbd className="shortcut-inline-key">Ctrl+K</kbd> anytime
            </span>
          </div>
          <DialogDescription className="text-xs">
            Esc closes this panel
          </DialogDescription>
        </div>
      </DialogContent>
    </Dialog>
  )
}
