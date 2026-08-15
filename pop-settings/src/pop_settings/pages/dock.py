from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings

# Enum dash-to-dock position: 0=TOP, 1=RIGHT, 2=BOTTOM, 3=LEFT
UI_TO_POS_ENUM = {
    0: 2,  # Bottom of the screen
    1: 3,  # Along the left side
    2: 1,  # Along the right side
}
POS_ENUM_TO_UI = {
    2: 0,  # Bottom
    3: 1,  # Left
    1: 2,  # Right
}

# Click Action mappings
CLICK_ACTIONS = [
    ("cycle-windows", "Launch or Cycle Windows"),
    ("minimize", "Launch or Minimize Windows"),
    ("focus-minimize-or-previews", "Launch, Minimize, or Preview Windows"),
]

class DockPage(Adw.PreferencesPage):
    def __init__(self):
        super().__init__()
        self.set_title("Dock")
        self.set_icon_name("user-bookmarks-symbolic")

        self.settings = get_settings("org.gnome.shell.extensions.dash-to-dock")
        self.shell_settings = get_settings("org.gnome.shell")

        # -------------------------------------------------------------
        # Grupo: Habilitar Dock
        # -------------------------------------------------------------
        main_group = Adw.PreferencesGroup()
        self.add(main_group)

        self.enable_dock_row = Adw.SwitchRow()
        self.enable_dock_row.set_title("Enable Dock")
        self.enable_dock_row.set_subtitle("Show desktop application dock")
        main_group.add(self.enable_dock_row)

        # -------------------------------------------------------------
        # Grupo: Dock Visibility
        # -------------------------------------------------------------
        visibility_group = Adw.PreferencesGroup()
        visibility_group.set_title("Dock Visibility")
        self.add(visibility_group)

        self.visibility_row = Adw.ComboRow()
        self.visibility_row.set_title("Visibility Mode")
        self.visibility_row.set_subtitle("Control how and when the dock is displayed")
        vis_model = Gtk.StringList.new([
            "Always visible",
            "Intelligently hide (hide on window overlap, reveal on hover)",
            "Always hide (reveal on hover)"
        ])
        self.visibility_row.set_model(vis_model)
        visibility_group.add(self.visibility_row)

        # -------------------------------------------------------------
        # Grupo: Position and Alignment
        # -------------------------------------------------------------
        placement_group = Adw.PreferencesGroup()
        placement_group.set_title("Position and Placement")
        self.add(placement_group)

        # Position on Desktop
        self.position_row = Adw.ComboRow()
        self.position_row.set_title("Position on the Desktop")
        self.position_row.set_subtitle("Side of the display where the dock is anchored")
        pos_model = Gtk.StringList.new([
            "Bottom of the screen",
            "Along the left side",
            "Along the right side"
        ])
        self.position_row.set_model(pos_model)
        placement_group.add(self.position_row)

        # Center Icons
        self.center_icons_row = Adw.SwitchRow()
        self.center_icons_row.set_title("Center Icons in Dock")
        self.center_icons_row.set_subtitle("Keep application icons centered in the middle of the dock")
        placement_group.add(self.center_icons_row)

        # Extend dock to edges
        self.extend_height_row = Adw.SwitchRow()
        self.extend_height_row.set_title("Extend Dock to the Edges of the Screen")
        self.extend_height_row.set_subtitle("Make the dock span the full height or width of the display")
        placement_group.add(self.extend_height_row)

        # Multi-monitor
        self.multimonitor_row = Adw.ComboRow()
        self.multimonitor_row.set_title("Show Dock on Display")
        self.multimonitor_row.set_subtitle("Choose whether the dock appears on one or all screens")
        display_model = Gtk.StringList.new(["Primary Display", "All Displays"])
        self.multimonitor_row.set_model(display_model)
        placement_group.add(self.multimonitor_row)

        # -------------------------------------------------------------
        # Grupo: Dock Size & Icon Sizing
        # -------------------------------------------------------------
        size_group = Adw.PreferencesGroup()
        size_group.set_title("Dock Size")
        self.add(size_group)

        self.icon_size_row = Adw.SpinRow()
        self.icon_size_row.set_title("Icon Size (pixels)")
        self.icon_size_row.set_subtitle("Maximum size of application icons on the dock")
        icon_adj = Gtk.Adjustment(value=48, lower=16, upper=128, step_increment=4, page_increment=8)
        self.icon_size_row.set_adjustment(icon_adj)
        size_group.add(self.icon_size_row)

        # -------------------------------------------------------------
        # Grupo: Behavior & Click Action
        # -------------------------------------------------------------
        behavior_group = Adw.PreferencesGroup()
        behavior_group.set_title("Behavior and Click Action")
        self.add(behavior_group)

        self.click_action_row = Adw.ComboRow()
        self.click_action_row.set_title("Icon Click Action")
        self.click_action_row.set_subtitle("Action when clicking an already running application icon")
        click_model = Gtk.StringList.new([title for _, title in CLICK_ACTIONS])
        self.click_action_row.set_model(click_model)
        behavior_group.add(self.click_action_row)

        # -------------------------------------------------------------
        # Grupo: Dock Items
        # -------------------------------------------------------------
        items_group = Adw.PreferencesGroup()
        items_group.set_title("Dock Items")
        self.add(items_group)

        # Show Launcher Icon
        self.launcher_item_row = Adw.SwitchRow()
        self.launcher_item_row.set_title("Show Launcher Icon in Dock")
        self.launcher_item_row.set_subtitle("Add Pop Launcher shortcut to dock favorites")
        items_group.add(self.launcher_item_row)

        # Show Workspaces Icon
        self.workspaces_item_row = Adw.SwitchRow()
        self.workspaces_item_row.set_title("Show Workspaces Icon in Dock")
        self.workspaces_item_row.set_subtitle("Add Workspaces shortcut to dock favorites")
        items_group.add(self.workspaces_item_row)

        # Show Applications Icon
        self.apps_item_row = Adw.SwitchRow()
        self.apps_item_row.set_title("Show Applications Icon in Dock")
        self.apps_item_row.set_subtitle("Add Applications shortcut to dock favorites")
        items_group.add(self.apps_item_row)

        # Show Mounted Drives
        self.mounts_row = Adw.SwitchRow()
        self.mounts_row.set_title("Show Mounted Drives")
        self.mounts_row.set_subtitle("Display removable media and mounted volumes")
        items_group.add(self.mounts_row)

        # Show Trash
        self.trash_row = Adw.SwitchRow()
        self.trash_row.set_title("Show Trash")
        self.trash_row.set_subtitle("Display trash bin icon on the dock")
        items_group.add(self.trash_row)

        self._bind_settings()

    def _bind_settings(self):
        if self.settings is None:
            return

        # 1. Enable Dock: manualhide (inverted)
        try:
            self.settings.bind("manualhide", self.enable_dock_row, "active", Gio.SettingsBindFlags.INVERT_BOOLEAN)
        except Exception:
            pass

        # 2. Visibility Modes:
        # 0: Always visible -> dock-fixed=True, intellihide=False, autohide=False
        # 1: Intelligently hide -> dock-fixed=False, intellihide=True, autohide=True (hides on overlap, reveals on hover)
        # 2: Always hide -> dock-fixed=False, intellihide=False, autohide=True
        def update_visibility_ui():
            if self.settings.get_boolean("dock-fixed"):
                self.visibility_row.set_selected(0)
            elif self.settings.get_boolean("intellihide"):
                self.visibility_row.set_selected(1)
            else:
                self.visibility_row.set_selected(2)

        def on_visibility_changed(*args):
            sel = self.visibility_row.get_selected()
            if sel == 0:  # Always visible
                self.settings.set_boolean("dock-fixed", True)
                self.settings.set_boolean("intellihide", False)
                self.settings.set_boolean("autohide", False)
            elif sel == 1:  # Intelligently hide (with hover reveal!)
                self.settings.set_boolean("dock-fixed", False)
                self.settings.set_boolean("intellihide", True)
                self.settings.set_boolean("autohide", True)
            elif sel == 2:  # Always hide
                self.settings.set_boolean("dock-fixed", False)
                self.settings.set_boolean("intellihide", False)
                self.settings.set_boolean("autohide", True)

        try:
            update_visibility_ui()
            self.visibility_row.connect("notify::selected", on_visibility_changed)
            self.settings.connect("changed::dock-fixed", lambda *a: update_visibility_ui())
            self.settings.connect("changed::intellihide", lambda *a: update_visibility_ui())
            self.settings.connect("changed::autohide", lambda *a: update_visibility_ui())
        except Exception:
            pass

        # 3. Position on Desktop
        def update_position_ui():
            enum_val = self.settings.get_enum("dock-position")
            ui_idx = POS_ENUM_TO_UI.get(enum_val, 0)
            self.position_row.set_selected(ui_idx)

        try:
            update_position_ui()
            self.position_row.connect(
                "notify::selected",
                lambda *args: self.settings.set_enum("dock-position", UI_TO_POS_ENUM.get(self.position_row.get_selected(), 2))
            )
            self.settings.connect("changed::dock-position", lambda *a: update_position_ui())
        except Exception:
            pass

        # 4. Center Icons
        try:
            self.settings.bind("always-center-icons", self.center_icons_row, "active", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass

        # 5. Extend Height
        try:
            self.settings.bind("extend-height", self.extend_height_row, "active", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass

        # 6. Multi-monitor
        def update_multimonitor_ui():
            is_multi = self.settings.get_boolean("multi-monitor")
            self.multimonitor_row.set_selected(1 if is_multi else 0)

        try:
            update_multimonitor_ui()
            self.multimonitor_row.connect(
                "notify::selected",
                lambda *args: self.settings.set_boolean("multi-monitor", self.multimonitor_row.get_selected() == 1)
            )
            self.settings.connect("changed::multi-monitor", lambda *a: update_multimonitor_ui())
        except Exception:
            pass

        # 7. Icon Size
        try:
            self.settings.bind("dash-max-icon-size", self.icon_size_row, "value", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass

        # 8. Click Action
        def update_click_action_ui():
            curr = self.settings.get_string("click-action")
            for idx, (key, _) in enumerate(CLICK_ACTIONS):
                if key == curr or (key == "focus-minimize-or-previews" and "minimize" in curr and "preview" in curr):
                    self.click_action_row.set_selected(idx)
                    return
            self.click_action_row.set_selected(0)

        try:
            update_click_action_ui()
            self.click_action_row.connect(
                "notify::selected",
                lambda *args: self.settings.set_string("click-action", CLICK_ACTIONS[self.click_action_row.get_selected()][0])
            )
            self.settings.connect("changed::click-action", lambda *a: update_click_action_ui())
        except Exception:
            pass

        # 9. Applications Icon in Dock (dash-to-dock show-show-apps-button)
        try:
            self.settings.bind("show-show-apps-button", self.apps_item_row, "active", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass

        # 10. Favorite Apps (Launcher, Workspaces)
        if self.shell_settings:
            def update_favorites_ui():
                favs = self.shell_settings.get_strv("favorite-apps")
                self.launcher_item_row.set_active("pop-cosmic-launcher.desktop" in favs)
                self.workspaces_item_row.set_active("pop-cosmic-workspaces.desktop" in favs)

            def toggle_fav(app_id: str, is_active: bool):
                favs = list(self.shell_settings.get_strv("favorite-apps"))
                if is_active and app_id not in favs:
                    favs.insert(0, app_id)
                    self.shell_settings.set_strv("favorite-apps", favs)
                elif not is_active and app_id in favs:
                    favs.remove(app_id)
                    self.shell_settings.set_strv("favorite-apps", favs)

            update_favorites_ui()
            self.launcher_item_row.connect(
                "notify::active",
                lambda *a: toggle_fav("pop-cosmic-launcher.desktop", self.launcher_item_row.get_active())
            )
            self.workspaces_item_row.connect(
                "notify::active",
                lambda *a: toggle_fav("pop-cosmic-workspaces.desktop", self.workspaces_item_row.get_active())
            )
            self.shell_settings.connect("changed::favorite-apps", lambda *a: update_favorites_ui())

        # 10. Drives & Trash
        try:
            self.settings.bind("show-mounts", self.mounts_row, "active", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass

        try:
            self.settings.bind("show-trash", self.trash_row, "active", Gio.SettingsBindFlags.DEFAULT)
        except Exception:
            pass
