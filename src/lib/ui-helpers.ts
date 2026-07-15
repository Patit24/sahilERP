export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  const lowerStatus = status.toLowerCase()
  
  if (lowerStatus.includes('pending') || lowerStatus.includes('partially')) {
    return 'outline'
  }
  
  if (lowerStatus.includes('received') || lowerStatus.includes('paid') || lowerStatus.includes('closed')) {
    return 'default'
  }
  
  if (lowerStatus.includes('advance') || lowerStatus.includes('unallocated')) {
    return 'secondary'
  }
  
  return 'outline'
}

export function getStatusBadgeClass(status: string): string {
  const lowerStatus = status.toLowerCase()
  
  if (lowerStatus.includes('pending') || lowerStatus.includes('partially')) {
    return 'border-warning/50 text-warning-foreground bg-warning/10'
  }
  
  if (lowerStatus.includes('received') || lowerStatus.includes('paid') || lowerStatus.includes('closed')) {
    return 'border-success/50 text-success-foreground bg-success/10'
  }
  
  if (lowerStatus.includes('advance') || lowerStatus.includes('unallocated')) {
    return 'border-muted-foreground/30 text-muted-foreground bg-muted'
  }
  
  return 'border-border text-foreground bg-background'
}
