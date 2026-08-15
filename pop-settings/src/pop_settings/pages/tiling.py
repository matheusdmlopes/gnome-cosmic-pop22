from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings

class TilingPage(Adw.PreferencesPage):
    def __init__(self):
        super().__init__()
        self.set_title("Tile Windows")
        self.set_icon_name("preferences-desktop-windows-symbolic")

        self.settings = get_settings("org.gnome.shell.extensions.pop-shell")

        # Group: Tiling Mode
        tiling_group = Adw.PreferencesGroup()
        tiling_group.set_title("Tiling Mode")
        tiling_group.set_description("Control automatic window tiling and layout behavior")
        self.add(tiling_group)

        # Tile by default
        self.tile_default_row = Adw.SwitchRow()
        self.tile_default_row.set_title("Tile Windows by Default")
        self.tile_default_row.set_subtitle("Automatically tile newly opened windows into non-overlapping grids")
        tiling_group.add(self.tile_default_row)

        # Active hint
        self.hint_row = Adw.SwitchRow()
        self.hint_row.set_title("Active Window Hint")
        self.hint_row.set_subtitle("Draw a colored highlight border around the focused window")
        tiling_group.add(self.hint_row)

        # Show title
        self.title_row = Adw.SwitchRow()
        self.title_row.set_title("Show Window Titles")
        self.title_row.set_subtitle("Show traditional title bars on tiled windows")
        tiling_group.add(self.title_row)

        # Snap to grid
        self.snap_row = Adw.SwitchRow()
        self.snap_row.set_title("Snap to Grid on Drag")
        self.snap_row.set_subtitle("Snap windows into the tiling grid when dragging with the mouse")
        tiling_group.add(self.snap_row)

        # Group: Window Gaps
        gaps_group = Adw.PreferencesGroup()
        gaps_group.set_title("Window Gaps")
        gaps_group.set_description("Adjust spacing between windows and screen edges in pixels")
        self.add(gaps_group)

        # Inner gap
        self.inner_gap_row = Adw.SpinRow()
        self.inner_gap_row.set_title("Inner Gaps")
        self.inner_gap_row.set_subtitle("Distance between adjacent tiled windows")
        inner_adj = Gtk.Adjustment(value=2, lower=0, upper=64, step_increment=1, page_increment=4)
        self.inner_gap_row.set_adjustment(inner_adj)
        gaps_group.add(self.inner_gap_row)

        # Outer gap
        self.outer_gap_row = Adw.SpinRow()
        self.outer_gap_row.set_title("Outer Gaps")
        self.outer_gap_row.set_subtitle("Distance between windows and screen edges")
        outer_adj = Gtk.Adjustment(value=2, lower=0, upper=64, step_increment=1, page_increment=4)
        self.outer_gap_row.set_adjustment(outer_adj)
        gaps_group.add(self.outer_gap_row)

        # Smart gaps
        self.smart_gaps_row = Adw.SwitchRow()
        self.smart_gaps_row.set_title("Smart Gaps")
        self.smart_gaps_row.set_subtitle("Hide outer gaps when only one window is open on the workspace")
        gaps_group.add(self.smart_gaps_row)

        self._bind_settings()

    def _bind_settings(self):
        if self.settings is None:
            return

        self.settings.bind("tile-by-default", self.tile_default_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("active-hint", self.hint_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("show-title", self.title_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("snap-to-grid", self.snap_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("smart-gaps", self.smart_gaps_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("gap-inner", self.inner_gap_row, "value", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("gap-outer", self.outer_gap_row, "value", Gio.SettingsBindFlags.DEFAULT)
