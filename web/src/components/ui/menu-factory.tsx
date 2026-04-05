import * as React from "react";
import { ChevronRight } from "lucide-react";

import {
  MENU_INDICATOR_CONTAINER_CLASS,
  MENU_ITEM_BASE_CLASS,
  MENU_LABEL_BASE_CLASS,
  MENU_SELECTION_ITEM_BASE_CLASS,
  MENU_SUB_TRIGGER_BASE_CLASS,
} from "@/components/ui/menu-styles";
import { cn } from "@/lib/utils";

type ElementType = React.ElementType;
type PrimitiveProps<TPrimitive extends ElementType> = React.ComponentPropsWithoutRef<TPrimitive>;
type PrimitivePropsWithRef<TPrimitive extends ElementType> = React.ComponentPropsWithRef<TPrimitive>;
type PrimitiveRef<TPrimitive extends ElementType> = React.ElementRef<TPrimitive>;

function renderPrimitive<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  props: PrimitivePropsWithRef<TPrimitive>,
) {
  return React.createElement(Primitive as React.ElementType, props);
}

function renderPortal<TPortal extends ElementType>(
  PortalPrimitive: TPortal,
  children: React.ReactNode,
) {
  return React.createElement(PortalPrimitive as React.ElementType, undefined, children);
}

function createClassedPrimitive<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  resolveClassName: (className?: string) => string,
) {
  const Component = React.forwardRef<
    PrimitiveRef<TPrimitive>,
    PrimitiveProps<TPrimitive>
  >(({ className, ...props }, ref) =>
    renderPrimitive(Primitive, {
      ...props,
      ref,
      className: resolveClassName(className),
    } as PrimitivePropsWithRef<TPrimitive>),
  );
  Component.displayName = displayName;
  return Component;
}

function createInsetPrimitive<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  baseClassName: string,
  extraClassName = "",
) {
  const Component = React.forwardRef<
    PrimitiveRef<TPrimitive>,
    PrimitiveProps<TPrimitive> & { inset?: boolean }
  >(({ className, inset, ...props }, ref) =>
    renderPrimitive(Primitive, {
      ...props,
      ref,
      className: cn(baseClassName, extraClassName, inset && "pl-8", className),
    } as PrimitivePropsWithRef<TPrimitive>),
  );
  Component.displayName = displayName;
  return Component;
}

function createSelectionItem<TPrimitive extends ElementType, TIndicator extends ElementType>(
  Primitive: TPrimitive,
  IndicatorPrimitive: TIndicator,
  displayName: string,
  extraClassName: string,
  indicator: React.ReactNode,
) {
  const Component = React.forwardRef<
    PrimitiveRef<TPrimitive>,
    PrimitiveProps<TPrimitive> & {
      children?: React.ReactNode;
      checked?: boolean;
    }
  >(({ className, children, checked, ...props }, ref) => (
    renderPrimitive(
      Primitive,
      {
        ...props,
        ref,
        className: cn(MENU_SELECTION_ITEM_BASE_CLASS, extraClassName, className),
        checked,
        children: (
          <>
            <span className={MENU_INDICATOR_CONTAINER_CLASS}>
              {renderPrimitive(IndicatorPrimitive, {
                children: indicator,
              } as PrimitivePropsWithRef<TIndicator>)}
            </span>
            {children}
          </>
        ),
      } as PrimitivePropsWithRef<TPrimitive>,
    )
  ));
  Component.displayName = displayName;
  return Component;
}

export function createMenuSubTrigger<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  stateClassName: string,
) {
  const Component = React.forwardRef<
    PrimitiveRef<TPrimitive>,
    PrimitiveProps<TPrimitive> & {
      inset?: boolean;
      children?: React.ReactNode;
    }
  >(({ className, inset, children, ...props }, ref) =>
    renderPrimitive(
      Primitive,
      {
        ...props,
        ref,
        className: cn(
          MENU_SUB_TRIGGER_BASE_CLASS,
          stateClassName,
          inset && "pl-8",
          className,
        ),
        children: (
          <>
            {children}
            <ChevronRight className="ml-auto h-4 w-4" />
          </>
        ),
      } as PrimitivePropsWithRef<TPrimitive>,
    )
  );
  Component.displayName = displayName;
  return Component;
}

export function createMenuSubContent<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  baseClassName: string,
) {
  return createClassedPrimitive(Primitive, displayName, (className) =>
    cn(baseClassName, className),
  );
}

export function createMenuContent<
  TPortal extends ElementType,
  TPrimitive extends ElementType,
>(
  PortalPrimitive: TPortal,
  Primitive: TPrimitive,
  displayName: string,
  baseClassName: string,
  defaultProps?: Partial<PrimitiveProps<TPrimitive>>,
) {
  const Component = React.forwardRef<
    PrimitiveRef<TPrimitive>,
    PrimitiveProps<TPrimitive>
  >(({ className, ...props }, ref) =>
    renderPortal(
      PortalPrimitive,
      renderPrimitive(Primitive, {
        ...defaultProps,
        ...props,
        ref,
        className: cn(baseClassName, className),
      } as PrimitivePropsWithRef<TPrimitive>),
    )
  );
  Component.displayName = displayName;
  return Component;
}

export function createMenuItem<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  extraClassName = "",
) {
  return createInsetPrimitive(
    Primitive,
    displayName,
    MENU_ITEM_BASE_CLASS,
    extraClassName,
  );
}

export function createMenuSelectionItem<
  TPrimitive extends ElementType,
  TIndicator extends ElementType,
>(
  Primitive: TPrimitive,
  IndicatorPrimitive: TIndicator,
  displayName: string,
  extraClassName = "",
  indicator: React.ReactNode,
) {
  return createSelectionItem(
    Primitive,
    IndicatorPrimitive,
    displayName,
    extraClassName,
    indicator,
  );
}

export function createMenuLabel<TPrimitive extends ElementType>(
  Primitive: TPrimitive,
  displayName: string,
  extraClassName = "",
) {
  return createInsetPrimitive(
    Primitive,
    displayName,
    MENU_LABEL_BASE_CLASS,
    extraClassName,
  );
}

export const createMenuSeparator = createMenuSubContent;

export function createMenuShortcut(
  displayName: string,
  baseClassName: string,
) {
  const Component = ({
    className,
    ...props
  }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span className={cn(baseClassName, className)} {...props} />
  );
  Component.displayName = displayName;
  return Component;
}
