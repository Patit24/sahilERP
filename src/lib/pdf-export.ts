import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { 
  PendingDiscount, 
  ReceivedDiscount, 
  Supplier,
  PendingAnnualDiscount,
  PurchaseInvoice,
  SalesInvoice,
  Customer,
  Item,
  InvoiceItem
} from './types'
import { formatCurrency, formatMT } from './calculations'

function formatAmountForPDF(amount: number): string {
  const formatted = amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `Rs.${formatted}`
}

interface PDFExportOptions {
  title: string
  fy: string
  generatedDate: string
  businessName?: string
  filters?: {
    supplier?: string
    category?: string
    month?: string
  }
}

export function exportDiscountWalletPDF(
  pendingDiscounts: PendingDiscount[],
  receivedDiscounts: ReceivedDiscount[],
  suppliers: Supplier[],
  options: PDFExportOptions
) {
  const doc = new jsPDF('landscape')
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  
  const totalExpected = pendingDiscounts.reduce((sum, pd) => sum + pd.expectedAmount, 0)
  const totalReceived = receivedDiscounts.reduce((sum, rd) => sum + rd.amount, 0)
  const totalAllocated = receivedDiscounts.filter(rd => rd.status === 'Allocated').reduce((sum, rd) => sum + rd.amount, 0)
  const totalAdvance = receivedDiscounts.filter(rd => rd.status === 'Advance').reduce((sum, rd) => sum + rd.amount, 0)
  const totalPending = pendingDiscounts.reduce((sum, pd) => sum + pd.pendingAmount, 0)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Steel Trading ERP', 14, 15)
  
  doc.setFontSize(14)
  doc.text(options.title, 14, 23)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Financial Year: ${options.fy}`, 14, 30)
  doc.text(`Generated: ${options.generatedDate}`, 14, 35)
  
  let filterYPos = 40
  
  if (options.filters?.supplier && options.filters.supplier !== 'all') {
    const supplier = supplierMap.get(options.filters.supplier)
    doc.text(`Supplier: ${supplier?.name || 'Unknown'}`, 14, filterYPos)
    filterYPos += 5
  }
  
  if (options.filters?.category && options.filters.category !== 'all') {
    const categoryLabel = options.filters.category === 'paymentCD' ? 'Payment CD' : 
                         options.filters.category === 'invoiceCloseCD' ? 'Invoice Close CD' : 
                         'Fixed Scheme'
    doc.text(`Category: ${categoryLabel}`, 14, filterYPos)
    filterYPos += 5
  }
  
  if (options.filters?.month && options.filters.month !== 'All Months') {
    doc.text(`Month: ${options.filters.month}`, 14, filterYPos)
    filterYPos += 5
  }

  let yPos = filterYPos + 2

  doc.setFillColor(245, 245, 250)
  doc.rect(14, yPos, 268, 24, 'F')
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SUMMARY', 16, yPos + 5)
  
  doc.setFontSize(10)
  doc.text('Expected:', 16, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`₹${totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 16, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Received (Allocated):', 70, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`₹${totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 70, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Advance (Unallocated):', 135, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`₹${totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 135, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Pending Balance:', 200, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`₹${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, yPos + 16)

  yPos += 30

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Earned Discounts', 14, yPos)
  yPos += 2

  const pendingTableData = pendingDiscounts
    .sort((a, b) => new Date(a.earnedDate).getTime() - new Date(b.earnedDate).getTime())
    .map(pd => {
      const supplier = supplierMap.get(pd.supplierId)
      const typeLabel = pd.type === 'paymentCD' || pd.type === 'advanceCD' ? 'Payment CD' : 
                       pd.type === 'invoiceCloseCD' ? 'Invoice Close CD' : 
                       pd.type === 'annual' ? 'Annual Target' :
                       'Fixed Scheme'
      
      return [
        supplier?.name || 'Unknown',
        pd.invoiceNo || pd.schemeName || '-',
        typeLabel,
        new Date(pd.earnedDate).toLocaleDateString('en-IN'),
        formatAmountForPDF(pd.expectedAmount),
        formatAmountForPDF(pd.receivedAmount),
        formatAmountForPDF(pd.pendingAmount),
        pd.status
      ]
    })

  autoTable(doc, {
    startY: yPos,
    head: [['Supplier', 'Invoice/Scheme', 'Type', 'Earned Date', 'Expected', 'Received', 'Pending', 'Status']],
    body: pendingTableData.length > 0 ? pendingTableData : [['No earned discounts', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 50, halign: 'left' },
      1: { cellWidth: 35, halign: 'left' },
      2: { cellWidth: 32, halign: 'left' },
      3: { cellWidth: 28, halign: 'center' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 38, halign: 'center' }
    },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Received Discounts', 14, finalY)

  const receivedTableData = receivedDiscounts
    .sort((a, b) => new Date(b.discountReceivedDate).getTime() - new Date(a.discountReceivedDate).getTime())
    .map(rd => {
      const supplier = supplierMap.get(rd.supplierId)
      
      return [
        supplier?.name || 'Unknown',
        new Date(rd.discountReceivedDate).toLocaleDateString('en-IN'),
        rd.notes || '-',
        rd.amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        rd.status
      ]
    })

  autoTable(doc, {
    startY: finalY + 2,
    head: [['Supplier', 'Received Date', 'Notes', 'Amount', 'Status']],
    body: receivedTableData.length > 0 ? receivedTableData : [['No received discounts', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 100, halign: 'left' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 32, halign: 'center' }
    },
    margin: { left: 14, right: 14 },
  })

  const fileName = `Discount_Wallet_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

export function exportAnnualDiscountPDF(
  pendingAnnual: PendingAnnualDiscount[],
  receivedDiscounts: ReceivedDiscount[],
  suppliers: Supplier[],
  options: PDFExportOptions
) {
  const doc = new jsPDF('landscape')
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  
  const totalExpected = pendingAnnual.reduce((sum, pd) => sum + pd.expectedAmount, 0)
  const totalReceived = receivedDiscounts.reduce((sum, rd) => sum + rd.amount, 0)
  const totalAllocated = receivedDiscounts.filter(rd => rd.status === 'Allocated').reduce((sum, rd) => sum + rd.amount, 0)
  const totalAdvance = receivedDiscounts.filter(rd => rd.status === 'Advance').reduce((sum, rd) => sum + rd.amount, 0)
  const totalPending = pendingAnnual.reduce((sum, pd) => sum + pd.pendingAmount, 0)

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(options.businessName || 'Steel Trading ERP', 14, 15)
  
  doc.setFontSize(14)
  doc.text(options.title, 14, 23)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Financial Year: ${options.fy}`, 14, 30)
  doc.text(`Generated: ${options.generatedDate}`, 14, 35)
  
  let filterYPos = 40
  
  if (options.filters?.supplier && options.filters.supplier !== 'all') {
    const supplier = supplierMap.get(options.filters.supplier)
    doc.text(`Supplier: ${supplier?.name || 'Unknown'}`, 14, filterYPos)
    filterYPos += 5
  }
  
  if (options.filters?.month && options.filters.month !== 'All Months') {
    doc.text(`Month: ${options.filters.month}`, 14, filterYPos)
    filterYPos += 5
  }

  const yPos = filterYPos + 2

  doc.setFillColor(245, 245, 250)
  doc.rect(14, yPos, 268, 24, 'F')
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SUMMARY', 16, yPos + 5)
  
  doc.setFontSize(10)
  doc.text('Expected:', 16, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs.${totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 16, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Received (Allocated):', 70, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs.${totalAllocated.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 70, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Advance (Unallocated):', 135, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs.${totalAdvance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 135, yPos + 16)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Pending Balance:', 200, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs.${totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 200, yPos + 16)

  let tableYPos = yPos + 30

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Earned Annual Discounts', 14, tableYPos)
  tableYPos += 2

  const pendingTableData = pendingAnnual
    .map(pd => [
      pd.supplierName,
      `${pd.targetMT.toFixed(2)} MT`,
      `${pd.achievedMT.toFixed(2)} MT`,
      pd.ratePerMT.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      pd.expectedAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      pd.receivedAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      pd.pendingAmount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
      pd.status
    ])

  autoTable(doc, {
    startY: tableYPos,
    head: [['Supplier', 'Target MT', 'Achieved MT', 'Rate per MT', 'Expected', 'Received', 'Pending', 'Status']],
    body: pendingTableData.length > 0 ? pendingTableData : [['No earned annual discounts', '', '', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left' },
      1: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      2: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
      7: { cellWidth: 40, halign: 'center' }
    },
    margin: { left: 14, right: 14 },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 10

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Received Annual Discounts', 14, finalY)

  const receivedTableData = receivedDiscounts
    .sort((a, b) => new Date(b.discountReceivedDate).getTime() - new Date(a.discountReceivedDate).getTime())
    .map(rd => {
      const supplier = supplierMap.get(rd.supplierId)
      
      return [
        supplier?.name || 'Unknown',
        new Date(rd.discountReceivedDate).toLocaleDateString('en-IN'),
        rd.notes || '-',
        rd.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
        rd.status
      ]
    })

  autoTable(doc, {
    startY: finalY + 2,
    head: [['Supplier', 'Received Date', 'Notes', 'Amount', 'Status']],
    body: receivedTableData.length > 0 ? receivedTableData : [['No received annual discounts', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 55, halign: 'left' },
      1: { cellWidth: 35, halign: 'center' },
      2: { cellWidth: 100, halign: 'left' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 32, halign: 'center' }
    },
    margin: { left: 14, right: 14 },
  })

  const fileName = `Annual_Discount_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

export function exportPendingStatementPDF(
  type: 'wallet' | 'annual',
  pendingDiscounts: any[],
  suppliers: Supplier[],
  options: PDFExportOptions
) {
  const doc = new jsPDF('landscape')
  const supplierMap = new Map(suppliers.map(s => [s.id, s]))
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(options.businessName || 'Steel Trading ERP', 14, 15)
  
  doc.setFontSize(14)
  doc.text(options.title, 14, 23)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Financial Year: ${options.fy}`, 14, 30)
  doc.text(`Generated: ${options.generatedDate}`, 14, 35)
  
  let filterYPos = 42

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('FILTERS APPLIED:', 14, filterYPos)
  filterYPos += 5
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  
  if (options.filters?.supplier && options.filters.supplier !== 'all') {
    const supplier = supplierMap.get(options.filters.supplier)
    doc.text(`• Supplier: ${supplier?.name || 'Unknown'}`, 16, filterYPos)
    filterYPos += 5
  } else {
    doc.text(`• Supplier: All Suppliers`, 16, filterYPos)
    filterYPos += 5
  }
  
  if (options.filters?.category && options.filters.category !== 'All') {
    doc.text(`• Discount Type: ${options.filters.category}`, 16, filterYPos)
    filterYPos += 5
  } else {
    doc.text(`• Discount Type: All Types`, 16, filterYPos)
    filterYPos += 5
  }
  
  if (options.filters?.month && options.filters.month !== 'All Months') {
    doc.text(`• Month: ${options.filters.month}`, 16, filterYPos)
    filterYPos += 5
  } else {
    doc.text(`• Month: All Months`, 16, filterYPos)
    filterYPos += 5
  }

  const yPos = filterYPos + 2

  if (type === 'wallet') {
    const walletPending = pendingDiscounts
    const totalExpected = walletPending.reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)
    const totalReceived = walletPending.reduce((sum: number, pd: any) => sum + pd.receivedAmount, 0)
    const totalPending = walletPending.reduce((sum: number, pd: any) => sum + pd.pendingAmount, 0)

    const paymentCDExpected = walletPending.filter((pd: any) => pd.type === 'paymentCD').reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)
    const invoiceCloseCDExpected = walletPending.filter((pd: any) => pd.type === 'invoiceCloseCD').reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)
    const fixedSchemeExpected = walletPending.filter((pd: any) => pd.type === 'fixedScheme').reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)
    const annualExpected = walletPending.filter((pd: any) => pd.type === 'annual').reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)

    doc.setFillColor(240, 248, 255)
    doc.rect(14, yPos, 268, 18, 'F')
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Expected:', 16, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 16, yPos + 12)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Received:', 85, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 85, yPos + 12)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Pending:', 155, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 155, yPos + 12)

    let breakdownYPos = yPos + 22

    if (paymentCDExpected > 0 || invoiceCloseCDExpected > 0 || fixedSchemeExpected > 0 || annualExpected > 0) {
      doc.setFillColor(250, 250, 252)
      doc.rect(14, breakdownYPos, 268, 20, 'F')
      
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text('BREAKDOWN BY TYPE:', 16, breakdownYPos + 5)
      
      doc.setFontSize(7)
      let xPos = 16
      
      if (paymentCDExpected > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Rs ' + paymentCDExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, breakdownYPos + 10)
        xPos += 56
      }
      
      if (invoiceCloseCDExpected > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Rs ' + invoiceCloseCDExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, breakdownYPos + 10)
        xPos += 56
      }
      
      if (fixedSchemeExpected > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Rs ' + fixedSchemeExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, breakdownYPos + 10)
        xPos += 56
      }
      
      if (annualExpected > 0) {
        doc.setFont('helvetica', 'bold')
        doc.text('Rs ' + annualExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), xPos, breakdownYPos + 10)
      }
      
      breakdownYPos += 24
    }

    const tableData = walletPending
      .sort((a: any, b: any) => new Date(a.earnedDate).getTime() - new Date(b.earnedDate).getTime())
      .map((pd: any) => {
        const supplier = supplierMap.get(pd.supplierId)
        
        return [
          supplier?.name || 'Unknown',
          pd.schemeName || '-',
          pd.invoiceCount ? `${pd.invoiceCount}` : '-',
          pd.expectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          pd.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          pd.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
          pd.status || '-'
        ]
      })

    autoTable(doc, {
      startY: breakdownYPos,
      head: [['Supplier', 'Scheme Name', 'Invoices', 'Expected', 'Received', 'Pending', 'Status']],
      body: tableData.length > 0 ? tableData : [['No earned discounts', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 55, halign: 'left' },
        1: { cellWidth: 50, halign: 'left' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 38, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 38, halign: 'right', fontStyle: 'bold', fillColor: [255, 250, 230] },
        6: { cellWidth: 38, halign: 'center' }
      },
      margin: { left: 14, right: 14 },
    })
  } else {
    const annualPending = pendingDiscounts
    const totalExpected = annualPending.reduce((sum: number, pd: any) => sum + pd.expectedAmount, 0)
    const totalReceived = annualPending.reduce((sum: number, pd: any) => sum + pd.receivedAmount, 0)
    const totalPending = annualPending.reduce((sum: number, pd: any) => sum + pd.pendingAmount, 0)

    doc.setFillColor(240, 248, 255)
    doc.rect(14, yPos, 268, 18, 'F')
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('Expected:', 16, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 16, yPos + 12)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Received:', 85, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalReceived.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 85, yPos + 12)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Pending:', 155, yPos + 6)
    doc.setFont('helvetica', 'normal')
    doc.text('Rs ' + totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), 155, yPos + 12)

    const tableData = annualPending
      .map((pd: any) => [
        pd.supplierName,
        formatMT(pd.targetMT || 0),
        formatMT(pd.achievedMT || 0),
        (pd.ratePerMT || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pd.expectedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pd.receivedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pd.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        pd.status || '-'
      ])

    autoTable(doc, {
      startY: yPos + 22,
      head: [['Supplier', 'Target MT', 'Achieved MT', 'Rate per MT', 'Expected', 'Received', 'Pending', 'Status']],
      body: tableData.length > 0 ? tableData : [['No earned annual discounts', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 8, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 50, halign: 'left' },
        1: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
        2: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        3: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
        4: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
        6: { cellWidth: 32, halign: 'right', fontStyle: 'bold', fillColor: [255, 250, 230] },
        7: { cellWidth: 34, halign: 'center' }
      },
      margin: { left: 14, right: 14 },
    })
  }

  const fileName = type === 'wallet' 
    ? `Earned_Discounts_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Annual_Discounts_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
  
  doc.save(fileName)
}

interface ItemPurchaseDetail {
  itemId: string
  itemName: string
  totalQuantity: number
  totalAmount: number
  avgRate: number
  invoiceCount: number
  supplierCount: number
  firstPurchaseDate: string
  lastPurchaseDate: string
}

interface ItemSalesDetail {
  itemId: string
  itemName: string
  totalQuantity: number
  totalAmount: number
  avgRate: number
  invoiceCount: number
  customerCount: number
  firstSaleDate: string
  lastSaleDate: string
}

interface ItemTransactionDetail {
  date: string
  type: 'purchase' | 'sale'
  invoiceNo: string
  partyName: string
  quantity: number
  rate: number
  amount: number
}

interface ItemReportOptions {
  type: 'purchase' | 'sale' | 'transactions'
  itemName: string
  details?: ItemPurchaseDetail[] | ItemSalesDetail[]
  transactions?: ItemTransactionDetail[]
  fy: string
  businessName?: string
}

export function exportItemReportToPDF(options: ItemReportOptions) {
  const doc = new jsPDF('landscape')
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(options.businessName || 'Steel Trading ERP', 14, 15)
  
  doc.setFontSize(14)
  const title = options.type === 'purchase' ? 'Item-Wise Purchase Report' :
                options.type === 'sale' ? 'Item-Wise Sales Report' :
                'Item Transaction History'
  doc.text(title, 14, 23)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Financial Year: ${options.fy}`, 14, 30)
  doc.text(`Item: ${options.itemName}`, 14, 35)
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 40)

  let yPos = 47

  if (options.type === 'purchase' && options.details) {
    const purchaseDetails = options.details as ItemPurchaseDetail[]
    const totalQty = purchaseDetails.reduce((sum, d) => sum + d.totalQuantity, 0)
    const totalAmt = purchaseDetails.reduce((sum, d) => sum + d.totalAmount, 0)

    doc.setFillColor(245, 245, 250)
    doc.rect(14, yPos, 268, 18, 'F')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMMARY', 16, yPos + 5)
    
    doc.setFontSize(10)
    doc.text('Total Quantity:', 16, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(totalQty), 16, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total Amount:', 70, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatCurrency(totalAmt), 70, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Avg Rate:', 135, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(totalQty > 0 ? formatCurrency(totalAmt / totalQty) + ' per MT' : '-', 135, yPos + 15)

    const tableData = purchaseDetails.map(d => [
      d.itemName,
      formatMT(d.totalQuantity),
      formatCurrency(d.totalAmount),
      formatCurrency(d.avgRate) + ' per MT',
      d.invoiceCount.toString(),
      d.supplierCount.toString(),
      new Date(d.firstPurchaseDate).toLocaleDateString('en-IN'),
      new Date(d.lastPurchaseDate).toLocaleDateString('en-IN')
    ])

    autoTable(doc, {
      startY: yPos + 22,
      head: [['Item', 'Quantity (MT)', 'Amount', 'Avg Rate', 'Invoices', 'Suppliers', 'First Purchase', 'Last Purchase']],
      body: tableData.length > 0 ? tableData : [['No purchase data', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })
  } else if (options.type === 'sale' && options.details) {
    const salesDetails = options.details as ItemSalesDetail[]
    const totalQty = salesDetails.reduce((sum, d) => sum + d.totalQuantity, 0)
    const totalAmt = salesDetails.reduce((sum, d) => sum + d.totalAmount, 0)

    doc.setFillColor(245, 245, 250)
    doc.rect(14, yPos, 268, 18, 'F')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMMARY', 16, yPos + 5)
    
    doc.setFontSize(10)
    doc.text('Total Quantity:', 16, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(totalQty), 16, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total Amount:', 70, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatCurrency(totalAmt), 70, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Avg Rate:', 135, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(totalQty > 0 ? formatCurrency(totalAmt / totalQty) + ' per MT' : '-', 135, yPos + 15)

    const tableData = salesDetails.map(d => [
      d.itemName,
      formatMT(d.totalQuantity),
      formatCurrency(d.totalAmount),
      formatCurrency(d.avgRate) + ' per MT',
      d.invoiceCount.toString(),
      d.customerCount.toString(),
      new Date(d.firstSaleDate).toLocaleDateString('en-IN'),
      new Date(d.lastSaleDate).toLocaleDateString('en-IN')
    ])

    autoTable(doc, {
      startY: yPos + 22,
      head: [['Item', 'Quantity (MT)', 'Amount', 'Avg Rate', 'Invoices', 'Customers', 'First Sale', 'Last Sale']],
      body: tableData.length > 0 ? tableData : [['No sales data', '', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    })
  } else if (options.type === 'transactions' && options.transactions) {
    const transactions = options.transactions
    const totalQty = transactions.reduce((sum, t) => sum + t.quantity, 0)
    const totalAmt = transactions.reduce((sum, t) => sum + t.amount, 0)
    const purchaseQty = transactions.filter(t => t.type === 'purchase').reduce((sum, t) => sum + t.quantity, 0)
    const saleQty = transactions.filter(t => t.type === 'sale').reduce((sum, t) => sum + t.quantity, 0)

    doc.setFillColor(245, 245, 250)
    doc.rect(14, yPos, 268, 18, 'F')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMMARY', 16, yPos + 5)
    
    doc.setFontSize(10)
    doc.text('Purchase Qty:', 16, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(purchaseQty), 16, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Sale Qty:', 70, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMT(saleQty), 70, yPos + 15)
    
    doc.setFont('helvetica', 'bold')
    doc.text('Total Transactions:', 135, yPos + 11)
    doc.setFont('helvetica', 'normal')
    doc.text(transactions.length.toString(), 135, yPos + 15)

    const tableData = transactions.map(t => [
      new Date(t.date).toLocaleDateString('en-IN'),
      t.type === 'purchase' ? 'Purchase' : 'Sale',
      t.invoiceNo,
      t.partyName,
      formatMT(t.quantity),
      formatCurrency(t.rate) + ' per MT',
      formatCurrency(t.amount)
    ])

    autoTable(doc, {
      startY: yPos + 22,
      head: [['Date', 'Type', 'Invoice No', 'Party', 'Quantity (MT)', 'Rate', 'Amount']],
      body: tableData.length > 0 ? tableData : [['No transactions', '', '', '', '', '', '']],
      theme: 'grid',
      headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        4: { halign: 'right', fontStyle: 'bold' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: 14, right: 14 },
    })
  }

  const fileName = options.type === 'purchase' 
    ? `Item_Purchase_Report_${options.itemName.replace(/\s+/g, '_')}_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
    : options.type === 'sale'
    ? `Item_Sales_Report_${options.itemName.replace(/\s+/g, '_')}_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
    : `Item_Transactions_${options.itemName.replace(/\s+/g, '_')}_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
  
  doc.save(fileName)
}

export interface SupplierLedgerEntry {
  date: string
  description: string
  invoiceNo?: string
  debit: number
  credit: number
  balance: number
  type: 'invoice' | 'payment'
  refId: string
}

export interface SupplierLedgerExportOptions {
  supplierName: string
  fy: string
  businessName?: string
  totalDebit: number
  totalCredit: number
  closingBalance: number
  openingBalance: number
}

export function exportSupplierLedgerPDF(
  entries: SupplierLedgerEntry[],
  options: SupplierLedgerExportOptions
) {
  const doc = new jsPDF('landscape')
  
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(options.businessName || 'Steel Trading ERP', 14, 15)
  
  doc.setFontSize(14)
  doc.text('Supplier Ledger Report', 14, 23)
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`Financial Year: ${options.fy}`, 14, 30)
  doc.text(`Supplier: ${options.supplierName}`, 14, 35)
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 40)

  let yPos = 47

  doc.setFillColor(245, 245, 250)
  doc.rect(14, yPos, 268, 18, 'F')
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SUMMARY', 16, yPos + 5)
  
  doc.setFontSize(10)
  doc.text('Total Payments:', 16, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs ${options.totalDebit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, 16, yPos + 15)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Total Purchases:', 80, yPos + 11)
  doc.setFont('helvetica', 'normal')
  doc.text(`Rs ${options.totalCredit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`, 80, yPos + 15)
  
  doc.setFont('helvetica', 'bold')
  doc.text('Outstanding Balance:', 155, yPos + 11)
  doc.setFont('helvetica', 'normal')
  const balanceText = options.closingBalance > 0 
    ? `Rs ${Math.abs(options.closingBalance).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} Cr` 
    : options.closingBalance < 0 
    ? `Rs ${Math.abs(options.closingBalance).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} Dr`
    : 'Rs 0.00'
  doc.text(balanceText, 155, yPos + 15)

  yPos += 22

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Ledger Entries', 14, yPos)
  yPos += 2

  const tableData = entries.map(entry => {
    const balance = Math.abs(entry.balance)
    const balanceStr = entry.balance > 0 
      ? `${balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} Cr` 
      : entry.balance < 0 
      ? `${balance.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')} Dr`
      : '0.00'
    
    return [
      new Date(entry.date).toLocaleDateString('en-IN'),
      entry.description,
      entry.invoiceNo || '-',
      entry.debit > 0 ? entry.debit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '-',
      entry.credit > 0 ? entry.credit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '-',
      balanceStr
    ]
  })

  const totalRow = [
    { content: 'TOTAL', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
    options.totalDebit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    options.totalCredit.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','),
    balanceText.replace('Rs ', '')
  ]

  autoTable(doc, {
    startY: yPos,
    head: [['Date', 'Description', 'Invoice No', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)']],
    body: tableData.length > 0 ? [...tableData, totalRow as any] : [['No transactions', '', '', '', '', '']],
    theme: 'grid',
    headStyles: { fillColor: [64, 44, 120], fontSize: 9, fontStyle: 'bold', halign: 'center' },
    bodyStyles: { fontSize: 8, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 30, halign: 'center' },
      1: { cellWidth: 60, halign: 'left' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      4: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 52, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 14, right: 14 },
  })

  const fileName = `Supplier_Ledger_${options.supplierName.replace(/\s+/g, '_')}_${options.fy}_${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(fileName)
}

interface StyledInvoiceOptions {
  invoiceNo: string
  invoiceDate: string
  partyLabel: string
  partyName: string
  partyAddress?: string
  partyPhone?: string
  businessName: string
  state?: string
  phone?: string
  items?: InvoiceItem[]
  itemMap: Map<string, Item>
  quantityMT: number
  invoiceAmount: number
  additionalCost?: number
  additionalCostRemarks?: string
  roundOffAdjustment?: number
  paidAmount?: number
  signatureDataUrl?: string
  filePrefix: string
  footerLabel?: string
  advancePayment?: {
    paymentDate: string
    paymentAmount: number
    bookingMT?: number
    allocatedAmount: number
    remainingAdvanceAmount: number
    sourceLabel?: string
  }
}

function drawInvoiceTextBlock(doc: jsPDF, label: string, value: string, x: number, y: number, maxWidth = 48) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(45, 45, 45)
  doc.text(label.toUpperCase(), x, y)
  doc.setDrawColor(45, 45, 45)
  doc.setLineWidth(0.25)
  doc.line(x, y + 3, x + 5, y + 3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(55, 55, 55)
  doc.text(value || '-', x, y + 13, { maxWidth })
}

function addInvoiceSignature(doc: jsPDF, signatureDataUrl: string | undefined, x: number, y: number) {
  if (!signatureDataUrl) return false

  try {
    const imageType = signatureDataUrl.includes('image/jpeg') || signatureDataUrl.includes('image/jpg') ? 'JPEG' : 'PNG'
    doc.addImage(signatureDataUrl, imageType, x, y, 38, 16, undefined, 'FAST')
    return true
  } catch {
    return false
  }
}

function exportStyledInvoicePDF(options: StyledInvoiceOptions) {
  const doc = new jsPDF('portrait', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  const invoiceDate = options.invoiceDate
    ? new Date(options.invoiceDate).toLocaleDateString('en-IN')
    : '-'
  const dueDate = invoiceDate
  const paidAmount = Math.max(0, options.paidAmount || options.advancePayment?.allocatedAmount || 0)
  const amountDue = Math.max(0, options.invoiceAmount - paidAmount)

  doc.setFillColor(0, 0, 0)
  doc.rect(0, 0, pageWidth, 50, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(14)
  doc.setTextColor(255, 255, 255)
  doc.text('I N V O I C E', pageWidth / 2, 23, { align: 'center' })
  doc.setFontSize(9)
  doc.setTextColor(150, 150, 150)
  doc.text(options.businessName.toUpperCase(), pageWidth / 2, 37, { align: 'center' })
  doc.setTextColor(45, 45, 45)

  drawInvoiceTextBlock(doc, options.partyLabel, options.partyName, margin + 12, 76, 45)
  drawInvoiceTextBlock(doc, 'From', `${options.businessName}\n${options.state || ''}${options.phone ? `\nPhone: ${options.phone}` : ''}`, margin + 62, 76, 55)
  drawInvoiceTextBlock(doc, 'Due Date', dueDate, pageWidth - margin - 36, 76, 34)

  const partyDetails = [
    options.partyAddress ? `Address: ${options.partyAddress}` : '',
    options.partyPhone ? `Phone: ${options.partyPhone}` : '',
    `Invoice No: ${options.invoiceNo}`,
    `Invoice Date: ${invoiceDate}`
  ].filter(Boolean).join('   |   ')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(95, 95, 95)
  doc.text(partyDetails, margin + 12, 101, { maxWidth: contentWidth - 24 })

  const rows = (options.items || []).map((line, index) => {
    const item = options.itemMap.get(line.itemId)
    return [
      `${index + 1}. ${item?.name || 'Unknown item'}`,
      item?.description || `${item?.unit || 'MT'} material`,
      formatMT(line.quantityMT),
      formatAmountForPDF(line.amount).replace('Rs.', '')
    ]
  })

  autoTable(doc, {
    startY: 112,
    head: [['ITEM', 'DESCRIPTION', 'QTY', 'TOTAL']],
    body: rows.length > 0 ? rows : [['-', 'No items', '-', '-']],
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [35, 35, 35],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 8,
      cellPadding: { top: 5, bottom: 5, left: 6, right: 6 }
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [55, 55, 55],
      minCellHeight: 14,
      cellPadding: { top: 5, bottom: 5, left: 6, right: 6 }
    },
    columnStyles: {
      0: { cellWidth: 42, halign: 'left' },
      1: { cellWidth: 72, halign: 'left' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 36, halign: 'center', fontStyle: 'bold' }
    },
    margin: { left: margin + 8, right: margin + 8 }
  })

  doc.setDrawColor(45, 45, 45)
  doc.setLineWidth(0.35)
  doc.rect(margin, 108, contentWidth, 82)
  doc.line(margin, 124, pageWidth - margin, 124)

  const summaryY = Math.max((doc as any).lastAutoTable?.finalY || 190, 196)
  const leftY = summaryY + 8
  doc.setTextColor(45, 45, 45)
  drawInvoiceTextBlock(doc, 'Phone', options.phone || '-', margin + 12, leftY, 44)
  drawInvoiceTextBlock(doc, 'Web', 'sktraders.local', margin + 62, leftY, 52)

  const totalsX = pageWidth - margin - 70
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Subtotal', totalsX + 34, summaryY + 10, { align: 'right' })
  doc.text(formatAmountForPDF(options.invoiceAmount - (options.additionalCost || 0)).replace('Rs.', ''), totalsX + 62, summaryY + 10, { align: 'right' })

  if (options.additionalCost) {
    doc.text(options.additionalCostRemarks || 'Additional', totalsX + 34, summaryY + 17, { align: 'right' })
    doc.text(formatAmountForPDF(options.additionalCost).replace('Rs.', ''), totalsX + 62, summaryY + 17, { align: 'right' })
  }

  if (options.roundOffAdjustment) {
    doc.text('Round off', totalsX + 34, summaryY + 24, { align: 'right' })
    doc.text(formatAmountForPDF(options.roundOffAdjustment).replace('Rs.', ''), totalsX + 62, summaryY + 24, { align: 'right' })
  }

  if (paidAmount > 0) {
    doc.text('Deposit (paid)', totalsX + 34, summaryY + 31, { align: 'right' })
    doc.text(`-${formatAmountForPDF(paidAmount).replace('Rs.', '')}`, totalsX + 62, summaryY + 31, { align: 'right' })
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('TOTAL QTY', totalsX + 34, summaryY + 44, { align: 'right' })
  doc.text(formatMT(options.quantityMT), totalsX + 62, summaryY + 44, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('AMOUNT DUE', totalsX + 34, summaryY + 55, { align: 'right' })
  doc.text(formatAmountForPDF(amountDue).replace('Rs.', ''), totalsX + 62, summaryY + 55, { align: 'right' })

  const signatureAdded = addInvoiceSignature(doc, options.signatureDataUrl, margin + 12, leftY + 38)
  if (!signatureAdded) {
    doc.setFont('times', 'italic')
    doc.setFontSize(21)
    doc.setTextColor(15, 15, 15)
    doc.text('Thank you!', margin + 12, leftY + 50)
  } else {
    doc.setFont('times', 'italic')
    doc.setFontSize(16)
    doc.text('Thank you!', margin + 12, leftY + 62)
  }

  if (options.advancePayment) {
    const advanceY = Math.min(leftY + 72, pageHeight - 34)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(85, 85, 85)
    doc.text(
      `Advance: ${formatAmountForPDF(options.advancePayment.paymentAmount)} | Booking: ${options.advancePayment.bookingMT ? formatMT(options.advancePayment.bookingMT) : '-'} | Allocated: ${formatAmountForPDF(options.advancePayment.allocatedAmount)} | Remaining: ${formatAmountForPDF(options.advancePayment.remainingAdvanceAmount)}`,
      margin + 12,
      advanceY,
      { maxWidth: contentWidth - 24 }
    )
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(130, 130, 130)
  doc.text(options.footerLabel || 'Generated from SK TRADERS ERP', pageWidth / 2, 286, { align: 'center' })

  const safeInvoiceNo = options.invoiceNo.replace(/[^a-z0-9_-]+/gi, '_')
  doc.save(`${options.filePrefix}_${safeInvoiceNo}.pdf`)
}

export function exportPurchaseInvoicePDF(
  invoice: PurchaseInvoice,
  supplier: Supplier | undefined,
  itemMap: Map<string, Item>,
  options: {
    businessName: string
    state?: string
    phone?: string
    signatureDataUrl?: string
    paidAmount?: number
    advancePayment?: {
      paymentDate: string
      paymentAmount: number
      bookingMT?: number
      allocatedAmount: number
      remainingAdvanceAmount: number
      sourceLabel?: string
    }
  }
) {
  exportStyledInvoicePDF({
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    partyLabel: 'Bill From',
    partyName: supplier?.name || 'Unknown Supplier',
    partyAddress: supplier?.address,
    partyPhone: supplier?.phone,
    businessName: options.businessName || 'SK TRADERS',
    state: options.state,
    phone: options.phone,
    items: invoice.items,
    itemMap,
    quantityMT: invoice.quantityMT,
    invoiceAmount: invoice.invoiceAmount,
    additionalCost: invoice.additionalCost,
    additionalCostRemarks: invoice.additionalCostRemarks,
    roundOffAdjustment: invoice.roundOffAdjustment,
    paidAmount: options.paidAmount,
    signatureDataUrl: options.signatureDataUrl || invoice.signatureDataUrl,
    filePrefix: 'Purchase_Invoice',
    advancePayment: options.advancePayment
  })
}

export function exportSalesInvoicePDF(
  invoice: SalesInvoice,
  customer: Customer | undefined,
  itemMap: Map<string, Item>,
  options: {
    businessName: string
    state?: string
    phone?: string
    signatureDataUrl?: string
    paidAmount?: number
  }
) {
  exportStyledInvoicePDF({
    invoiceNo: invoice.invoiceNo,
    invoiceDate: invoice.invoiceDate,
    partyLabel: 'Bill To',
    partyName: customer?.name || 'Unknown Customer',
    partyAddress: customer?.address,
    partyPhone: customer?.phone,
    businessName: options.businessName || 'SK TRADERS',
    state: options.state,
    phone: options.phone,
    items: invoice.items,
    itemMap,
    quantityMT: invoice.quantityMT,
    invoiceAmount: invoice.invoiceAmount,
    additionalCost: invoice.additionalCost,
    additionalCostRemarks: invoice.additionalCostRemarks,
    roundOffAdjustment: invoice.roundOffAdjustment,
    paidAmount: options.paidAmount,
    signatureDataUrl: options.signatureDataUrl || invoice.signatureDataUrl,
    filePrefix: 'Sales_Invoice'
  })
}
