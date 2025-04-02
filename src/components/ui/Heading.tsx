
import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type HeadingLevel = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type HeadingSize = "4xl" | "3xl" | "2xl" | "xl" | "lg" | "md" | "sm" | "xs";

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  size?: HeadingSize;
  children: React.ReactNode;
}

export function Heading({
  as: Component = "h2",
  size = "xl",
  children,
  className,
  ...props
}: HeadingProps) {
  const sizeClasses = {
    "4xl": "text-5xl md:text-6xl font-extrabold tracking-tight",
    "3xl": "text-4xl md:text-5xl font-extrabold tracking-tight",
    "2xl": "text-3xl md:text-4xl font-bold tracking-tight",
    xl: "text-2xl md:text-3xl font-bold tracking-tight",
    lg: "text-xl md:text-2xl font-semibold tracking-tight",
    md: "text-lg md:text-xl font-semibold tracking-tight",
    sm: "text-base md:text-lg font-medium",
    xs: "text-sm md:text-base font-medium",
  };

  return (
    <Component
      className={cn(sizeClasses[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
}
