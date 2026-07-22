import { useMemo, useState } from 'react'
import { ShieldCheck, UserPlus, Trash, PencilSimple, Prohibit } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  createAgentAccount,
  deleteAgentAccount,
  PermissionLevel,
  PermissionMap,
  updateAgentAccount,
  UserAccount
} from '@/lib/security-utils'
import { cn } from '@/lib/utils'

export interface PermissionOption {
  id: string
  label: string
  group: string
}

interface UserManagementPageProps {
  accounts: UserAccount[]
  permissionOptions: PermissionOption[]
  onAccountsChange: (accounts: UserAccount[]) => void
  securityMode?: 'local' | 'server'
  counters: any[]
  onSaveAgent?: (input: {
    id: string
    displayName: string
    permissions: PermissionMap
    isActive: boolean
    allowedCounters?: string[]
  }) => Promise<UserAccount[]>
  onCreateRemoteAgent?: (input: {
    email: string
    displayName: string
    passcode: string
    permissions: PermissionMap
    companyId: string
    allowedCounters?: string[]
  }) => Promise<void>
}

const defaultPermission = 'none' as PermissionLevel

function emptyPermissions(options: PermissionOption[]): PermissionMap {
  return options.reduce<PermissionMap>((acc, option) => {
    acc[option.id] = option.id === 'dashboard' ? 'view' : defaultPermission
    return acc
  }, {})
}

