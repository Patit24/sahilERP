import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'framer-motion'

interface AnimatedValueProps {
  value: number
  formatFn?: (value: number) => string
  className?: string
  duration?: number
}

export function AnimatedValue({ value, formatFn, className, duration = 0.8 }: AnimatedValueProps) {
  const spring = useSpring(value, { 
    stiffness: 100, 
    damping: 30,
    mass: 0.8
  })
  const display = useTransform(spring, (current) => 
    formatFn ? formatFn(Math.round(current)) : Math.round(current).toString()
  )

  useEffect(() => {
    spring.set(value)
  }, [value])

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ scale: [1, 1.05, 1] }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      key={value}
    >
      <motion.span>{display}</motion.span>
    </motion.div>
  )
}

interface AnimatedCardProps {
  children: React.ReactNode
  className?: string
  isUpdating?: boolean
}

export function AnimatedCard({ children, className, isUpdating }: AnimatedCardProps) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={isUpdating ? {
        scale: [1, 1.02, 1],
        boxShadow: [
          '0 1px 3px 0 rgb(0 0 0 / 0.1)',
          '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
          '0 1px 3px 0 rgb(0 0 0 / 0.1)'
        ]
      } : {}}
      transition={{ 
        duration: 0.4,
        ease: [0.4, 0, 0.2, 1]
      }}
    >
      {children}
    </motion.div>
  )
}

interface AnimatedBadgeProps {
  children: React.ReactNode
  className?: string
}

export function AnimatedBadge({ children, className }: AnimatedBadgeProps) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ 
        duration: 0.2,
        ease: "easeOut"
      }}
    >
      {children}
    </motion.div>
  )
}
