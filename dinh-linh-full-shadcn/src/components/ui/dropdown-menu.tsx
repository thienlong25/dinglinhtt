import * as React from "react";
import * as D from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
const DropdownMenu = D.Root; const DropdownMenuTrigger = D.Trigger;
const DropdownMenuContent = React.forwardRef<React.ElementRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content>>(({ className, sideOffset = 8, ...props }, ref) => <D.Portal><D.Content ref={ref} sideOffset={sideOffset} className={cn("z-50 min-w-[12rem] rounded-2xl border border-slate-200 bg-white p-1 shadow-lg", className)} {...props} /></D.Portal>);
const DropdownMenuItem = React.forwardRef<React.ElementRef<typeof D.Item>, React.ComponentPropsWithoutRef<typeof D.Item>>(({ className, ...props }, ref) => <D.Item ref={ref} className={cn("relative flex cursor-default select-none items-center rounded-xl px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-50 focus:bg-slate-50", className)} {...props} />);
export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