export default function UserManagementPage({
  accounts,
  permissionOptions,
  counters,
  onAccountsChange,
  securityMode = 'local',
  onSaveAgent,
  onCreateRemoteAgent
}: UserManagementPageProps) {
  const isServerMode = securityMode === 'server'
  const agentAccounts = useMemo(
    () => accounts.filter((account) => account.role === 'agent'),
    [accounts]
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [passcode, setPasscode] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [permissions, setPermissions] = useState<PermissionMap>(() => emptyPermissions(permissionOptions))
  const [allowedCounters, setAllowedCounters] = useState<string[]>([])

  const groupedOptions = useMemo(() => {
    return permissionOptions.reduce<Record<string, PermissionOption[]>>((acc, option) => {
      acc[option.group] = [...(acc[option.group] || []), option]
      return acc
    }, {})
  }, [permissionOptions])

  const toggleCounter = (counterId: string) => {
    setAllowedCounters(prev => 
      prev.includes(counterId) 
        ? prev.filter(id => id !== counterId)
        : [...prev, counterId]
    )
  }

  const resetForm = () => {
    setEditingId(null)
    setDisplayName('')
    setUsername('')
    setPasscode('')
    setIsActive(true)
    setPermissions(emptyPermissions(permissionOptions))
    setAllowedCounters([])
  }

  const handleEdit = (account: UserAccount) => {
    setEditingId(account.id)
    setDisplayName(account.displayName)
    setUsername(account.username)
    setPasscode('')
    setIsActive(account.isActive)
    setPermissions({ ...emptyPermissions(permissionOptions), ...account.permissions, dashboard: 'view' })
    setAllowedCounters((account as any).allowedCounters || [])
  }

  const setPermission = (id: string, level: PermissionLevel) => {
    setPermissions((prev) => ({
      ...prev,
      [id]: id === 'dashboard' ? 'view' : level
    }))
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!displayName.trim()) {
      toast.error('Agent name is required')
      return
    }

    if (!editingId && !username.trim()) {
      toast.error('Username is required')
      return
    }
    if (!editingId && passcode.trim().length < 6) {
      toast.error('Use at least 6 characters for the agent passcode')
      return
    }
    if (editingId && passcode.trim() && passcode.trim().length < 6) {
      toast.error('New passcode must be at least 6 characters')
      return
    }

    try {
      if (editingId && isServerMode && onSaveAgent) {
        const nextAccounts = await onSaveAgent({
          id: editingId,
          displayName,
          permissions,
          isActive,
          allowedCounters
        })
        onAccountsChange(nextAccounts)
        toast.success('Server permissions updated')
      } else if (editingId) {
        const nextAccounts = await updateAgentAccount(editingId, {
          displayName,
          passcode: passcode.trim() || undefined,
          permissions,
          isActive,
          allowedCounters
        })
        onAccountsChange(nextAccounts)
        toast.success('Agent updated')
      } else {
        const created = await createAgentAccount({
          username,
          displayName,
          passcode,
          permissions,
          allowedCounters
        })
        onAccountsChange([created, ...accounts])
        toast.success('Agent created')
      }
      resetForm()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save agent')
    }
  }

  const handleDelete = (account: UserAccount) => {
    if (isServerMode) {
      toast.error('Server users cannot be deleted from the browser. Disable the profile here, then remove the Auth user in Supabase if needed.')
      return
    }
    if (!window.confirm(`Delete agent "${account.displayName}"? This cannot be undone.`)) return
    try {
      const nextAccounts = deleteAgentAccount(account.id)
      onAccountsChange(nextAccounts)
      if (editingId === account.id) resetForm()
      toast.success('Agent deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete agent')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agent Access</h2>
          <p className="text-sm text-muted-foreground">
            {isServerMode
              ? 'Server-side Supabase profiles control which ERP areas agents can view or edit.'
              : 'Create agent logins and limit which ERP areas they can view or edit.'}
          </p>
        </div>
        <Badge variant="outline" className="w-fit gap-2 px-3 py-1.5">
          <ShieldCheck className="h-4 w-4" weight="duotone" />
          Master admin only
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(320px,420px)_1fr]">
        <Card className="neo-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {editingId ? <PencilSimple className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
              {editingId ? 'Edit Agent' : 'Add Agent'}
            </CardTitle>
            <CardDescription>
              {isServerMode
                ? 'Create/invite users in Supabase Auth first. Then edit their permissions here.'
                : 'Agents login with their own username and passcode.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="agent-display-name">Agent name</Label>
                <Input
                  id="agent-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="e.g. Sales Operator"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-username">Username</Label>
                <Input
                  id="agent-username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="e.g. sales01"
                  disabled={Boolean(editingId)}
                  autoCapitalize="none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="agent-passcode">{editingId ? 'New passcode (optional)' : 'Passcode'}</Label>
                <Input
                  id="agent-passcode"
                  type="password"
                  value={passcode}
                  onChange={(event) => setPasscode(event.target.value)}
                  placeholder="Minimum 6 characters"
                  disabled={isServerMode && Boolean(editingId)}
                />
                {isServerMode && (
                  <p className="text-xs text-muted-foreground">
                    Passwords can only be set during creation in Server Mode.
                  </p>
                )}
              </div>


              <div className="space-y-2">
                <Label>Assigned Counters</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select which counters this agent can view/manage. (Leave empty if they shouldn't see any balances).
                </p>
                <div className="grid gap-2 grid-cols-2">
                  {counters?.map(counter => (
                    <div 
                      key={counter.id} 
                      onClick={() => toggleCounter(counter.id)}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${allowedCounters.includes(counter.id) ? 'bg-primary/10 border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center ${allowedCounters.includes(counter.id) ? 'bg-primary border-primary' : 'border-input'}`}>
                        {allowedCounters.includes(counter.id) && <ShieldCheck className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{counter.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{counter.type}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {editingId && (
                <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-3">
                  <div>
                    <div className="text-sm font-semibold">Agent active</div>
                    <div className="text-xs text-muted-foreground">Turn off to block login without deleting.</div>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={isServerMode && !editingId}>
                  {editingId ? 'Save Agent' : 'Create Agent'}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="neo-card">
          <CardHeader>
            <CardTitle>Permission Matrix</CardTitle>
            <CardDescription>
              View lets agents open a screen. Edit lets them create, update, and delete records.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {Object.entries(groupedOptions).map(([group, options]) => (
              <div key={group} className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{group}</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  {options.map((option) => (
                    <div
                      key={option.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/70 px-3 py-2 shadow-sm"
                    >
                      <span className="text-sm font-medium">{option.label}</span>
                      <Select
                        value={permissions[option.id] || defaultPermission}
                        onValueChange={(value) => setPermission(option.id, value as PermissionLevel)}
                        disabled={option.id === 'dashboard'}
                      >
                        <SelectTrigger className="h-9 w-[116px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No access</SelectItem>
                          <SelectItem value="view">View</SelectItem>
                          <SelectItem value="edit">Edit</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="neo-card">
        <CardHeader>
          <CardTitle>Existing Agents</CardTitle>
          <CardDescription>
            {isServerMode
              ? 'Disable profiles here. Delete Auth users from the Supabase dashboard or a trusted server function.'
              : 'Delete accounts that should no longer access company data.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {agentAccounts.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-center">
              <Prohibit className="mb-2 h-7 w-7 text-muted-foreground" />
              <p className="text-sm font-semibold">No agent accounts yet</p>
              <p className="text-xs text-muted-foreground">Create the first one from the form above.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {agentAccounts.map((account) => {
                const editCount = Object.values(account.permissions).filter((level) => level === 'edit').length
                const viewCount = Object.values(account.permissions).filter((level) => level === 'view').length
                return (
                  <div
                    key={account.id}
                    className={cn(
                      "rounded-2xl border border-border bg-background/75 p-4 shadow-sm",
                      !account.isActive && "opacity-60"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold">{account.displayName}</div>
                        <div className="text-xs text-muted-foreground">@{account.username}</div>
                      </div>
                      <Badge variant={account.isActive ? 'secondary' : 'outline'}>
                        {account.isActive ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1">{editCount} edit</span>
                      <span className="rounded-full bg-muted px-2 py-1">{viewCount} view-only</span>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(account)}>
                        <PencilSimple className="mr-1.5 h-4 w-4" />
                        Edit
                      </Button>
                      <Button type="button" variant={isServerMode ? 'outline' : 'destructive'} size="sm" onClick={() => handleDelete(account)}>
                        <Trash className="mr-1.5 h-4 w-4" />
                        {isServerMode ? 'Dashboard Delete' : 'Delete'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
