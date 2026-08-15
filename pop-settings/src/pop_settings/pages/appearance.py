from __future__ import annotations

from typing import Optional, Sequence

from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings
from pop_settings.theme_helper import discover_gtk_themes, discover_icon_themes

# GTK reports "nothing selected" with this sentinel; it is not bound in the
# Python overrides, so spell it out here.
_INVALID_LIST_POSITION = 0xFFFFFFFF


class AppearancePage(Adw.PreferencesPage):
    """Color scheme, GTK theme and icon pack selection.

    The theme lists default to whatever is installed on the machine. They can
    be passed in explicitly, which keeps the page testable without depending
    on the host's installed themes.
    """

    def __init__(
        self,
        gtk_themes: Optional[Sequence[str]] = None,
        icon_themes: Optional[Sequence[str]] = None,
    ) -> None:
        super().__init__()
        self.set_title("Appearance and Themes")
        self.set_icon_name("preferences-desktop-appearance-symbolic")

        self.settings = get_settings("org.gnome.desktop.interface")

        self.gtk_themes = list(gtk_themes) if gtk_themes is not None else discover_gtk_themes()
        self.icon_themes = list(icon_themes) if icon_themes is not None else discover_icon_themes()

        # Group: Color Scheme
        theme_group = Adw.PreferencesGroup()
        theme_group.set_title("Color Scheme")
        theme_group.set_description("Select system light or dark style")
        self.add(theme_group)

        # Dark Mode Switch
        self.dark_mode_row = Adw.SwitchRow()
        self.dark_mode_row.set_title("Dark Style")
        self.dark_mode_row.set_subtitle("Apply dark color scheme across supported applications")
        theme_group.add(self.dark_mode_row)

        # Group: Themes
        pop_themes_group = Adw.PreferencesGroup()
        pop_themes_group.set_title("Themes")
        pop_themes_group.set_description("Themes installed on this system")
        self.add(pop_themes_group)

        # GTK Theme Row
        self.gtk_theme_row = Adw.ComboRow()
        self.gtk_theme_row.set_title("Application Style (GTK)")
        self.gtk_theme_row.set_subtitle("Stylesheet used by GTK applications")
        self.gtk_theme_row.set_model(Gtk.StringList.new(self.gtk_themes))
        pop_themes_group.add(self.gtk_theme_row)

        # Icon Theme Row
        self.icon_theme_row = Adw.ComboRow()
        self.icon_theme_row.set_title("Icon Set")
        self.icon_theme_row.set_subtitle("Icon pack used across the desktop")
        self.icon_theme_row.set_model(Gtk.StringList.new(self.icon_themes))
        pop_themes_group.add(self.icon_theme_row)

        self._bind_settings()

    def _bind_settings(self):
        if self.settings is None:
            return

        def update_dark_mode():
            scheme = self.settings.get_string("color-scheme")
            self.dark_mode_row.set_active(scheme == "prefer-dark")

        update_dark_mode()

        self.dark_mode_row.connect(
            "notify::active",
            lambda *args: self.settings.set_string("color-scheme", "prefer-dark" if self.dark_mode_row.get_active() else "default")
        )
        self.settings.connect("changed::color-scheme", lambda *args: update_dark_mode())

        self._bind_theme_row(self.gtk_theme_row, self.gtk_themes, "gtk-theme")
        self._bind_theme_row(self.icon_theme_row, self.icon_themes, "icon-theme")

    def _bind_theme_row(
        self,
        row: Adw.ComboRow,
        names: list[str],
        key: str,
    ) -> None:
        """Keep *row* and the GSettings *key* in sync in both directions."""

        def update_from_settings():
            active = self.settings.get_string(key)
            if active not in names:
                # The active theme lives outside the directories we scan.
                # Adw.ComboRow always shows some row, so append the real
                # value rather than let the list display the wrong theme.
                names.append(active)
                row.get_model().append(active)
            row.set_selected(names.index(active))

        def apply_selection():
            index = row.get_selected()
            if index == _INVALID_LIST_POSITION or index >= len(names):
                return
            chosen = names[index]
            if chosen != self.settings.get_string(key):
                self.settings.set_string(key, chosen)

        # Seed the widget before connecting, so building the page never
        # writes the user's current theme back to GSettings.
        update_from_settings()

        row.connect("notify::selected", lambda *args: apply_selection())
        self.settings.connect(f"changed::{key}", lambda *args: update_from_settings())
