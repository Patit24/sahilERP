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
  Database,
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
        "app-sidebar fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-sidebar-border md:relative md:z-auto",
        mobileSidebarOpen && "is-mobile-open",
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      <div className="px-responsive-lg py-responsive-md border-b border-sidebar-border flex-shrink-0">
        <div className="flex items-center gap-responsive-sm mb-1">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-sidebar-primary via-accent to-sidebar-primary/80 flex items-center justify-center shadow-md ring-1 ring-sidebar-border/20">
            <Buildings className="h-6 w-6 text-primary-foreground drop-shadow-sm" weight="duotone" />
          </div>
          <AnimatePresence mode="wait">
            {isVisuallyExpanded && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ 
                  type: "spring",
                  stiffness: 350,
                  damping: 25,
                  mass: 0.5
                }}
                className="flex-1 min-w-0 space-y-1"
              >
                <select
                  value={activeCompany}
                  onChange={(e) => setActiveCompany(e.target.value)}
                  disabled={!canManageSystem}
                  className="w-full text-sm font-semibold text-sidebar-foreground bg-sidebar-accent/30 border border-sidebar-border rounded-md px-2 py-1 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-colors"
                >
                  {safeStoredCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
                <select
                  value={activeFY}
                  onChange={(e) => setActiveFY(e.target.value)}
                  disabled={!canManageSystem}
                  className="w-full text-xs font-medium text-sidebar-foreground/80 bg-sidebar-accent/20 border border-sidebar-border rounded-md px-2 py-0.5 hover:bg-sidebar-accent focus:outline-none focus:ring-2 focus:ring-sidebar-ring transition-colors"
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
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {isVisuallyExpanded && canManageSystem && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 28,
                  mass: 0.6
                }}
                className="flex gap-1"
              >
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 hover:bg-sidebar-accent text-sidebar-foreground" title="Add Business" onClick={() => setAddBusinessDialogOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 hover:bg-sidebar-accent text-sidebar-foreground" title="Edit/Delete Business" onClick={handleOpenEditBusiness}>
                  <Gear className="h-3.5 w-3.5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-auto">
        <div className="sidebar-spacing-responsive">
          <nav className="space-y-responsive-lg">
            <div>
              <motion.button
                onClick={() => setActiveView('dashboard')}
                className={cn(
                  "w-full flex items-center gap-responsive-sm px-responsive-sm py-responsive-sm rounded-lg text-responsive-sm font-medium transition-colors",
                  activeView === 'dashboard'
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.15 }}
                title={!isVisuallyExpanded ? 'Dashboard' : undefined}
              >
                <SquaresFour className="h-5 w-5 flex-shrink-0" weight="duotone" />
                <AnimatePresence mode="wait">
                  {isVisuallyExpanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ 
                        type: "spring",
                        stiffness: 380,
                        damping: 26,
                        mass: 0.5
                      }}
                    >
                      Dashboard
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>

            <AnimatePresence mode="wait">
              {isVisuallyExpanded ? (
                <motion.div
                  key="expanded-nav"
                  initial={{ opacity: 0, x: -15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 320,
                    damping: 28,
                    mass: 0.7
                  }}
                  className="space-y-responsive-lg"
                >
                  {navGroups.map((group) => (
                    <Collapsible
                      key={group.title}
                      open={openGroups[group.title]}
                      onOpenChange={(open) => handleGroupToggle(group.title, open)}
                    >
                      <CollapsibleTrigger className="w-full group">
                        <div className="flex items-center justify-between px-responsive-sm py-responsive-sm rounded-lg hover:bg-sidebar-accent/50 transition-colors">
                          <h3 className="text-responsive-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
                            {group.title}
                          </h3>
                          <motion.div
                            animate={{ rotate: openGroups[group.title] ? 180 : 0 }}
                            transition={{ 
                              type: "spring",
                              stiffness: 350,
                              damping: 25,
                              mass: 0.5
                            }}
                          >
                            <CaretDown className="h-4 w-4 text-sidebar-foreground/60" />
                          </motion.div>
                        </div>
                      </CollapsibleTrigger>
                      <AnimatePresence initial={false}>
                        {openGroups[group.title] && (
                          <CollapsibleContent forceMount asChild>
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ 
                                height: "auto", 
                                opacity: 1,
                                transition: {
                                  height: { 
                                    type: "spring",
                                    stiffness: 320,
                                    damping: 30,
                                    mass: 0.8
                                  },
                                  opacity: { 
                                    duration: 0.25,
                                    ease: "easeOut"
                                  }
                                }
                              }}
                              exit={{ 
                                height: 0, 
                                opacity: 0,
                                transition: {
                                  height: { 
                                    type: "spring",
                                    stiffness: 350,
                                    damping: 28,
                                    mass: 0.6
                                  },
                                  opacity: { 
                                    duration: 0.15,
                                    ease: "easeIn"
                                  }
                                }
                              }}
                              className="overflow-hidden mt-responsive-sm"
                            >
                              <div className="space-y-responsive-xs">
                                {group.items.map((item, index) => {
                                  const Icon = item.icon
                                  return (
                                    <motion.button
                                      key={item.id}
                                      initial={{ x: -8, opacity: 0 }}
                                      animate={{ 
                                        x: 0, 
                                        opacity: 1,
                                        transition: {
                                          delay: index * 0.025,
                                          type: "spring",
                                          stiffness: 400,
                                          damping: 28,
                                          mass: 0.5
                                        }
                                      }}
                                      exit={{ 
                                        x: -8, 
                                        opacity: 0,
                                        transition: { 
                                          duration: 0.12,
                                          ease: "easeIn"
                                        }
                                      }}
                                      whileHover={{ scale: 1.02, x: 2 }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleNavigate(item.id, group.title)}
                                      className={cn(
                                        "w-full flex items-center gap-responsive-sm px-responsive-sm py-responsive-sm rounded-lg text-responsive-sm font-medium transition-colors",
                                        activeView === item.id
                                          ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                      )}
                                    >
                                      <Icon className="h-4 w-4" weight="duotone" />
                                      {item.label}
                                    </motion.button>
                                  )
                                })}
                              </div>
                            </motion.div>
                          </CollapsibleContent>
                        )}
                      </AnimatePresence>
                    </Collapsible>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="collapsed-nav"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 360,
                    damping: 26,
                    mass: 0.6
                  }}
                  className="space-y-responsive-sm"
                >
                  {navGroups.flatMap(group => group.items).map((item, index) => {
                    const Icon = item.icon
                    return (
                      <motion.button
                        key={item.id}
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ 
                          opacity: 1, 
                          y: 0,
                          transition: {
                            stiffness: 420,
                            damping: 27,
                            mass: 0.5
                          }
                        }}
                        onClick={() => {
                          setActiveView(item.id)
                          setMobileSidebarOpen(false)
                        }}
                        className={cn(
                          "w-full flex items-center justify-center p-responsive-sm rounded-lg transition-colors",
                          activeView === item.id
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        )}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        title={item.label}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" weight="duotone" />
                      </motion.button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </nav>
        </div>
      </ScrollArea>

      {isVisuallyExpanded && canManageSystem && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ 
            type: "spring",
            stiffness: 340,
            damping: 28,
            mass: 0.7
          }}
          className="mt-auto p-4 border-t border-sidebar-border bg-sidebar space-y-3 flex-shrink-0"
        >
          <div className="text-[10px] font-bold tracking-wider text-sidebar-foreground/50 uppercase px-1">
            Data Management
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={handleSingleEntityBackup}
              className="flex items-center justify-center gap-2 h-9 text-xs font-medium rounded-lg border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all shadow-sm"
              title="Backup current business/year only"
            >
              <DownloadSimple className="w-3.5 h-3.5" weight="bold" />
              Single
            </button>
            
            <button 
              onClick={handleMasterBackup}
              className="flex items-center justify-center gap-2 h-9 text-xs font-medium rounded-lg border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all shadow-sm"
              title="Full Master Backup - All businesses/years"
            >
              <Database className="w-3.5 h-3.5" weight="bold" />
              Master
            </button>
          </div>

          <div className="w-full">
            <input
              type="file"
              id="sidebar-smart-restore"
              accept=".json"
              className="hidden"
              onChange={handleSmartRestore}
            />
            <label 
              htmlFor="sidebar-smart-restore" 
              className="flex items-center justify-center gap-2 w-full h-9 rounded-lg text-xs font-semibold bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-600 hover:text-white hover:border-emerald-600 cursor-pointer transition-all shadow-sm text-center"
            >
              <UploadSimple className="w-3.5 h-3.5" weight="bold" />
              Restore Backup File
            </label>
          </div>
        </motion.div>
      )}
    </motion.aside>
  )
}
