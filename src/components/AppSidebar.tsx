import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SquaresFour,
  CaretDown,
  Buildings,
  Plus,
  Gear,
  DownloadSimple,
  UploadSimple,
  SignOut,
  Database,
  Bank
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

type NavItem = {
  id: string
  label: string
  icon: React.ComponentType<any>
}

type NavGroup = {
  title: string
  isSingle?: boolean
  items: NavItem[]
}

type ThemeConfig = {
  badgeBg: string
  badgeText: string
  activeBg: string
  activeText: string
  iconBg: string
  iconText: string
  borderHover: string
  dotBg: string
}

const GROUP_THEMES: Record<string, ThemeConfig> = {
  Sales: {
    badgeBg: 'bg-blue-50/90 text-blue-700 border-blue-200/80',
    badgeText: 'text-blue-700',
    activeBg: 'bg-[#0256e8] text-white shadow-blue-500/20',
    activeText: 'text-white',
    iconBg: 'bg-blue-100/80 text-blue-600',
    iconText: 'text-blue-600',
    borderHover: 'hover:border-blue-300 hover:bg-blue-50/50',
    dotBg: 'bg-blue-500'
  },
  Purchase: {
    badgeBg: 'bg-purple-50/90 text-purple-700 border-purple-200/80',
    badgeText: 'text-purple-700',
    activeBg: 'bg-purple-600 text-white shadow-purple-500/20',
    activeText: 'text-white',
    iconBg: 'bg-purple-100/80 text-purple-600',
    iconText: 'text-purple-600',
    borderHover: 'hover:border-purple-300 hover:bg-purple-50/50',
    dotBg: 'bg-purple-500'
  },
  Expenses: {
    badgeBg: 'bg-amber-50/90 text-amber-700 border-amber-200/80',
    badgeText: 'text-amber-700',
    activeBg: 'bg-amber-600 text-white shadow-amber-500/20',
    activeText: 'text-white',
    iconBg: 'bg-amber-100/80 text-amber-600',
    iconText: 'text-amber-600',
    borderHover: 'hover:border-amber-300 hover:bg-amber-50/50',
    dotBg: 'bg-amber-500'
  },
  Items: {
    badgeBg: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/80',
    badgeText: 'text-emerald-700',
    activeBg: 'bg-emerald-600 text-white shadow-emerald-500/20',
    activeText: 'text-white',
    iconBg: 'bg-emerald-100/80 text-emerald-600',
    iconText: 'text-emerald-600',
    borderHover: 'hover:border-emerald-300 hover:bg-emerald-50/50',
    dotBg: 'bg-emerald-500'
  },
  'Cash & Bank': {
    badgeBg: 'bg-cyan-50/90 text-cyan-700 border-cyan-200/80',
    badgeText: 'text-cyan-700',
    activeBg: 'bg-cyan-600 text-white shadow-cyan-500/20',
    activeText: 'text-white',
    iconBg: 'bg-cyan-100/80 text-cyan-600',
    iconText: 'text-cyan-600',
    borderHover: 'hover:border-cyan-300 hover:bg-cyan-50/50',
    dotBg: 'bg-cyan-500'
  },
  Reports: {
    badgeBg: 'bg-rose-50/90 text-rose-700 border-rose-200/80',
    badgeText: 'text-rose-700',
    activeBg: 'bg-rose-600 text-white shadow-rose-500/20',
    activeText: 'text-white',
    iconBg: 'bg-rose-100/80 text-rose-600',
    iconText: 'text-rose-600',
    borderHover: 'hover:border-rose-300 hover:bg-rose-50/50',
    dotBg: 'bg-rose-500'
  },
  'Discount Configuration': {
    badgeBg: 'bg-indigo-50/90 text-indigo-700 border-indigo-200/80',
    badgeText: 'text-indigo-700',
    activeBg: 'bg-indigo-600 text-white shadow-indigo-500/20',
    activeText: 'text-white',
    iconBg: 'bg-indigo-100/80 text-indigo-600',
    iconText: 'text-indigo-600',
    borderHover: 'hover:border-indigo-300 hover:bg-indigo-50/50',
    dotBg: 'bg-indigo-500'
  },
  Admin: {
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    badgeText: 'text-slate-700',
    activeBg: 'bg-slate-800 text-white shadow-slate-500/20',
    activeText: 'text-white',
    iconBg: 'bg-slate-200/80 text-slate-700',
    iconText: 'text-slate-700',
    borderHover: 'hover:border-slate-300 hover:bg-slate-100/60',
    dotBg: 'bg-slate-600'
  }
}

