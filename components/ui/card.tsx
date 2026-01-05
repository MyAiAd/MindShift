import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { selectionFeedback } from "@/lib/haptics"

const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground shadow",
  {
    variants: {
      variant: {
        default: "",
        compact: "",
        // Glass variants - activated when .glass-enabled is on <html>
        glass: "glass-full bg-card/80",
        glassSubtle: "glass-subtle bg-card/90",
        glassStrong: "glass-strong bg-card/70",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  swipeThreshold?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, onSwipeLeft, onSwipeRight, swipeThreshold = 100, ...props }, ref) => {
    const [touchStart, setTouchStart] = React.useState<number | null>(null);
    const [touchEnd, setTouchEnd] = React.useState<number | null>(null);

    // Minimum swipe distance to trigger action
    const minSwipeDistance = swipeThreshold;

    const onTouchStart = (e: React.TouchEvent) => {
      setTouchEnd(null);
      setTouchStart(e.targetTouches[0].clientX);
    };

    const onTouchMove = (e: React.TouchEvent) => {
      setTouchEnd(e.targetTouches[0].clientX);
    };

    const onTouchEnd = () => {
      if (!touchStart || !touchEnd) return;
      
      const distance = touchStart - touchEnd;
      const isLeftSwipe = distance > minSwipeDistance;
      const isRightSwipe = distance < -minSwipeDistance;

      if (isLeftSwipe && onSwipeLeft) {
        selectionFeedback();
        onSwipeLeft();
      }
      if (isRightSwipe && onSwipeRight) {
        selectionFeedback();
        onSwipeRight();
      }
    };

    // Only add touch handlers if swipe callbacks are provided
    const touchHandlers = (onSwipeLeft || onSwipeRight) ? {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    } : {};

    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant }), className)}
        {...touchHandlers}
        {...props}
      />
    );
  }
)
Card.displayName = "Card"

const cardHeaderVariants = cva("flex flex-col space-y-1.5", {
  variants: {
    variant: {
      default: "p-6",
      compact: "p-3 sm:p-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface CardHeaderProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardHeaderVariants> {}

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardHeaderVariants({ variant }), className)}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

const cardContentVariants = cva("pt-0", {
  variants: {
    variant: {
      default: "p-6",
      compact: "p-3 sm:p-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface CardContentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardContentVariants> {}

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardContentVariants({ variant }), className)}
      {...props}
    />
  )
)
CardContent.displayName = "CardContent"

const cardFooterVariants = cva("flex items-center pt-0", {
  variants: {
    variant: {
      default: "p-6",
      compact: "p-3 sm:p-4",
    },
  },
  defaultVariants: {
    variant: "default",
  },
})

export interface CardFooterProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardFooterVariants> {}

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, variant, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(cardFooterVariants({ variant }), className)}
      {...props}
    />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
