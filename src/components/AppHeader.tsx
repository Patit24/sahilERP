import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CaretLeft,
  CaretRight,
  Keyboard,
  Lock,
  List,
} from '@phosphor-icons/react'

interface AppHeaderProps {
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  onLockApp: () => void
  activeView: string
  safeBusinessName: string
  safeCurrentFY: string
  safeIsLocked: boolean
  currentUserLabel: string
  currentUserRole: string
  setShortcutsDialogOpen: (open: boolean) => void
}

export function AppHeader({
  sidebarExpanded,
  setSidebarExpanded,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  onLockApp,
  activeView,
  safeBusinessName,
  safeCurrentFY,
  safeIsLocked,
  currentUserLabel,
  currentUserRole,
  setShortcutsDialogOpen,
}: AppHeaderProps) {
  return (
    <header className="app-header h-16 border-b border-border header-spacing-responsive flex items-center justify-between">
      <div className="flex items-center gap-responsive-md overflow-hidden">
        <motion.button
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="app-icon-button flex md:hidden"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.96 }}
          aria-label="Open navigation menu"
          title="Open navigation menu"
        >
          <List className="h-5 w-5" weight="bold" />
        </motion.button>
        <motion.button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="app-icon-button hidden md:flex"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={sidebarExpanded ? "Collapse sidebar (Ctrl+B)" : "Expand sidebar (Ctrl+B)"}
        >
          {sidebarExpanded ? (
            <CaretLeft className="h-4 w-4" weight="bold" />
          ) : (
            <CaretRight className="h-4 w-4" weight="bold" />
          )}
        </motion.button>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.25 }}
            className="flex-1 min-w-0"
          >
            <h2 className="text-responsive-xl font-bold text-foreground truncate leading-tight tracking-tight">{safeBusinessName}</h2>
            <p className="text-responsive-xs text-muted-foreground font-medium hidden sm:block">Source-Driven Financial Management</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-responsive-sm sm:gap-responsive-md flex-shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShortcutsDialogOpen(true)}
          className="app-soft-button gap-2 text-muted-foreground hover:text-foreground"
          title="Keyboard shortcuts (Ctrl+K)"
        >
          <Keyboard className="h-4 w-4" weight="duotone" />
          <span className="hidden sm:inline text-responsive-xs">Shortcuts</span>
        </Button>
        {safeIsLocked && (
          <Badge variant="secondary" className="text-responsive-xs px-3 py-1.5 font-semibold gap-1.5 bg-amber-50 text-amber-900 border border-amber-200 shadow-sm hidden sm:inline-flex">
            <Lock className="h-3.5 w-3.5" weight="fill" />
            Read Only
          </Badge>
        )}
        <Badge variant="secondary" className="hidden md:inline-flex max-w-[180px] gap-1.5 px-3 py-1.5 text-responsive-xs font-semibold">
          <span className="truncate">{currentUserLabel}</span>
          <span className="text-muted-foreground">· {currentUserRole}</span>
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onLockApp}
          className="app-soft-button gap-2 text-muted-foreground hover:text-foreground"
          title="Lock app"
        >
          <Lock className="h-4 w-4" weight="duotone" />
          <span className="hidden lg:inline text-responsive-xs">Lock</span>
        </Button>
        <Badge variant="outline" className="app-fy-badge text-responsive-xs px-3 py-1.5 font-mono font-semibold">
          {safeCurrentFY}
        </Badge>
      </div>
    </header>
  )
}
