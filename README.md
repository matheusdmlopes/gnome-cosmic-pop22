# gnome-cosmic-pop22

Bring the Pop!_OS 22.04 (Pop COSMIC) desktop experience to modern **GNOME Shell 48+** across Linux distributions (Arch, Fedora, Debian, Ubuntu).

## Overview

The original Pop COSMIC ecosystem was developed for GNOME 42 and relied on patches to `gnome-control-center`. As GNOME Shell transitioned to ES Modules (GNOME 45+) and GTK4/Libadwaita, these extensions broke on upstream distributions.

**gnome-cosmic-pop22** ports and modernizes the complete Pop COSMIC suite:
- **`pop-cosmic`**: Modernized GNOME Shell extension (ESM) providing top bar buttons (Workspaces & Applications), a searchable application drawer, and Super key customization.
- **`cosmic-workspaces`**: Modernized GNOME Shell extension (ESM) delivering vertical workspaces and side thumbnail previews.
- **`pop-settings`**: Standalone Libadwaita settings application (Python + PyGObject + `uv`) that configures top bar, workspaces, tiling, dock, and themes via direct GSettings binding without modifying system control center binaries.
- **Visual Identity**: Official Pop GTK theme, Pop icon theme, and desktop wallpapers.

---

## Architecture & Components

```
gnome-cosmic-pop22/
├── cosmic/                  # pop-cosmic GNOME 48 ESM extension
├── cosmic-workspaces/       # cosmic-workspaces GNOME 48 ESM extension
├── pop-settings/            # Standalone Python/Libadwaita settings application
├── gtk-theme/               # Pop GTK application theme
├── pop-icon-theme/          # Pop system icon theme
├── wallpapers/              # Pop!_OS wallpaper collection
└── Makefile                 # Declarative build, install, and test interface
```

---

## Prerequisites

- **GNOME Shell**: 45, 46, 47, or 48
- **GJS** & **glib-compile-schemas**
- **Python**: 3.10+
- **uv**: Python package manager (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **PyGObject** & **Libadwaita** (`gir1.2-adw-1`, `gir1.2-gtk-4.0` or distro equivalent)

---

## Quick Start

### 1. Build and Run Tests
```bash
make test
```

### 2. Install Extensions and Settings (User Space)
```bash
make install
```

### 3. (Optional) Install Complete Themes and Wallpapers
```bash
make install-all
```

### 4. Enable Extensions
Restart GNOME Shell (log out/log in on Wayland or press `Alt+F2` then `r` on X11), then enable the extensions:
```bash
gnome-extensions enable pop-cosmic@system76.com
gnome-extensions enable cosmic-workspaces@system76.com
```

Launch the settings manager directly from your application launcher or terminal:
```bash
cd pop-settings && uv run python -m pop_settings
```

---

## Uninstallation

To remove all installed extensions, schemas, and desktop launchers:
```bash
make uninstall
```

---

## License

GNU General Public License v3.0 (GPL-3.0). Original components by System76, modernized for GNOME Shell 48+.
