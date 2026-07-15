import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { generateFYOptions, createBusinessId } from '@/lib/storage-utils'
import { Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface AddBusinessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onBusinessCreated: (id: string, name: string, startFY: string) => void
}

export function AddBusinessDialog({ open, onOpenChange, onBusinessCreated }: AddBusinessDialogProps) {
  const [businessName, setBusinessName] = useState('')
  const [startFY, setStartFY] = useState('')

  const fyOptions = generateFYOptions()

  const handleCreate = () => {
    if (!businessName.trim()) {
      toast.error('Please enter a business name')
      return
    }
    
    if (!startFY) {
      toast.error('Please select a starting financial year')
      return
    }

    const id = createBusinessId(businessName)
    onBusinessCreated(id, businessName.trim(), startFY)
    
    setBusinessName('')
    setStartFY('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" weight="bold" />
            Add New Business
          </DialogTitle>
          <DialogDescription>
            Create a new business entity with its starting financial year
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Enter business name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="start-fy">Starting Financial Year</Label>
            <Select value={startFY} onValueChange={setStartFY}>
              <SelectTrigger id="start-fy">
                <SelectValue placeholder="Select FY" />
              </SelectTrigger>
              <SelectContent>
                {fyOptions.map((fy) => (
                  <SelectItem key={fy} value={fy}>
                    {fy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate}>
            Create Business
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
