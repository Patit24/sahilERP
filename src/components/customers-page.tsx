import { useState, useRef } from 'react'
import { Customer } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, UserCircle, Trash, Pencil, Warning, Upload } from '@phosphor-icons/react'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

interface CustomersPageProps {
  customers: Customer[]
  setCustomers: (updater: (prev: Customer[]) => Customer[]) => void
  isLocked?: boolean
}

export default function CustomersPage({ customers, setCustomers, isLocked = false }: CustomersPageProps) {
  const [open, setOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    const openingBalance = parseFloat(formData.get('openingBalance') as string) || 0

    if (editingCustomer) {
      const updatedCustomer: Customer = {
        ...editingCustomer,
        name: formData.get('name') as string,
        email: formData.get('email') as string || undefined,
        phone: formData.get('phone') as string || undefined,
        address: formData.get('address') as string || undefined,
        openingBalance: openingBalance !== 0 ? openingBalance : undefined
      }

      setCustomers((prev) => prev.map(c => c.id === editingCustomer.id ? updatedCustomer : c))
      toast.success('Customer updated successfully')
    } else {
      const customer: Customer = {
        id: `customer-${Date.now()}`,
        name: formData.get('name') as string,
        email: formData.get('email') as string || undefined,
        phone: formData.get('phone') as string || undefined,
        address: formData.get('address') as string || undefined,
        openingBalance: openingBalance !== 0 ? openingBalance : undefined
      }

      setCustomers((prev) => [...prev, customer])
      toast.success('Customer added successfully')
    }
    
    setOpen(false)
    setEditingCustomer(null)
  }

  const handleDeleteClick = (customer: Customer) => {
    if (isLocked) {
      toast.error('Cannot delete in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setCustomerToDelete(customer)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = () => {
    if (customerToDelete) {
      setCustomers((prev) => prev.filter((c) => c.id !== customerToDelete.id))
      toast.success('Customer deleted successfully')
      setDeleteDialogOpen(false)
      setCustomerToDelete(null)
    }
  }

  const handleAdd = () => {
    if (isLocked) {
      toast.error('Cannot add in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingCustomer(null)
    setOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    if (isLocked) {
      toast.error('Cannot edit in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    setEditingCustomer(customer)
    setOpen(true)
  }

  const handleDialogClose = (isOpen: boolean) => {
    setOpen(isOpen)
    if (!isOpen) {
      setEditingCustomer(null)
    }
  }

  const handleImportCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (isLocked) {
      toast.error('Cannot import in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }

    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const lines = text.split('\n').filter(line => line.trim())
        
        if (lines.length === 0) {
          toast.error('CSV file is empty')
          return
        }

        const headerRow = lines[0].split(',').map(h => h.trim())
        const headerMap = new Map<string, number>()
        
        headerRow.forEach((header, index) => {
          headerMap.set(header.toLowerCase(), index)
        })

        const nameIndex = headerMap.get('name')
        const phoneIndex = headerMap.get('phone')
        const emailIndex = headerMap.get('email')
        const addressIndex = headerMap.get('address')
        const openingBalanceIndex = headerMap.get('opening balance')

        if (nameIndex === undefined) {
          toast.error('CSV must contain a "Name" column', {
            description: 'Expected columns: Name, Phone, Email, Address, Opening Balance'
          })
          return
        }

        let addedCount = 0
        let skippedCount = 0
        const newCustomers: Customer[] = []

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim())
          const name = values[nameIndex] || ''

          if (!name) continue

          const existingCustomer = customers.find(
            c => c.name.toLowerCase() === name.toLowerCase()
          )

          if (existingCustomer) {
            skippedCount++
            continue
          }

          const phone = phoneIndex !== undefined ? values[phoneIndex] || '' : ''
          const email = emailIndex !== undefined ? values[emailIndex] || '' : ''
          const address = addressIndex !== undefined ? values[addressIndex] || '' : ''
          const openingBalance = openingBalanceIndex !== undefined 
            ? parseFloat(values[openingBalanceIndex]) || 0
            : 0

          const customer: Customer = {
            id: `customer-${Date.now()}-${i}`,
            name: name,
            phone: phone || undefined,
            email: email || undefined,
            address: address || undefined,
            openingBalance: openingBalance !== 0 ? openingBalance : undefined
          }

          newCustomers.push(customer)
          addedCount++
        }

        if (newCustomers.length > 0) {
          setCustomers((prev) => [...prev, ...newCustomers])
        }

        if (addedCount > 0 && skippedCount > 0) {
          toast.success(`Imported ${addedCount} customers, skipped ${skippedCount} duplicates`)
        } else if (addedCount > 0) {
          toast.success(`Successfully imported ${addedCount} customers`)
        } else if (skippedCount > 0) {
          toast.warning(`All ${skippedCount} customers already exist`)
        } else {
          toast.info('No valid customer data found in CSV')
        }
      } catch (error) {
        console.error('CSV import error:', error)
        toast.error('Failed to import CSV file')
      }
    }

    reader.readAsText(file)
    
    if (event.target) {
      event.target.value = ''
    }
  }

  const handleImportClick = () => {
    if (isLocked) {
      toast.error('Cannot import in locked mode', {
        description: 'Unlock the data in Settings to make changes'
      })
      return
    }
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <UserCircle size={24} weight="duotone" className="text-primary" />
            Customer Master
          </CardTitle>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
            <Button onClick={handleImportClick} variant="outline">
              <Upload size={18} weight="bold" />
              Import Customers
            </Button>
            <Dialog open={open} onOpenChange={handleDialogClose}>
              <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                  <Plus size={18} weight="bold" />
                  Add Customer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Customer Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Enter customer name"
                      defaultValue={editingCustomer?.name}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      name="phone"
                      placeholder="Enter phone number"
                      type="tel"
                      defaultValue={editingCustomer?.phone}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      placeholder="Enter email address"
                      type="email"
                      defaultValue={editingCustomer?.email}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      name="address"
                      placeholder="Enter full address"
                      rows={3}
                      defaultValue={editingCustomer?.address}
                    />
                  </div>

                  <div className="border-t pt-4 space-y-2">
                    <Label htmlFor="openingBalance">Opening Balance (₹)</Label>
                    <Input
                      id="openingBalance"
                      name="openingBalance"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      className="font-mono"
                      defaultValue={editingCustomer?.openingBalance || 0}
                    />
                    <p className="text-xs text-muted-foreground">
                      Positive = Amount receivable from customer | Negative = Advance received
                    </p>
                  </div>

                  <div className="flex gap-3 justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => handleDialogClose(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingCustomer ? 'Update Customer' : 'Add Customer'}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">Customer Name</TableHead>
                  <TableHead className="font-semibold">Phone</TableHead>
                  <TableHead className="font-semibold">Email</TableHead>
                  <TableHead className="font-semibold">Address</TableHead>
                  <TableHead className="font-semibold text-right">Opening Balance</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No customers found. Add your first customer to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.phone || '-'}</TableCell>
                      <TableCell>{customer.email || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{customer.address || '-'}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {customer.openingBalance ? `₹${customer.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(customer)}
                            className="text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <Pencil size={16} weight="bold" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(customer)}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash size={16} weight="bold" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="text-sm text-muted-foreground">
            <p className="font-medium mb-2">Total Customers: <span className="text-foreground font-semibold">{customers.length}</span></p>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Warning className="h-5 w-5 text-destructive" weight="fill" />
              Delete Customer
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{customerToDelete?.name}</strong>? This action cannot be undone and will affect all related sales invoices, payments, and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
