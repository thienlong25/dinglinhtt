import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, type="text", ...props }, ref) => (
  <input ref={ref} type={type} className={cn("flex w-full rounded-md border px-3 py-2 text-sm outline-none placeholder:text-slate-400", className)} {...props} />
));
Input.displayName = "Input";
