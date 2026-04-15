import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/utils/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-normal break-words text-center leading-snug rounded-sm text-base font-mono font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary/30 shadow-sm hover:shadow-md hover:-translate-y-px",
        destructive:
          "border border-rose-500/35 bg-rose-500/10 text-rose-700 shadow-sm hover:-translate-y-px hover:border-rose-500/55 hover:bg-rose-500/15 hover:text-rose-800 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-500/12 dark:text-rose-200 dark:hover:bg-rose-500/18 dark:hover:text-rose-100",
        outline:
          "border border-border bg-transparent shadow-sm hover:bg-muted hover:shadow-md",
        secondary:
          "bg-accent text-accent-foreground border border-accent/30 shadow-sm hover:shadow-md hover:-translate-y-px",
        ghost: "border border-transparent hover:bg-muted hover:border-border",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2.5",
        sm: "h-9 rounded-sm px-4 text-sm",
        lg: "h-13 rounded-sm px-8 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
