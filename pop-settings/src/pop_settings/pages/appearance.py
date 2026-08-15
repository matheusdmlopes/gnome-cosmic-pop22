from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings

class AppearancePage(Adw.PreferencesPage):
    def __init__(self):
        super().__init__()
        self.set_title("Appearance and Themes")
        self.set_icon_name("preferences-desktop-appearance-symbolic")

        self.settings = get_settings("org.gnome.desktop.interface")

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

        # Group: Pop!_OS Themes
        pop_themes_group = Adw.PreferencesGroup()
        pop_themes_group.set_title("Pop!_OS Identity")
        self.add(pop_themes_group)

        # GTK Theme Row
        self.gtk_theme_row = Adw.ActionRow()
        self.gtk_theme_row.set_title("Application Style (GTK)")
        self.gtk_theme_row.set_subtitle("Pop-dark / Pop GTK theme")
        pop_themes_group.add(self.gtk_theme_row)

        # Icon Theme Row
        self.icon_theme_row = Adw.ActionRow()
        self.icon_theme_row.set_title("Icon Set")
        self.icon_theme_row.set_subtitle("Pop icon theme")
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
