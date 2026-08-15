# Spec: Pop COSMIC Self-Contained Suite & Pop Settings para GNOME Shell 48

Status: implemented

## Problem Statement

Usuários de ambientes Linux modernos (Debian 13 trixie, Ubuntu, Arch, Fedora) rodando GNOME Shell 48.7 não conseguem usufruir da experiência de desktop clássica e altamente produtiva do Pop!_OS 22.04 (Pop COSMIC). O ecossistema original foi descontinuado pela System76 na versão GNOME 42 devido à migração para o novo ambiente em Rust. Depender de extensões externas em constante mutação ou de patches intrusivos no painel nativo de configurações (`gnome-control-center`) gera quebras frequentes, incompatibilidades de runtime, mistura de traduções e configurações desconexas. O usuário precisa de uma suíte completa, autocontida, estável e perfeitamente integrada ao GNOME 48 com um aplicativo central de configurações moderno em Libadwaita.

## Solution

Entregar a suíte autocontida Pop COSMIC para GNOME Shell 48 contendo:
1. **Extensões GNOME Shell Modernizadas e Congeladas**: `pop-cosmic` (botões superiores, gaveta de apps, atalhos Super), `cosmic-workspaces` (workspaces verticais e miniaturas) e `pop-shell` (tiling window manager integrado), todas com código-fonte em inglês padronizado, compatibilidade total com ESM do GNOME 48 e diálogos de preferências em Libadwaita.
2. **Aplicativo Central Pop Settings**: Um aplicativo standalone em Python 3 gerenciado via `uv` com interface nativa GTK4/Libadwaita (`Adw.ApplicationWindow`, `Adw.PreferencesPage`) que gerencia em tempo real Desktop, Workspaces, Tiling, Dock e Aparência via GSettings.
3. **Componentização e Robustez**: Componente reutilizável de monitoramento e banner de status via D-Bus para avisar o usuário reativamente caso alguma extensão esteja desativada no Shell.
4. **Descoberta Dinâmica de Temas**: Enumeração em tempo real de temas GTK e pacotes de ícones instalados no sistema para seleção ágil.
5. **Empacotamento e Distribuição Unificada**: Alvos declarativos no Makefile e empacotamento Debian para instalação em um único comando (`make install` ou pacote `.deb`).

## User Stories

1. As a desktop user on GNOME 48, I want to install the complete Pop COSMIC suite in a single command, so that I get the full Pop!_OS 22.04 workflow without searching for fragmented extensions.
2. As a user, I want Workspaces and Applications buttons on the top bar, so that I can quickly switch workspaces or open my app drawer.
3. As a user, I want the Applications drawer to support keyboard searching and category organization, so that I can launch software instantly.
4. As a user, I want the Super key to trigger either the Pop Launcher, Workspaces overview, or Applications drawer based on my preference, so that my keyboard workflow is fluid.
5. As a user, I want the top bar clock to be aligned to the left, center, or right, so that panel space is optimized for my setup.
6. As a user, I want vertical workspace navigation with real-time thumbnail previews on the screen edge, so that multi-tasking follows an intuitive vertical axis.
7. As a user, I want automatic workspace keyboard shortcuts (<Super>Page_Up and <Super>Page_Down), so that I can switch workspaces using muscle memory.
8. As a user, I want the Pop Shell tiling manager to automatically arrange windows in a grid without overlaps, so that screen real estate is maximized.
9. As a user, I want to configure inner and outer window gaps, active window borders, and mouse stacking behaviors, so that tiled windows are visually comfortable.
10. As a user, I want to open Pop Settings from the application launcher or from extension preferences gears, so that I have a unified control panel for all desktop options.
11. As a user, I want any change made inside Pop Settings to synchronize immediately with GNOME Shell without requiring a shell restart, so that visual feedback is instant.
12. As a user, I want Pop Settings to display a clear notification banner when a required extension is disabled in GNOME Shell, so that I know why a setting may not currently take effect.
13. As a user, I want to choose my GTK application theme and icon theme from dynamic dropdown lists of all installed themes, so that I can customize my desktop look freely.
14. As a user, I want Pop Settings to respect system light and dark mode preferences automatically with Libadwaita styling, so that the settings window matches the rest of the OS.
15. As a user, I want extension preferences windows to use standard desktop application launchers without hardcoded paths, so that the suite functions reliably on any user account or filesystem location.
16. As an international user, I want all source code and default extension UI strings to be in standard English with full gettext support, so that localization is clean and uncorrupted.
17. As a system administrator, I want declarative Makefile targets for building, testing, and installing individual components or the full suite, so that deployment in distribution packages is straightforward.

