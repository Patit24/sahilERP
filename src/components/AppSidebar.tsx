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
  items: NavItem[]
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

            <select
              value={activeFY}
              onChange={(e) => setActiveFY(e.target.value)}
              disabled={!canManageSystem}
              className="w-full text-[11px] font-medium text-slate-600 bg-white/80 border border-slate-200/80 rounded-lg px-2 py-0.5"
            >
              {Array.from({ length: 19 }, (_, i) => {
                const startYear = 2021 + i
                const endYear = startYear + 1
                const fy = `FY${startYear}-${endYear.toString().slice(2)}`
                return (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                )
              })}
            </select>
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
                          "w-full flex items-center justify-center p-2.5 rounded-xl transition-all",
                          isActive
                            ? "bg-[#0256e8] text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
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

            return (
              <Collapsible
                key={group.title}
                open={isGroupOpen}
                onOpenChange={(isOpen) => handleGroupToggle(group.title, isOpen)}
                className="space-y-1"
              >
                {group.title !== 'Primary' && (
                  <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-1.5 text-[11px] font-bold tracking-wider text-slate-400 uppercase hover:text-slate-600">
                    <span>{group.title}</span>
                    <CaretDown className={cn("h-3 w-3 transition-transform duration-200", isGroupOpen ? "rotate-0" : "-rotate-90")} />
                  </CollapsibleTrigger>
                )}
                <CollapsibleContent className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon
                    const isActive = activeView === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNavigate(item.id, group.title)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all text-left",
                          isActive
                            ? "bg-[#0256e8] text-white font-semibold shadow-sm"
                            : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 font-medium"
                        )}
                      >
                        <Icon className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500")} weight="duotone" />
                        <span className="truncate">{item.label}</span>
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
