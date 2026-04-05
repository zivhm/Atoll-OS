import * as React from "react";
import * as ContextMenuPrimitive from "@radix-ui/react-context-menu";
import { Check, Circle } from "lucide-react";
import {
  MENU_SEPARATOR_BORDER_CLASS,
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

const ContextMenu = ContextMenuPrimitive.Root;

const ContextMenuTrigger = ContextMenuPrimitive.Trigger;

const ContextMenuGroup = ContextMenuPrimitive.Group;

const ContextMenuPortal = ContextMenuPrimitive.Portal;

const ContextMenuSub = ContextMenuPrimitive.Sub;

const ContextMenuRadioGroup = ContextMenuPrimitive.RadioGroup;

const ContextMenuSubTrigger = createMenuSubTrigger(
  ContextMenuPrimitive.SubTrigger,
  ContextMenuPrimitive.SubTrigger.displayName,
  "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
);

const ContextMenuSubContent = createMenuSubContent(
  ContextMenuPrimitive.SubContent,
  ContextMenuPrimitive.SubContent.displayName,
  "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

const ContextMenuContent = createMenuContent(
  ContextMenuPrimitive.Portal,
  ContextMenuPrimitive.Content,
  ContextMenuPrimitive.Content.displayName,
  "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

const ContextMenuItem = createMenuItem(
  ContextMenuPrimitive.Item,
  ContextMenuPrimitive.Item.displayName,
  "focus:bg-accent focus:text-accent-foreground",
);

const ContextMenuCheckboxItem = createMenuSelectionItem(
  ContextMenuPrimitive.CheckboxItem,
  ContextMenuPrimitive.ItemIndicator,
  ContextMenuPrimitive.CheckboxItem.displayName,
  "focus:bg-accent focus:text-accent-foreground",
  <Check className="h-4 w-4" />,
);

const ContextMenuRadioItem = createMenuSelectionItem(
  ContextMenuPrimitive.RadioItem,
  ContextMenuPrimitive.ItemIndicator,
  ContextMenuPrimitive.RadioItem.displayName,
  "focus:bg-accent focus:text-accent-foreground",
  <Circle className="h-2 w-2 fill-current" />,
);

const ContextMenuLabel = createMenuLabel(
  ContextMenuPrimitive.Label,
  ContextMenuPrimitive.Label.displayName,
  "text-foreground",
);

const ContextMenuSeparator = createMenuSeparator(
  ContextMenuPrimitive.Separator,
  ContextMenuPrimitive.Separator.displayName,
  MENU_SEPARATOR_BORDER_CLASS,
);

const ContextMenuShortcut = createMenuShortcut(
  "ContextMenuShortcut",
  MENU_SHORTCUT_MUTED_CLASS,
);

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
};