## Implementation Decisions

1. **Self-Contained Suite Architecture:**
   - The suite bundles all core extensions, themes, and configuration applications within the single repository.
   - All extension source code is standardized in 100% standard English with gettext internationalization strings.

2. **Standalone Configuration Application (Pop Settings):**
   - Built with Python 3, PyGObject, and Libadwaita (`Adw`), managed via `uv`.
   - Main window structured with `Adw.ToolbarView`, `Adw.ViewStack`, and 5 dedicated preference pages:
     - `DesktopPage`: Top bar buttons, clock alignment, and Super key behavior.
     - `WorkspacesPage`: Workspace thumbnails, position, offsets, and multi-monitor behavior.
     - `TilingPage`: Auto-tiling, active hints, window gaps, mouse behavior, and drag-to-snap.
     - `DockPage`: Dash-to-dock display, icon size, multi-monitor dock, and Pop shortcuts.
     - `AppearancePage`: Dark/light mode, dynamic GTK theme selection, and dynamic icon theme selection.

3. **Extension Status Banner Component:**
   - Encapsulated reusable Libadwaita preference group widget connected to the D-Bus extension status monitor.
   - Automatically reveals a contextual warning banner if the target extension is disabled, eliminating duplicate boilerplate across pages.

4. **Dynamic Theme Discovery:**
   - File-system discovery helper that inspects standard directories (`/usr/share/themes`, `~/.themes`, `~/.local/share/themes`, `/usr/share/icons`, `~/.icons`, `~/.local/share/icons`) to dynamically populate combo rows bound to `org.gnome.desktop.interface`.

5. **Desktop Application Launch Protocol in Extension Preferences:**
   - Extension preferences (`prefs.js`) use `Gio.DesktopAppInfo` and `Gio.AppInfo.create_from_commandline` to launch `pop-settings` from system `PATH`, removing all hardcoded developer paths and legacy import bridges.

6. **Build and Packaging Unification:**
   - Declarative Makefile targets supporting both full-suite installation (`install`) and modular component installations (`install-cosmic`, `install-workspaces`, `install-shell`, `install-settings`, `install-themes`).
   - Standard Debian package rules for `gnome-cosmic-pop22`.

## Testing Decisions

1. **Seam 1: Extension JavaScript Syntax and GSettings Schemas:**
   - Static syntax verification of all `.js` modules using `gjs -c`.
   - Strict GSettings schema compilation across all component schemas using `glib-compile-schemas --strict`.

2. **Seam 2: Pop Settings Application Logic and UI Integration:**
   - Automated Pytest test suite executed via `uv run pytest`.
   - Verification of page instantiation, schema fallback resolution, dynamic theme enumeration, and `ExtensionStatusBanner` state transitions.

3. **Seam 3: Desktop Entry and System Packaging:**
   - Validation of `.desktop` entry file via `desktop-file-validate`.
   - Dry-run verification of Makefile install and uninstall targets.

## Out of Scope

- Forking the Rust-based COSMIC desktop environment (focus is exclusively on the GNOME Shell 48 Pop experience).
- Patching Mutter or GNOME Control Center C source code.
- Modifying upstream window manager keybindings beyond reversible overlay and workspace navigation hooks.

## Further Notes

- All changes remain in the local working tree for review via `git diff`.
- License: GNU General Public License v3 (GPLv3).
