import * as React from "react"
import { Eye, EyeOff, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export { cn }
export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
    size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
        const variants = {
            primary: "bg-brand-blue text-white hover:bg-slate-800 dark:bg-brand-teal dark:hover:bg-cyan-600 shadow-sm",
            secondary: "bg-brand-teal text-white hover:bg-cyan-500 dark:bg-cyan-600 dark:hover:bg-cyan-700 shadow-sm",
            outline: "border border-slate-200 dark:border-slate-700 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100",
            ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 text-slate-600 dark:text-slate-400",
        }

        const sizes = {
            sm: "h-9 px-3 text-xs",
            md: "h-10 px-4 py-2",
            lg: "h-12 px-8 text-lg",
        }

        return (
            <button
                className={cn(
                    "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 disabled:pointer-events-none disabled:opacity-50",
                    variants[variant],
                    sizes[size],
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

// Input Component
export interface InputProps
    extends React.InputHTMLAttributes<HTMLInputElement> { }

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    "flex h-10 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-white dark:ring-offset-slate-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 disabled:cursor-not-allowed disabled:opacity-50",
                    className
                )}
                ref={ref}
                {...props}
            />
        )
    }
)
Input.displayName = "Input"

// PasswordInput Component
export const PasswordInput = React.forwardRef<HTMLInputElement, InputProps>(
    ({ className, ...props }, ref) => {
        const [showPassword, setShowPassword] = React.useState(false)

        return (
            <div className="relative">
                <Input
                    type={showPassword ? "text" : "password"}
                    className={cn("pr-10", className)}
                    ref={ref}
                    {...props}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                    {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                    ) : (
                        <Eye className="h-4 w-4" />
                    )}
                    <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                    </span>
                </button>
            </div>
        )
    }
)
PasswordInput.displayName = "PasswordInput"

// Card Component
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-950 dark:text-slate-50 shadow-sm", className)}
            {...props}
        />
    )
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex flex-col space-y-1.5 p-6", className)}
            {...props}
        />
    )
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className, ...props }, ref) => (
        <h3
            ref={ref}
            className={cn("font-semibold leading-none tracking-tight", className)}
            {...props}
        />
    )
)
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className, ...props }, ref) => (
        <p
            ref={ref}
            className={cn("text-sm text-slate-500 dark:text-slate-400", className)}
            {...props}
        />
    )
)
CardDescription.displayName = "CardDescription"

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
    )
)
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
        <div
            ref={ref}
            className={cn("flex items-center p-6 pt-0", className)}
            {...props}
        />
    )
)
CardFooter.displayName = "CardFooter"

// Label Component
export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
    ({ className, ...props }, ref) => (
        <label
            ref={ref}
            className={cn(
                "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300",
                className
            )}
            {...props}
        />
    )
)
Label.displayName = "Label"

// Badge Component
export function Badge({ className, variant = 'default', ...props }: React.HTMLAttributes<HTMLDivElement> & { variant?: 'default' | 'success' | 'warning' | 'danger' | 'outline' | 'secondary' }) {
    const variants = {
        default: "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200",
        secondary: "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100",
        success: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
        warning: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
        danger: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
        outline: "border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400",
    }
    return (
        <div className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", variants[variant], className)} {...props} />
    )
}

// Table Components
export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
    ({ className, ...props }, ref) => (
        <div className="relative w-full overflow-auto">
            <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
        </div>
    )
)
Table.displayName = "Table"

export const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
)
TableHeader.displayName = "TableHeader"

export const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
    ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
)
TableBody.displayName = "TableBody"

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
    ({ className, ...props }, ref) => (
        <tr ref={ref} className={cn("border-b border-slate-200 dark:border-slate-700 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50 data-[state=selected]:bg-slate-100 dark:data-[state=selected]:bg-slate-800", className)} {...props} />
    )
)
TableRow.displayName = "TableRow"

export const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref) => (
        <th ref={ref} className={cn("h-12 px-4 text-left align-middle font-medium text-slate-500 dark:text-slate-400 [&:has([role=checkbox])]:pr-0", className)} {...props} />
    )
)
TableHead.displayName = "TableHead"

