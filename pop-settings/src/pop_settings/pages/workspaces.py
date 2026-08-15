from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings

class WorkspacesPage(Adw.PreferencesPage):
    def __init__(self):
        super().__init__()
        self.set_title("Workspaces")
        self.set_icon_name("view-paged-symbolic")

        self.settings = get_settings("org.gnome.shell.extensions.cosmic-workspaces")
        self.mutter_settings = get_settings("org.gnome.mutter")

        # Group: Vertical Overview
        view_group = Adw.PreferencesGroup()
        view_group.set_title("Vertical Overview")
        view_group.set_description("Customize thumbnails and vertical workspace transitions")
        self.add(view_group)

        # Static Background
        self.static_bg_row = Adw.SwitchRow()
        self.static_bg_row.set_title("Static Background")
        self.static_bg_row.set_subtitle("Keep desktop background static in the overview")
        view_group.add(self.static_bg_row)

        # Scaling Background
        self.scaling_bg_row = Adw.SwitchRow()
        self.scaling_bg_row.set_title("Scale Wallpaper Background")
        self.scaling_bg_row.set_subtitle("Smoothly scale wallpaper during transitions in the overview")
        view_group.add(self.scaling_bg_row)

        # Panel in Overview
        self.panel_overview_row = Adw.SwitchRow()
        self.panel_overview_row.set_title("Opaque Top Bar in Overview")
        self.panel_overview_row.set_subtitle("Prevent top bar from turning transparent in the overview")
        view_group.add(self.panel_overview_row)

        # Thumbnail Width
        self.thumb_width_row = Adw.SpinRow()
        self.thumb_width_row.set_title("Thumbnail Column Width")
        self.thumb_width_row.set_subtitle("Distance in pixels for the side thumbnail column")
        thumb_adj = Gtk.Adjustment(value=300, lower=100, upper=600, step_increment=20, page_increment=50)
        self.thumb_width_row.set_adjustment(thumb_adj)
        view_group.add(self.thumb_width_row)

        # Group: Multi-Monitor
        monitors_group = Adw.PreferencesGroup()
        monitors_group.set_title("Multi-Monitor Behavior")
        self.add(monitors_group)

        # Workspaces on all monitors
        self.multi_monitor_row = Adw.SwitchRow()
        self.multi_monitor_row.set_title("Workspaces on All Displays")
        self.multi_monitor_row.set_subtitle("Switching workspace changes all connected displays simultaneously")
        monitors_group.add(self.multi_monitor_row)

        self._bind_settings()

    def _bind_settings(self):
        if self.settings:
            self.settings.bind("static-background", self.static_bg_row, "active", Gio.SettingsBindFlags.DEFAULT)
            self.settings.bind("scaling-workspace-background", self.scaling_bg_row, "active", Gio.SettingsBindFlags.DEFAULT)
            self.settings.bind("panel-in-overview", self.panel_overview_row, "active", Gio.SettingsBindFlags.DEFAULT)
            self.settings.bind("left-offset", self.thumb_width_row, "value", Gio.SettingsBindFlags.DEFAULT)

        if self.mutter_settings:
            def update_multi_monitor():
                only_primary = self.mutter_settings.get_boolean("workspaces-only-on-primary")
                self.multi_monitor_row.set_active(not only_primary)

            update_multi_monitor()
            self.multi_monitor_row.connect("notify::active", lambda *args: self.mutter_settings.set_boolean("workspaces-only-on-primary", not self.multi_monitor_row.get_active()))
            self.mutter_settings.connect("changed::workspaces-only-on-primary", lambda *args: update_multi_monitor())
