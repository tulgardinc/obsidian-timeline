// Type declarations for undocumented Obsidian APIs
// These are internal APIs that work but aren't officially supported

import { type Menu } from "obsidian";

declare module "obsidian" {
  interface WorkspaceLeaf {
    /**
     * Undocumented/internal API to refresh the leaf tab header
     * (icon, title) after programmatic changes.
     */
    updateHeader(): void;
  }

  interface MenuItem {
    /**
     * Undocumented/internal API for creating submenus
     * @returns A new Menu instance for the submenu
     */
    setSubmenu(): Menu;
    
    /**
     * Internal DOM element reference
     */
    dom?: HTMLElement;
  }
}
