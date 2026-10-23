import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_10px_30px_-10px_var(--primary)] hover:brightness-110",
  outline: "border border-white/15 bg-white/5 backdrop-blur hover:border-white/30 hover:bg-white/10",
  ghost: "hover:bg-white/10",
};

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-12 px-6 text-sm",
  lg: "h-13 px-8 text-base",
  icon: "size-10",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: { variant?: keyof typeof variants; size?: keyof typeof sizes; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition duration-200 active:scale-[0.98]",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    "disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

type ButtonProps = React.ComponentProps<"button"> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  /** Shows a spinner and blocks clicks while an action is in flight. */
  loading?: boolean;
};

export function Button({ variant, size, className, type = "button", loading, disabled, children, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
