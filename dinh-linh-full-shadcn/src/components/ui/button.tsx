import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B3EBF2]", { variants:{ variant:{ default:"bg-[#B3EBF2] text-slate-800 hover:bg-[#9fe3ec]", outline:"border border-slate-200 bg-white text-slate-700 hover:bg-slate-50" }, size:{ default:"h-10 px-4 py-2", icon:"h-10 w-10" } }, defaultVariants:{ variant:"default", size:"default" } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, ...props }, ref) => <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />);
Button.displayName = "Button";
export { Button, buttonVariants };
