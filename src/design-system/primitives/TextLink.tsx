import React from 'react';
import Link from 'next/link';

export type TextLinkVariant = 'default' | 'action' | 'secondary' | 'neutral';

export interface TextLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  external?: boolean;
  variant?: TextLinkVariant | string;
  children: React.ReactNode;
}

export const TextLink = React.forwardRef<HTMLAnchorElement, TextLinkProps>(
  ({ href, external = false, variant = 'default', className = '', children, ...props }, ref) => {
    let colorClasses = 'text-content-link hover:underline';

    if (variant === 'secondary') {
      colorClasses = 'text-content-secondary hover:text-content-primary hover:underline';
    } else if (variant === 'neutral') {
      colorClasses = 'text-content-tertiary hover:text-content-primary hover:underline';
    } else if (variant === 'action') {
      colorClasses = 'text-action-primary hover:underline';
    }

    const base = `inline-flex items-center gap-1 font-medium transition-colors focus-visible:outline-none focus-visible:ring-(--focus-ring-width) focus-visible:ring-action-focus-ring focus-visible:ring-offset-(--focus-ring-offset) rounded-(--radius-control) ${colorClasses}`;

    if (external || href.startsWith('http')) {
      return (
        <a
          ref={ref}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${base} ${className}`}
          {...props}
        >
          {children}
        </a>
      );
    }

    return (
      <Link ref={ref} href={href} className={`${base} ${className}`} {...props}>
        {children}
      </Link>
    );
  }
);

TextLink.displayName = 'TextLink';
