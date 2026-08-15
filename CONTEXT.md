# Pop COSMIC Suite

Modernized, self-contained Pop!_OS desktop experience suite for GNOME Shell 48, featuring refactored extensions, visual themes, and a standalone settings application built with Libadwaita.

## Language

**Pop COSMIC Suite**:
The integrated, self-contained collection of GNOME Shell extensions, Pop Launcher, visual themes, and the Pop Settings app designed to deliver the complete Pop!_OS workflow on GNOME 48 without external extension dependencies. Wallpapers are optional companion assets rather than part of the core suite.
_Avoid_: COSMIC Desktop, Rust COSMIC, Pure Pop OS

**Pop Settings**:
A standalone Python and Libadwaita application for centralized management of all desktop, workspace, tiling, dock, and appearance settings of the suite.
_Avoid_: gnome-control-center, desktop-widget, native settings panel

**pop-cosmic**:
GNOME Shell extension refactored to ESM providing top bar buttons (Workspaces and Applications), the searchable application drawer, and Super key interception.
_Avoid_: cosmic-dock, pop panel

**cosmic-workspaces**:
GNOME Shell extension refactored to ESM providing vertical workspace thumbnails and overview navigation.
_Avoid_: gnome-workspaces, workspace-matrix

**pop-shell**:
Integrated tiling window manager extension embedded directly into the suite to provide automatic window snapping, tiling grids, and window management shortcuts.
_Avoid_: external tiling dependency, uncoordinated tiling

**Pop Launcher**:
Search service and plugin collection used by pop-shell to find and launch applications, files, commands, and other desktop results.
_Avoid_: application drawer, GNOME overview search

**Extension Status Banner**:
Reusable Libadwaita UI component that listens to D-Bus lifecycle status events from GNOME Shell extensions and displays contextual status banners in preferences pages.
_Avoid_: page-specific status boilerplate, silent configuration failures

**Theme Enumeration**:
Dynamic discovery of installed GTK stylesheet themes and icon packs across system and user directories to provide reactive selection in appearance settings.
_Avoid_: hardcoded theme lists, static appearance presets

**GSettings Binding**:
Mechanism for real-time bidirectional synchronization between GLib GSettings keys and GTK4/Libadwaita user interface widgets.
_Avoid_: config file sync, manual sync

**Extension Status Proxy**:
D-Bus client connected to `org.gnome.Shell.Extensions` to monitor extension lifecycle status in real time and reactively update the UI.
_Avoid_: disk file checking, enabled-extensions key polling

**Schema Fallback**:
GLib schema resolution strategy that prefers system directories and gracefully falls back to local compiled directories for rootless execution.
_Avoid_: forced global installation, mandatory sudo

**Overlay Key Lifecycle**:
Super key shortcut management via Mutter GSettings with state preservation and strict restoration during extension disable cycles.
_Avoid_: hardcoded grab, permanent shortcut replacement

**Build Target**:
Declarative build, installation, and packaging targets defined in the root Makefile and Debian packaging configs to standardize distribution.
_Avoid_: imperative setup script, proprietary installer