export const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
    ({ className, ...props }, ref) => (
        <td ref={ref} className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)} {...props} />
    )
)
TableCell.displayName = "TableCell"

// Textarea Component
export interface TextareaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ className, ...props }, ref) => {
        return (
            <textarea
                ref={ref}
                className={cn(
                    "flex min-h-[80px] w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-offset-white dark:ring-offset-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/50 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
                    className
                )}
                {...props}
            />
        )
    }
)
Textarea.displayName = "Textarea"

// --- NEW COMPONENTS ADDED FOR MODALS ---

// Dialog
export const Dialog = ({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)}>
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg border border-slate-200 dark:border-slate-800 w-full max-w-lg m-4" onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
};
export const DialogContent = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("p-6", className)}>{children}</div>;
export const DialogHeader = ({ children }: { children: React.ReactNode }) => <div className="mb-4 space-y-1">{children}</div>;
export const DialogTitle = ({ children }: { children: React.ReactNode }) => <h2 className="text-lg font-semibold">{children}</h2>;
export const DialogFooter = ({ children, className }: { children: React.ReactNode; className?: string }) => <div className={cn("flex justify-end space-x-2 mt-4", className)}>{children}</div>;

// Select
export const SimpleSelectContext = React.createContext<{ value: any; onValueChange: (value: any) => void; open: boolean; setOpen: (open: boolean) => void }>({ value: undefined, onValueChange: () => { }, open: false, setOpen: () => { } });

export const SelectRoot = ({ value, onValueChange, children }: any) => {
    const [open, setOpen] = React.useState(false);
    return <SimpleSelectContext.Provider value={{ value, onValueChange, open, setOpen }}> <div className="relative inline-block text-left w-full">{children}</div> </SimpleSelectContext.Provider>;
}
export { SelectRoot as Select };

export const SelectTriggerImpl = ({ className, children }: any) => {
    const { open, setOpen } = React.useContext(SimpleSelectContext);
    return (
        <button type="button" onClick={() => setOpen(!open)} className={cn("flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-800 dark:bg-slate-950 dark:ring-offset-slate-950 dark:placeholder:text-slate-400", className)}>
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
}
export { SelectTriggerImpl as SelectTrigger };

export const SelectValueImpl = () => {
    const { value } = React.useContext(SimpleSelectContext);
    const label = value === 'OWNER' ? 'Власник' : value === 'MEMBER' ? 'Учасник' : value === 'VIEWER' ? 'Переглядач' : value;
    return <span style={{ pointerEvents: 'none' }}>{label || "Select..."}</span>;
}
export { SelectValueImpl as SelectValue };

export const SelectContentImpl = ({ children }: any) => {
    const { open, setOpen, onValueChange } = React.useContext(SimpleSelectContext);
    if (!open) return null;
    return (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white text-slate-950 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-50">
            <div className="p-1">
                {React.Children.map(children, (child: any) => {
                    return React.cloneElement(child, {
                        onClick: (v: string) => {
                            onValueChange(v);
                            setOpen(false);
                        }
                    });
                })}
            </div>
        </div>
    );
}
export { SelectContentImpl as SelectContent };

export const SelectItem = ({ value, children, onClick }: any) => {
    return (
        <div
            className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 focus:bg-slate-100 focus:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-50 dark:focus:bg-slate-800 dark:focus:text-slate-50"
            onClick={() => onClick && onClick(value)}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
            </span>
            <span className="truncate">{children}</span>
        </div>
    );
};

// AlertDialog
export const AlertDialog = Dialog;
export const AlertDialogContent = DialogContent;
export const AlertDialogHeader = DialogHeader;
export const AlertDialogTitle = DialogTitle;
export const AlertDialogDescription = ({ children }: { children: React.ReactNode }) => <div className="text-sm text-slate-500">{children}</div>;
export const AlertDialogFooter = DialogFooter;
export const AlertDialogCancel = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => <Button variant="outline" {...props} ref={ref} />);
export const AlertDialogAction = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => <Button {...props} ref={ref} />);