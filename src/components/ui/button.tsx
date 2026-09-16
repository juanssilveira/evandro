import * as React from "react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all outline-none select-none cursor-pointer disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-violet-500 to-[#7C3AED] hover:from-violet-500/95 hover:to-[#6D28D9] text-white border border-[#6D28D9] border-b-[#5B21B6] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_1px_2px_rgba(0,0,0,0.06),0_2px_0_#6D28D9] active:translate-y-[1px] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_0_#6D28D9] focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2",
        secondary:
          "bg-white hover:bg-zinc-50 text-foreground border border-zinc-200 hover:border-zinc-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:translate-y-[0.5px] active:shadow-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800",
        outline:
          "bg-white hover:bg-zinc-50 text-foreground border border-zinc-200 hover:border-zinc-300 shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:translate-y-[0.5px] active:shadow-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800",
        ghost:
          "bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-foreground/80 hover:text-foreground active:bg-zinc-200/80 focus-visible:ring-2 focus-visible:ring-primary/30",
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 hover:from-red-500/95 hover:to-red-700 text-white border border-red-700 border-b-red-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.06),0_2px_0_#991B1B] active:translate-y-[1px] active:shadow-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto font-medium shadow-none focus-visible:ring-1 focus-visible:ring-primary",
      },
      size: {
        default: "h-9 px-4 text-sm gap-2 rounded-lg [&_svg:not([class*='size-'])]:size-4",
        sm: "h-8 px-3 text-xs gap-1.5 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-5 text-sm font-semibold gap-2 rounded-lg [&_svg:not([class*='size-'])]:size-4.5",
        icon: "size-9 p-0 rounded-lg [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "size-8 p-0 rounded-lg [&_svg:not([class*='size-'])]:size-3.5",
        "icon-xs": "size-7 p-0 rounded-md [&_svg:not([class*='size-'])]:size-3",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
