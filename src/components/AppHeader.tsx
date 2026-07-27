import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CaretLeft,
  CaretRight,
  Keyboard,
  Lock,
  List,
  User,
  Gear,
  Plus
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
    <header className="app-header h-16 bg-white border-b border-slate-200/80 px-4 md:px-6 flex items-center justify-between z-30 shrink-0">
      {/* Left side brand / collapse button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="h-9 w-9 text-slate-600 md:hidden hover:bg-slate-100"
          aria-label="Toggle navigation"
        >
          <List className="h-5 w-5" weight="bold" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="h-9 w-9 text-slate-500 hidden md:flex hover:bg-slate-100 rounded-lg"
          title={sidebarExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          <List className="h-5 w-5" weight="bold" />
        </Button>

        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            SK ERP
          </h1>
          <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
          <button
            onClick={() => setShortcutsDialogOpen(true)}
            className="relative px-2 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hidden sm:flex items-center gap-1 group"
          >
            <span>Shortcuts</span>
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-600 rounded-full" />
          </button>
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {safeIsLocked && (
          <span className="hidden sm:inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            <Lock className="h-3.5 w-3.5" weight="fill" />
            Read Only
          </span>
        )}

        {/* FY Pill Badge */}
        <span className="bg-blue-50 text-[#0256e8] font-bold px-3.5 py-1 rounded-full text-xs border border-blue-100/80 shadow-2xs font-mono">
          {safeCurrentFY}
        </span>

        {/* User Profile Pill */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100/80 text-slate-800 px-3 py-1 rounded-full text-xs font-semibold border border-slate-200/60">
          <div className="h-5 w-5 rounded-full bg-blue-600 text-white flex items-center justify-center">
            <User className="h-3 w-3" weight="bold" />
          </div>
          <span>{currentUserLabel || 'Master Admin'}</span>
          <span className="text-slate-400 font-normal">· {currentUserRole}</span>
        </div>

        {/* Lock button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onLockApp}
          className="h-9 w-9 text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Lock session"
        >
          <Lock className="h-4 w-4" weight="bold" />
        </Button>

        {/* Settings button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShortcutsDialogOpen(true)}
          className="h-9 w-9 text-slate-600 hover:bg-slate-100 rounded-lg"
          title="Shortcuts & settings"
        >
          <Gear className="h-4 w-4" weight="bold" />
        </Button>

        {/* Header circular action button */}
        <Button
          size="icon"
          className="h-9 w-9 rounded-full bg-[#0256e8] hover:bg-[#0046cd] text-white shadow-sm"
          title="Quick action"
        >
          <Plus className="h-5 w-5" weight="bold" />
        </Button>
      </div>
    </header>
  )
}
