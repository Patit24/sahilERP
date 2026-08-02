import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Bell,
  MagnifyingGlass,
  List,
  User,
  Gear,
  Sun,
  Moon,
  Lock,
  Plus,
  CaretDown,
  SignOut,
} from '@phosphor-icons/react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useState } from 'react'

interface AppHeaderProps {
  sidebarExpanded: boolean
  setSidebarExpanded: (expanded: boolean) => void
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  onLockApp: () => void
  activeView: string
  safeBusinessName: string
  safeCurrentFY: string
  setActiveFY?: (fy: string) => void
  safeIsLocked: boolean
  currentUserLabel: string
  currentUserRole: string
  setShortcutsDialogOpen: (open: boolean) => void
  onLogout?: () => void
}

// Map view IDs to human-readable titles
const VIEW_TITLES: Record<string, { title: string; sub: string }> = {
  dashboard: { title: 'Dashboard', sub: 'Your business at a glance' },
  sales: { title: 'Sales', sub: 'Invoices & revenue' },
  purchases: { title: 'Purchases', sub: 'Bills & expenses' },
  inventory: { title: 'Inventory', sub: 'Stock & items' },
  customers: { title: 'Customers', sub: 'Customer ledger' },
  suppliers: { title: 'Suppliers', sub: 'Supplier ledger' },
  payments: { title: 'Payments', sub: 'Receipts & payouts' },
  expenses: { title: 'Expenses', sub: 'Operational expenses' },
  reports: { title: 'Reports', sub: 'Analytics & insights' },
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('')
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
  setActiveFY,
  safeIsLocked,
  currentUserLabel,
  currentUserRole,
  setShortcutsDialogOpen,
  onLogout,
}: AppHeaderProps) {
  const [isDark, setIsDark] = useState(false)
  const viewMeta = VIEW_TITLES[activeView] ?? {
    title: activeView.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    sub: safeBusinessName,
  }
  const initials = getInitials(currentUserLabel || 'Master Admin')

  return (
    <header className="app-header h-16 bg-white border-b border-[#E8EAEF] px-4 md:px-6 flex items-center justify-between z-30 shrink-0 shadow-[0_1px_4px_rgba(91,95,239,0.06)]">
      {/* ── Left: hamburger + page title ── */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          className="h-9 w-9 text-slate-500 md:hidden hover:bg-slate-100 rounded-xl"
          aria-label="Toggle navigation"
        >
          <List className="h-5 w-5" weight="bold" />
        </Button>

        {/* Desktop collapse */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="h-9 w-9 text-slate-500 hidden md:flex hover:bg-[#F1F3F9] rounded-xl"
          title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <List className="h-5 w-5" weight="bold" />
        </Button>

        {/* Page title + subtitle */}
        <motion.div
          key={activeView}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="hidden sm:flex flex-col"
        >
          <h1 className="text-[17px] font-extrabold text-slate-900 leading-tight tracking-tight">
            {viewMeta.title}
          </h1>
          <p className="text-[11px] text-slate-400 font-medium leading-none">
            {viewMeta.sub}
          </p>
        </motion.div>
      </div>

      {/* ── Center: search bar ── */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <div className="relative w-full">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            readOnly
            onClick={() => setShortcutsDialogOpen(true)}
            placeholder="Search anything..."
            className="w-full h-9 pl-9 pr-16 text-sm text-slate-500 bg-[#F5F6FA] border border-[#E8EAEF] rounded-xl outline-none cursor-pointer hover:border-[#5B5FEF]/40 transition-colors placeholder:text-slate-400"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <kbd className="text-[10px] font-bold text-slate-400 bg-white border border-[#E8EAEF] rounded-md px-1.5 py-0.5 shadow-sm">⌘</kbd>
            <kbd className="text-[10px] font-bold text-slate-400 bg-white border border-[#E8EAEF] rounded-md px-1.5 py-0.5 shadow-sm">K</kbd>
          </span>
        </div>
      </div>

      {/* ── Right: controls ── */}
      <div className="flex items-center gap-1.5 sm:gap-2">

        {/* Locked badge */}
        {safeIsLocked && (
          <span className="hidden sm:inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
            <Lock className="h-3.5 w-3.5" weight="fill" />
            Read Only
          </span>
        )}

        {/* Light / dark toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsDark(d => !d)}
          className="h-9 w-9 text-slate-500 hover:bg-[#F1F3F9] rounded-xl"
          title="Toggle theme"
        >
          {isDark
            ? <Sun className="h-4.5 w-4.5" weight="bold" />
            : <Moon className="h-4.5 w-4.5" weight="bold" />
          }
        </Button>

        {/* Notification bell */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-slate-500 hover:bg-[#F1F3F9] rounded-xl relative"
          title="Notifications"
        >
          <Bell className="h-4.5 w-4.5" weight="bold" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#5B5FEF] ring-2 ring-white" />
        </Button>

        {/* Settings / shortcuts */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShortcutsDialogOpen(true)}
          className="h-9 w-9 text-slate-500 hover:bg-[#F1F3F9] rounded-xl"
          title="Shortcuts & settings"
        >
          <Gear className="h-4.5 w-4.5" weight="bold" />
        </Button>

        {/* Divider */}
        <div className="h-6 w-px bg-[#E8EAEF] mx-0.5 hidden sm:block" />

        {/* FY pill dropdown */}
        <div className="hidden sm:inline-block">
          <Select value={safeCurrentFY} onValueChange={(val) => setActiveFY?.(val)}>
            <SelectTrigger className="inline-flex items-center gap-1.5 bg-[#5B5FEF]/10 text-[#5B5FEF] font-bold px-3 py-1.5 rounded-xl text-xs border border-[#5B5FEF]/20 hover:bg-[#5B5FEF]/15 transition-colors h-auto w-auto focus:ring-0 focus:ring-offset-0 shadow-none outline-none">
              <SelectValue placeholder="Select FY">{safeCurrentFY}</SelectValue>
            </SelectTrigger>
            <SelectContent className="bg-white border border-[#E8EAEF] rounded-xl shadow-xl z-[100] min-w-[130px]">
              {Array.from(new Set([
                'FY2023-24',
                'FY2024-25',
                'FY2025-26',
                'FY2026-27',
                'FY2027-28',
                'FY2028-29',
                'FY2029-30',
                safeCurrentFY
              ])).filter(Boolean).map((fy) => (
                <SelectItem
                  key={fy}
                  value={fy}
                  className="text-xs font-bold text-slate-700 hover:bg-[#5B5FEF]/10 cursor-pointer py-2 px-3 rounded-lg"
                >
                  {fy}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* User avatar pill with Logout option */}
        <div
          onClick={onLogout}
          title="Click to Logout / Switch Account"
          className="flex items-center gap-2 bg-[#F5F6FA] border border-[#E8EAEF] rounded-xl px-2.5 py-1.5 cursor-pointer hover:bg-red-50 hover:border-red-200 group transition-all"
        >
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-[#5B5FEF] to-[#7C3AED] text-white flex items-center justify-center text-[11px] font-extrabold shadow-sm group-hover:from-red-500 group-hover:to-red-600 transition-all">
            {initials || <User className="h-3.5 w-3.5" weight="bold" />}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-bold text-slate-900 leading-tight truncate max-w-[100px] group-hover:text-red-700">
              {currentUserLabel || 'Master Admin'}
            </span>
            <span className="text-[10px] text-slate-400 font-medium leading-tight capitalize group-hover:text-red-500">
              {currentUserRole || 'Administrator'}
            </span>
          </div>
        </div>

        {/* Dedicated Logout button for fast one-click exit */}
        {onLogout && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onLogout}
            className="h-9 w-9 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-all"
            title="Logout / Switch Account"
          >
            <SignOut className="h-4.5 w-4.5" weight="bold" />
          </Button>
        )}

        {/* Quick Action button */}
        <Button
          className="hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-[#5B5FEF] hover:bg-[#4A4ED8] text-white text-xs font-bold shadow-md shadow-[#5B5FEF]/25 transition-all"
          title="Quick action"
        >
          <Plus className="h-4 w-4" weight="bold" />
          <span>Quick Action</span>
        </Button>
      </div>
    </header>
  )
}
