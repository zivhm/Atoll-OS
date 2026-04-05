import * as React from "react";
import * as MenubarPrimitive from "@radix-ui/react-menubar";
import { Check, Circle } from "lucide-react";
import {
  MENU_SEPARATOR_MUTED_CLASS,
  MENU_SHORTCUT_MUTED_CLASS,
} from "@/components/ui/menu-styles";
import {
  createMenuContent,
  createMenuItem,
  createMenuLabel,
  createMenuSelectionItem,
  createMenuSeparator,
  createMenuShortcut,
  createMenuSubContent,
  createMenuSubTrigger,
} from "@/components/ui/menu-factory";
import { cn } from "@/lib/utils";

const MenubarMenu = MenubarPrimitive.Menu;

const MenubarGroup = MenubarPrimitive.Group;

const MenubarPortal = MenubarPrimitive.Portal;

const MenubarSub = MenubarPrimitive.Sub;

const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

const Menubar = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Root
    ref={ref}
    className={cn("flex h-10 items-center space-x-1 rounded-md border bg-background p-1", className)}
    {...props}
  />
));
Menubar.displayName = MenubarPrimitive.Root.displayName;

const MenubarTrigger = React.forwardRef<
  React.ElementRef<typeof MenubarPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof MenubarPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <MenubarPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex cursor-default select-none items-center rounded-sm px-3 py-1.5 text-sm font-medium outline-none data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
      className,
    )}
    {...props}
  />
));
MenubarTrigger.displayName = MenubarPrimitive.Trigger.displayName;

const MenubarSubTrigger = createMenuSubTrigger(
  MenubarPrimitive.SubTrigger,
  MenubarPrimitive.SubTrigger.displayName,
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
);

const MenubarSubContent = createMenuSubContent(
  MenubarPrimitive.SubContent,
  MenubarPrimitive.SubContent.displayName,
  "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

const MenubarContent = createMenuContent(
  MenubarPrimitive.Portal,
  MenubarPrimitive.Content,
  MenubarPrimitive.Content.displayName,
  "z-50 min-w-[12rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  { align: "start", alignOffset: -4, sideOffset: 8 },
);

const MenubarItem = createMenuItem(
  MenubarPrimitive.Item,
  MenubarPrimitive.Item.displayName,
  "focus:bg-accent focus:text-accent-foreground",
);

const MenubarCheckboxItem = createMenuSelectionItem(
  MenubarPrimitive.CheckboxItem,
  MenubarPrimitive.ItemIndicator,
  MenubarPrimitive.CheckboxItem.displayName,
  "focus:bg-accent focus:text-accent-foreground",
  <Check className="h-4 w-4" />,
);

const MenubarRadioItem = createMenuSelectionItem(
  MenubarPrimitive.RadioItem,
  MenubarPrimitive.ItemIndicator,
  MenubarPrimitive.RadioItem.displayName,
  "focus:bg-accent focus:text-accent-foreground",
  <Circle className="h-2 w-2 fill-current" />,
);

const MenubarLabel = createMenuLabel(
  MenubarPrimitive.Label,
  MenubarPrimitive.Label.displayName,
);

const MenubarSeparator = createMenuSeparator(
  MenubarPrimitive.Separator,
  MenubarPrimitive.Separator.displayName,
  MENU_SEPARATOR_MUTED_CLASS,
);

const MenubarShortcut = createMenuShortcut(
  "MenubarShortcut",
  MENU_SHORTCUT_MUTED_CLASS,
);

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
};
