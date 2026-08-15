from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings

class DesktopPage(Adw.PreferencesPage):
    def __init__(self):
        super().__init__()
        self.set_title("Desktop and Top Bar")
        self.set_icon_name("preferences-desktop-display-symbolic")

        self.settings = get_settings("org.gnome.shell.extensions.pop-cosmic")

        # Group: Top Bar
        topbar_group = Adw.PreferencesGroup()
        topbar_group.set_title("Top Bar")
        topbar_group.set_description("Configure top bar buttons and panel alignment")
        self.add(topbar_group)

        # Workspaces Button
        self.workspaces_row = Adw.SwitchRow()
        self.workspaces_row.set_title("Workspaces Button")
        self.workspaces_row.set_subtitle("Show the workspaces overview button on the top bar")
        topbar_group.add(self.workspaces_row)

        # Applications Button
        self.apps_row = Adw.SwitchRow()
        self.apps_row.set_title("Applications Button")
        self.apps_row.set_subtitle("Show the Pop applications launcher button on the top bar")
        topbar_group.add(self.apps_row)

        # Clock Alignment
        self.clock_row = Adw.ComboRow()
        self.clock_row.set_title("Clock Position")
        self.clock_row.set_subtitle("Alignment of the date and time in the top bar")
        clock_model = Gtk.StringList.new(["Center", "Left", "Right"])
        self.clock_row.set_model(clock_model)
        topbar_group.add(self.clock_row)

        # Group: Keyboard Shortcuts
        shortcuts_group = Adw.PreferencesGroup()
        shortcuts_group.set_title("Keyboard Behavior")
        self.add(shortcuts_group)

        # Super Key Action
        self.super_row = Adw.ComboRow()
        self.super_row.set_title("Super Key Action")
        self.super_row.set_subtitle("Action to perform when pressing the Super (Windows) key")
        super_model = Gtk.StringList.new(["Workspaces", "Applications", "Pop Launcher"])
        self.super_row.set_model(super_model)
        shortcuts_group.add(self.super_row)

        self._bind_settings()

    def _bind_settings(self):
        if self.settings is None:
            return

        self.settings.bind("show-workspaces-button", self.workspaces_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("show-applications-button", self.apps_row, "active", Gio.SettingsBindFlags.DEFAULT)

        # Sync Clock Enum
        def update_clock_ui():
            val = self.settings.get_enum("clock-alignment")
            self.clock_row.set_selected(val)

        update_clock_ui()
        self.clock_row.connect("notify::selected", lambda *args: self.settings.set_enum("clock-alignment", self.clock_row.get_selected()))
        self.settings.connect("changed::clock-alignment", lambda *args: update_clock_ui())

        # Sync Super Key Action Enum
        def update_super_ui():
            val = self.settings.get_enum("overlay-key-action")
            self.super_row.set_selected(val)

        update_super_ui()
        self.super_row.connect("notify::selected", lambda *args: self.settings.set_enum("overlay-key-action", self.super_row.get_selected()))
        self.settings.connect("changed::overlay-key-action", lambda *args: update_super_ui())
