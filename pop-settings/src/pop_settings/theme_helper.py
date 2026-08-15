"""Discover GTK stylesheet themes and icon packs installed on the system.

Enumerates the standard system and per-user theme directories so the
appearance settings can offer whatever is actually installed, rather than a
hardcoded list. Missing or unreadable directories are skipped silently: a
machine without ``~/.themes`` is normal, not an error.
"""

from __future__ import annotations

from pathlib import Path
from typing import Iterable, Optional

# Themes shipped with the suite, plus the GNOME default, float to the top of
# every list. Order within this tuple is the order the user sees. The dark
# variant is spelled "Pop-dark" by the GTK theme and "Pop-Dark" by the icon
# theme, so both spellings are listed; only the ones actually installed are
# ever returned.
_PRIORITY_THEMES = ("Pop", "Pop-dark", "Pop-Dark", "Adwaita", "Adwaita-dark")

# A directory is a GTK theme when it carries a stylesheet for either GTK
# generation. GTK 4 first: it is what Libadwaita apps actually load.
_GTK_VERSION_DIRS = ("gtk-4.0", "gtk-3.0")

# "default" under an icon directory is the cursor-theme redirect, never a
# selectable icon pack.
_ICON_EXCLUDED = frozenset({"default"})


def default_gtk_theme_dirs() -> list[Path]:
    """Return the standard search path for GTK themes, most global first."""
    home = Path.home()
    return [
        Path("/usr/share/themes"),
        Path("/usr/local/share/themes"),
        home / ".themes",
        home / ".local/share/themes",
    ]


def default_icon_theme_dirs() -> list[Path]:
    """Return the standard search path for icon packs, most global first."""
    home = Path.home()
    return [
        Path("/usr/share/icons"),
        Path("/usr/local/share/icons"),
        home / ".icons",
        home / ".local/share/icons",
    ]


def discover_gtk_themes(
    directories: Optional[Iterable[Path]] = None,
) -> list[str]:
    """Return the names of every installed GTK theme, priority names first."""
    if directories is None:
        directories = default_gtk_theme_dirs()

    found = {
        entry.name
        for directory in directories
        for entry in _subdirectories(directory)
        if _is_gtk_theme(entry)
    }
    return _ordered(found)


def discover_icon_themes(
    directories: Optional[Iterable[Path]] = None,
) -> list[str]:
    """Return the names of every installed icon pack, priority names first."""
    if directories is None:
        directories = default_icon_theme_dirs()

    found = {
        entry.name
        for directory in directories
        for entry in _subdirectories(directory)
        if _is_icon_theme(entry)
    }
    return _ordered(found)


def _subdirectories(directory: Path) -> list[Path]:
    """List the subdirectories of *directory*, or nothing if unreadable."""
    try:
        return [entry for entry in Path(directory).iterdir() if entry.is_dir()]
    except OSError:
        return []


def _is_gtk_theme(entry: Path) -> bool:
    return any((entry / version).is_dir() for version in _GTK_VERSION_DIRS)


def _is_icon_theme(entry: Path) -> bool:
    if entry.name in _ICON_EXCLUDED:
        return False
    return (entry / "index.theme").is_file()


def _ordered(names: set[str]) -> list[str]:
    """Priority themes in their canonical order, then the rest alphabetically."""
    priority = [name for name in _PRIORITY_THEMES if name in names]
    remaining = sorted(names - set(priority), key=str.casefold)
    return priority + remaining
