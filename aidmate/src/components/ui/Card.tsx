import React, { forwardRef } from 'react';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'interactive';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  children?: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white border border-slate-100/90 shadow-[0_2px_12px_-2px_rgba(26,29,62,0.06)]',
  elevated: 'bg-white border border-slate-100 shadow-[0_12px_32px_-4px_rgba(26,29,62,0.1)]',
  outlined: 'bg-white border border-slate-200 shadow-none',
  interactive:
    'bg-white border border-slate-200/80 shadow-[0_2px_12px_-2px_rgba(26,29,62,0.06)] hover:shadow-[0_12px_28px_-4px_rgba(26,29,62,0.12)] hover:-translate-y-0.5 hover:border-[#FF6B4A]/40 active:translate-y-0 active:scale-[0.99] cursor-pointer transition-all duration-200',
};

const paddingStyles: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3 sm:p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const CardBase = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      className = '',
      children,
      onClick,
      ...rest
    },
    ref
  ) => {
    const isInteractive = variant === 'interactive' || Boolean(onClick);

    return (
      <div
        ref={ref}
        onClick={onClick}
        role={isInteractive ? 'button' : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={
          isInteractive && onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        className={`
          rounded-2xl overflow-hidden
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${className}
        `.trim()}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

CardBase.displayName = 'Card';

export interface CardHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  action,
  className = '',
  children,
  ...rest
}) => {
  if (children) {
    return (
      <div className={`mb-4 ${className}`} {...rest}>
        {children}
      </div>
    );
  }

  return (
    <div className={`flex items-start justify-between gap-4 mb-4 ${className}`} {...rest}>
      <div>
        {title && (
          <h3 className="text-base sm:text-lg font-bold text-[#1A1D3E] tracking-tight leading-snug">
            {title}
          </h3>
        )}
        {subtitle && (
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
CardHeader.displayName = 'Card.Header';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const CardBody: React.FC<CardBodyProps> = ({ className = '', children, ...rest }) => (
  <div className={`text-[#1A1D3E] ${className}`} {...rest}>
    {children}
  </div>
);
CardBody.displayName = 'Card.Body';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

const CardFooter: React.FC<CardFooterProps> = ({ className = '', children, ...rest }) => (
  <div
    className={`mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-3 ${className}`}
    {...rest}
  >
    {children}
  </div>
);
CardFooter.displayName = 'Card.Footer';

export const Card = Object.assign(CardBase, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

export default Card;
