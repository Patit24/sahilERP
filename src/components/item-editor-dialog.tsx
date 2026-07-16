import { useEffect, useState } from 'react'
import { Item } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CaretDown, Check, MagnifyingGlass, Package } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface ItemEditorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: Item | null
  existingItems?: Item[]
  onSave: (item: Item) => void
}

const GST_OPTIONS = [
  { label: 'None', value: 'none', rate: undefined },
  { label: 'Exempted', value: 'exempted', rate: 0 },
  { label: 'GST @ 0%', value: '0', rate: 0 },
  { label: 'GST @ 0.1%', value: '0.1', rate: 0.1 },
  { label: 'GST @ 0.25%', value: '0.25', rate: 0.25 },
  { label: 'GST @ 1.5%', value: '1.5', rate: 1.5 },
  { label: 'GST @ 3%', value: '3', rate: 3 },
  { label: 'GST @ 5%', value: '5', rate: 5 },
  { label: 'GST @ 6%', value: '6', rate: 6 },
  { label: 'GST @ 8.9%', value: '8.9', rate: 8.9 },
  { label: 'GST @ 12%', value: '12', rate: 12 },
  { label: 'GST @ 13.8%', value: '13.8', rate: 13.8 },
  { label: 'GST @ 18%', value: '18', rate: 18 },
  { label: 'GST @ 14% + cess @ 12%', value: '14-cess-12', rate: 14 },
  { label: 'GST @ 28%', value: '28', rate: 28 },
  { label: 'GST @ 28% + Cess @ 5%', value: '28-cess-5', rate: 28 },
  { label: 'GST @ 40%', value: '40', rate: 40 },
  { label: 'GST @ 28% + Cess @ 36%', value: '28-cess-36', rate: 28 },
  { label: 'GST @ 28% + Cess @ 60%', value: '28-cess-60', rate: 28 },
]

export function ItemEditorDialog({
  open,
  onOpenChange,
  item,
  existingItems = [],
  onSave
}: ItemEditorDialogProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [gstRate, setGstRate] = useState('none')
  const [gstDropdownOpen, setGstDropdownOpen] = useState(false)
  const [purchasePrice, setPurchasePrice] = useState('')
  const [salesPrice, setSalesPrice] = useState('')
  const [unit, setUnit] = useState<Item['unit']>('MT')
  const [openingStock, setOpeningStock] = useState('')

  useEffect(() => {
    if (!open) return
    setName(item?.name || '')
    setCategory(item?.category || '')
    setGstRate(typeof item?.gstRate === 'number' ? item.gstRate.toString() : 'none')
    setPurchasePrice(item?.purchasePrice?.toString() || '')
    setSalesPrice(item?.salesPrice?.toString() || '')
    setUnit(item?.unit || 'MT')
    setOpeningStock(item?.openingStock?.toString() || '')
  }, [open, item])

  const selectedGstOption = GST_OPTIONS.find((option) => option.value === gstRate) || GST_OPTIONS[0]
  const parsedGstRate = selectedGstOption.rate

  const handleSave = () => {
    const cleanName = name.trim()

    if (!cleanName) {
      toast.error('Item name is required')
      return
    }

    const duplicate = existingItems.some((candidate) => (
      candidate.id !== item?.id &&
      candidate.name.trim().toLowerCase() === cleanName.toLowerCase()
    ))

    if (duplicate) {
      toast.error('Item already exists')
      return
    }

    onSave({
      ...(item || {}),
      id: item?.id || `item-${Date.now()}`,
      name: cleanName,
      unit,
      category: category.trim() || undefined,
      purchasePrice: parseFloat(purchasePrice) || undefined,
      salesPrice: parseFloat(salesPrice) || undefined,
      gstRate: typeof parsedGstRate === 'number' && Number.isFinite(parsedGstRate) ? parsedGstRate : undefined,
      openingStock: parseFloat(openingStock) || undefined,
      openingValue: item?.openingValue
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[min(720px,calc(100vw-2rem))] max-h-[82dvh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Package size={22} className="text-primary" weight="duotone" />
            {item ? 'Edit Item' : 'Create New Item'}
          </DialogTitle>
        </DialogHeader>

        <div className="border-b border-border p-6">
          <div className="mb-4 rounded-lg bg-primary/10 px-4 py-3 text-sm font-semibold text-primary">
            Basic Details *
          </div>
          <div className="rounded-xl border border-border p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sharedItemCategory">Category</Label>
                <Input
                  id="sharedItemCategory"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Search Categories"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemName">Item Name <span className="text-destructive">*</span></Label>
                <Input
                  id="sharedItemName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="ex: TMT Bar"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemGstRate">GST Tax Rate(%)</Label>
                <Popover open={gstDropdownOpen} onOpenChange={setGstDropdownOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      id="sharedItemGstRate"
                      type="button"
                      variant="outline"
                      role="combobox"
                      aria-expanded={gstDropdownOpen}
                      className="h-11 w-full justify-between rounded-xl border-border bg-background px-3 text-left font-normal shadow-sm hover:bg-background"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <MagnifyingGlass size={18} className="shrink-0 text-muted-foreground" />
                        <span className="truncate text-base text-foreground">{selectedGstOption.label}</span>
                      </span>
                      <CaretDown size={18} className="shrink-0 text-muted-foreground" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-xl border-border p-0 shadow-xl"
                  >
                    <Command>
                      <CommandInput placeholder="Search GST rate..." className="text-base" />
                      <CommandList className="max-h-[320px]">
                        <CommandEmpty>No GST rate found.</CommandEmpty>
                        <CommandGroup className="p-0">
                          {GST_OPTIONS.map((option) => (
                            <CommandItem
                              key={option.value}
                              value={option.label}
                              onSelect={() => {
                                setGstRate(option.value)
                                setGstDropdownOpen(false)
                              }}
                              className="rounded-none border-b border-border px-5 py-4 text-base text-muted-foreground last:border-b-0 data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground"
                            >
                              <Check
                                size={16}
                                className={cn(
                                  'mr-1 text-primary',
                                  option.value === selectedGstOption.value ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              {option.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemPurchasePrice">Purchase Price</Label>
                <Input
                  id="sharedItemPurchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(event) => setPurchasePrice(event.target.value)}
                  placeholder="ex: ₹200"
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemSalesPrice">Sales Price</Label>
                <Input
                  id="sharedItemSalesPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={salesPrice}
                  onChange={(event) => setSalesPrice(event.target.value)}
                  placeholder="ex: ₹250"
                  className="h-11 font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemUnit">Measuring Unit</Label>
                <Select value={unit} onValueChange={(value) => setUnit(value as Item['unit'])}>
                  <SelectTrigger id="sharedItemUnit" className="h-11">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PCS">Pieces(PCS)</SelectItem>
                    <SelectItem value="MT">Metric Ton(MT)</SelectItem>
                    <SelectItem value="KG">Kilogram(KG)</SelectItem>
                    <SelectItem value="TON">Ton(TON)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sharedItemOpeningStock">Opening Stock</Label>
                <Input
                  id="sharedItemOpeningStock"
                  type="number"
                  step="0.001"
                  min="0"
                  value={openingStock}
                  onChange={(event) => setOpeningStock(event.target.value)}
                  placeholder={`ex: 150 ${unit}`}
                  className="h-11 font-mono"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            {item ? 'Update Item' : 'Save Item'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
