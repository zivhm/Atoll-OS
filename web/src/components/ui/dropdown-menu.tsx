import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check, Circle } from "lucide-react";
import {
  MENU_SEPARATOR_MUTED_CLASS,
  MENU_SHORTCUT_SUBTLE_CLASS,
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

const DropdownMenu = DropdownMenuPrimitive.Root;

const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = createMenuSubTrigger(
  DropdownMenuPrimitive.SubTrigger,
  DropdownMenuPrimitive.SubTrigger.displayName,
  "data-[state=open]:bg-accent focus:bg-accent",
);

const DropdownMenuSubContent = createMenuSubContent(
  DropdownMenuPrimitive.SubContent,
  DropdownMenuPrimitive.SubContent.displayName,
  "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
);

const DropdownMenuContent = createMenuContent(
  DropdownMenuPrimitive.Portal,
  DropdownMenuPrimitive.Content,
  DropdownMenuPrimitive.Content.displayName,
  "z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  { sideOffset: 4 },
);

const DropdownMenuItem = createMenuItem(
  DropdownMenuPrimitive.Item,
  DropdownMenuPrimitive.Item.displayName,
  "transition-colors focus:bg-accent focus:text-accent-foreground",
);

const DropdownMenuCheckboxItem = createMenuSelectionItem(
  DropdownMenuPrimitive.CheckboxItem,
  DropdownMenuPrimitive.ItemIndicator,
  DropdownMenuPrimitive.CheckboxItem.displayName,
  "transition-colors focus:bg-accent focus:text-accent-foreground",
  <Check className="h-4 w-4" />,
);

const DropdownMenuRadioItem = createMenuSelectionItem(
  DropdownMenuPrimitive.RadioItem,
  DropdownMenuPrimitive.ItemIndicator,
  DropdownMenuPrimitive.RadioItem.displayName,
  "transition-colors focus:bg-accent focus:text-accent-foreground",
  <Circle className="h-2 w-2 fill-current" />,
);

const DropdownMenuLabel = createMenuLabel(
  DropdownMenuPrimitive.Label,
  DropdownMenuPrimitive.Label.displayName,
);

const DropdownMenuSeparator = createMenuSeparator(
  DropdownMenuPrimitive.Separator,
  DropdownMenuPrimitive.Separator.displayName,
  MENU_SEPARATOR_MUTED_CLASS,
);

const DropdownMenuShortcut = createMenuShortcut(
  "DropdownMenuShortcut",
  MENU_SHORTCUT_SUBTLE_CLASS,
);

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