interface AppSidebarProps {
  sidebarRef: React.RefObject<HTMLElement | null>
  sidebarExpanded: boolean
  mobileSidebarOpen: boolean
  setMobileSidebarOpen: (open: boolean) => void
  isHoveringsidebar: boolean
  activeView: string
  activeCompany: string
  activeFY: string
  safeStoredCompanies: string[]
  openGroups: Record<string, boolean>
  navGroups: NavGroup[]
  setActiveView: (view: string) => void
  setActiveCompany: (company: string) => void
  setActiveFY: (fy: string) => void
  setAddBusinessDialogOpen: (open: boolean) => void
  handleOpenEditBusiness: () => void
  handleGroupToggle: (groupTitle: string, isOpen: boolean) => void
  handleNavigate: (viewId: string, groupTitle: string) => void
  handleSingleEntityBackup: () => void
  handleMasterBackup: () => void
  handleSmartRestore: (e: React.ChangeEvent<HTMLInputElement>) => void
  canManageSystem: boolean
  onLogout?: () => void
}

export function AppSidebar({
  sidebarRef,
  sidebarExpanded,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  isHoveringsidebar,
  activeView,
  activeCompany,
  activeFY,
  safeStoredCompanies,
  openGroups,
  navGroups,
  setActiveView,
  setActiveCompany,
  setActiveFY,
  setAddBusinessDialogOpen,
  handleOpenEditBusiness,
  handleGroupToggle,
  handleNavigate,
  handleSingleEntityBackup,
  handleMasterBackup,
  handleSmartRestore,
  canManageSystem,
  onLogout,
}: AppSidebarProps) {
  const isVisuallyExpanded = sidebarExpanded || isHoveringsidebar || mobileSidebarOpen

  return (
    <motion.aside 
      ref={sidebarRef}
      initial={false}
      animate={{ 
        width: isVisuallyExpanded ? 280 : 72
      }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8
      }}
      className={cn(
        "app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-[#f4f7fc] border-r border-slate-200/80 md:relative md:z-auto shrink-0",
        mobileSidebarOpen && "is-mobile-open",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Brand Header */}
      <div className="p-4 border-b border-slate-200/70 shrink-0">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-[#0256e8] text-white flex items-center justify-center shadow-sm">
            <Bank className="h-6 w-6" weight="fill" />
          </div>
          <AnimatePresence mode="wait">
            {isVisuallyExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex-1 min-w-0"
              >
                <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">SK</h1>
                <p className="text-[10px] text-slate-500 font-medium leading-tight truncate">
                  Source-Driven Financial Management
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {isVisuallyExpanded && (
          <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-200/50">
            <div className="flex items-center justify-between gap-1">
              <select
                value={activeCompany}
                onChange={(e) => setActiveCompany(e.target.value)}
                disabled={!canManageSystem}
                className="w-full text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {safeStoredCompanies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              {canManageSystem && (
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200/60" title="Add Business" onClick={() => setAddBusinessDialogOpen(true)}>
                    <Plus className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-500 hover:bg-slate-200/60" title="Edit/Delete Business" onClick={handleOpenEditBusiness}>
                    <Gear className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1.5">
          {/* Dashboard Item */}
          <button
            onClick={() => setActiveView('dashboard')}
            className={cn(
              "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left",
              activeView === 'dashboard'
                ? "bg-[#0256e8] text-white font-semibold shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            )}
            title={!isVisuallyExpanded ? 'Dashboard' : undefined}
          >
            <SquaresFour className={cn("h-5 w-5 shrink-0", activeView === 'dashboard' ? "text-white" : "text-slate-500")} weight="duotone" />
            {isVisuallyExpanded && <span>Dashboard</span>}
          </button>

          {/* Group items */}
          {navGroups.map((group) => {
            const isGroupOpen = openGroups[group.title] ?? true
            const hasActiveChild = group.items.some(item => item.id === activeView)
            const theme = GROUP_THEMES[group.title] || GROUP_THEMES.Sales

            if (!isVisuallyExpanded) {
              return (
                <div key={group.title} className="space-y-1 py-1">
                  {group.items.map(item => {
                    const Icon = item.icon
                    const isActive = activeView === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id, group.title)}
                        className={cn(
                          "w-full flex items-center justify-center p-2.5 rounded-xl transition-all border",
                          isActive
                            ? `${theme.activeBg} ${theme.activeText} border-transparent shadow-sm`
                            : `bg-white/70 text-slate-600 border-slate-200/60 ${theme.borderHover}`
                        )}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5 shrink-0" weight="duotone" />
                      </button>
                    )
                  })}
                </div>
              )
            }

            if (group.isSingle) {
              const item = group.items[0]
              const Icon = item.icon
              const isActive = activeView === item.id
              return (
                <div key={group.title} className="py-0.5">
                  <button
                    onClick={() => handleNavigate(item.id, group.title)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs transition-all text-left border shadow-2xs group/single",
                      isActive
                        ? `${theme.activeBg} ${theme.activeText} border-transparent font-bold shadow-sm`
                        : `bg-white text-slate-700 border-slate-200/80 ${theme.borderHover} font-medium`
                    )}
                  >
                    <div className={cn(
                      "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : `${theme.iconBg} ${theme.iconText}`
                    )}>
                      <Icon className="h-4 w-4" weight="duotone" />
                    </div>
                    <span className="truncate flex-1 text-[13px] font-semibold">{item.label}</span>
                  </button>
                </div>
              )
            }

            return (
              <Collapsible
                key={group.title}
                open={isGroupOpen}
                onOpenChange={(isOpen) => handleGroupToggle(group.title, isOpen)}
                className="space-y-1.5 py-0.5"
              >
                {group.title !== 'Primary' && (
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold tracking-wider text-slate-500 uppercase hover:text-slate-900 group/trigger transition-colors">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", theme.dotBg)} />
                      <span>{group.title}</span>
                      <span className={cn("text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold border ml-1", theme.badgeBg)}>
                        {group.items.length}
                      </span>
                    </div>
                    <CaretDown className={cn("h-3.5 w-3.5 text-slate-400 group-hover/trigger:text-slate-600 transition-transform duration-200", isGroupOpen ? "rotate-0" : "-rotate-90")} />
                  </CollapsibleTrigger>
                )}

                <CollapsibleContent className="mt-1 pl-2.5 space-y-1.5 border-l-2 border-slate-200/80 ml-3 py-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeView === item.id

                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id, group.title)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all text-left border shadow-2xs group/item relative overflow-hidden",
                          isActive
                            ? `${theme.activeBg} ${theme.activeText} border-transparent font-bold shadow-md`
                            : `bg-white text-slate-700 border-slate-200/80 ${theme.borderHover} font-medium hover:shadow-xs`
                        )}
                      >
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                          isActive
                            ? "bg-white/20 text-white"
                            : `${theme.iconBg} ${theme.iconText}`
                        )}>
                          <Icon className="h-4 w-4" weight="duotone" />
                        </div>
                        <span className="truncate flex-1 text-[13px] font-medium">{item.label}</span>
                      </button>
                    )
                  })}
                </CollapsibleContent>
              </Collapsible>
            )
          })}
        </nav>
      </ScrollArea>

      {/* Bottom Footer Actions */}
      {isVisuallyExpanded && canManageSystem && (
        <div className="p-4 border-t border-slate-200/70 bg-[#f4f7fc] space-y-2.5 shrink-0">
          <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase px-1">
            Data Management
          </div>
          
          <div className="grid grid-cols-2 gap-1.5">
            <button 
              onClick={handleSingleEntityBackup}
              className="flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
              title="Backup current business/year"
            >
              <DownloadSimple className="w-3.5 h-3.5 text-slate-500" weight="bold" />
              Single
            </button>
            
            <button 
              onClick={handleMasterBackup}
              className="flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-all shadow-2xs"
              title="Full Master Backup"
            >
              <Database className="w-3.5 h-3.5 text-slate-500" weight="bold" />
              Master
            </button>
          </div>

          <div>
            <input
              type="file"
              id="sidebar-smart-restore"
              accept=".json"
              className="hidden"
              onChange={handleSmartRestore}
            />
            <label 
              htmlFor="sidebar-smart-restore" 
              className="flex items-center justify-center gap-2 w-full h-9 rounded-xl text-xs font-semibold bg-blue-50/80 border border-blue-200/80 text-[#0256e8] hover:bg-blue-100 cursor-pointer transition-all shadow-2xs text-center"
            >
              <UploadSimple className="w-4 h-4" weight="bold" />
              Restore Backup File
            </label>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="flex items-center justify-center gap-2 w-full h-8 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-50 transition-all"
            >
              <SignOut className="w-4 h-4" weight="bold" />
              Logout
            </button>
          )}
        </div>
      )}
    </motion.aside>
  )
}
