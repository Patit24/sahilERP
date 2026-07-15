import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Keyboard } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

interface ShortcutHintProps {
  show: boolean
  label: string
  keys: string[]
}

export function ShortcutHint({ show, label, keys }: ShortcutHintProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 10 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-6 right-6 z-50 pointer-events-none"
        >
          <div className="bg-popover/98 backdrop-blur-md border-2 border-primary/20 rounded-xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm">
            <Keyboard className="h-5 w-5 text-primary flex-shrink-0" weight="duotone" />
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm font-medium text-foreground truncate">{label}</span>
              <div className="flex items-center gap-1 flex-shrink-0">
                {keys.map((key, idx) => (
                  <Badge
                    key={idx}
                    variant="secondary"
                    className="text-xs font-mono px-2 py-1 bg-primary/10 border border-primary/20 text-primary shadow-sm"
                  >
                    {key}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

interface QuickShortcutToastProps {
  action: string
  description: string
}

export function QuickShortcutToast({ action, description }: QuickShortcutToastProps) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setShow(false), 2000)
    return () => clearTimeout(timer)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 100 }}
          transition={{ duration: 0.3 }}
          className="bg-card border border-border rounded-lg px-4 py-2 shadow-lg flex items-center gap-2"
        >
          <Keyboard className="h-4 w-4 text-primary" weight="duotone" />
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">{action}</span>
            <span className="text-xs text-muted-foreground">{description}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
