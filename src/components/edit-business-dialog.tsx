import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Gear, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface EditBusinessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  businessId: string
  businessName: string
  onBusinessUpdated: (id: string, newName: string) => void
  onBusinessDeleted: (id: string) => void
  canDelete: boolean
}

export function EditBusinessDialog({
  open,
  onOpenChange,
  businessId,
  businessName,
  onBusinessUpdated,
  onBusinessDeleted,
  canDelete
}: EditBusinessDialogProps) {
  const [name, setName] = useState(businessName)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [confirmDeleteCheckbox, setConfirmDeleteCheckbox] = useState(false)

  const handleSave = () => {
    if (!name.trim()) {
      toast.error('Please enter a business name')
      return
    }
    
    onBusinessUpdated(businessId, name.trim())
    onOpenChange(false)
    toast.success('Business updated successfully')
  }

  const handleDelete = () => {
    onBusinessDeleted(businessId)
    setDeleteConfirmOpen(false)
    onOpenChange(false)
    toast.success('Business deleted successfully')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="modal-content">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gear className="h-5 w-5 text-primary" weight="bold" />
            Edit Business
          </DialogTitle>
          <DialogDescription>
            Update business name or delete this business entity
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="business-name">Business Name</Label>
            <Input
              id="business-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter business name"
            />
          </div>
          
          {canDelete && (
            <div className="pt-4 border-t border-border">
              <div className="space-y-2">
                <Label className="text-destructive">Danger Zone</Label>
                <p className="text-xs text-muted-foreground">
                  Deleting this business will remove all associated data permanently.
                </p>
                
                <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full gap-2 border-destructive/30 text-destructive hover:bg-destructive/10"
                    >
                      <Trash className="h-4 w-4" />
                      Delete Business
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <Trash className="h-5 w-5 text-destructive" />
                        Delete Business
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete <strong>{businessName}</strong>?
                        This will permanently remove all data associated with this business across all financial years.
                        This action cannot be undone.
                        <div className="flex items-center space-x-2 mt-4 p-3 bg-destructive/10 rounded-md">
                          <input 
                            type="checkbox" 
                            id="edit-confirm-delete-checkbox" 
                            className="w-4 h-4 accent-destructive"
                            checked={confirmDeleteCheckbox}
                            onChange={(e) => setConfirmDeleteCheckbox(e.target.checked)}
                          />
                          <Label htmlFor="edit-confirm-delete-checkbox" className="text-sm font-medium text-destructive">
                            I understand that if I delete this profile, the business data will be permanently deleted and cannot be restored.
                          </Label>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setConfirmDeleteCheckbox(false)}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          handleDelete();
                          setConfirmDeleteCheckbox(false);
                        }}
                        disabled={!confirmDeleteCheckbox}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                      >
                        Delete Permanently
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
