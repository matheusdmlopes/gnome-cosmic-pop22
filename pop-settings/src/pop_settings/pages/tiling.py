from __future__ import annotations

from typing import Optional

from gi.repository import Adw, Gtk, Gio
from pop_settings.schema_helper import get_settings
from pop_settings.extension_monitor import ExtensionMonitor
from pop_settings.widgets import ExtensionStatusBanner

_POP_SHELL_UUID = "pop-shell@system76.com"


class TilingPage(Adw.PreferencesPage):
    """Pop Shell tiling window manager settings.

    Optionally receives an ExtensionMonitor so the status banner can warn
    when the pop-shell extension is not active in GNOME Shell.
    """

    def __init__(
        self,
        extension_monitor: Optional[ExtensionMonitor] = None,
    ) -> None:
        super().__init__()
        self.set_title("Tile Windows")
        self.set_icon_name("preferences-desktop-windows-symbolic")

        self.extension_banner = ExtensionStatusBanner(
            _POP_SHELL_UUID,
            "Pop Shell extension is not active. Tiling settings will not take effect.",
            extension_monitor,
        )
        self.add(self.extension_banner)

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

        # Group: Window and Mouse Behavior
        behavior_group = Adw.PreferencesGroup()
        behavior_group.set_title("Window and Mouse Behavior")
        behavior_group.set_description("Fine-tune how the pointer and the launcher interact with tiled windows")
        self.add(behavior_group)

        # Stacking with mouse
        self.stacking_mouse_row = Adw.SwitchRow()
        self.stacking_mouse_row.set_title("Stack Windows with the Mouse")
        self.stacking_mouse_row.set_subtitle("Drop a dragged window onto another to stack them in the same tile")
        behavior_group.add(self.stacking_mouse_row)

        # Cursor follows active window
        self.cursor_follows_row = Adw.SwitchRow()
        self.cursor_follows_row.set_title("Mouse Cursor Follows Active Window")
        self.cursor_follows_row.set_subtitle("Warp the pointer to the window focused by keyboard navigation")
        behavior_group.add(self.cursor_follows_row)

        # Launcher over fullscreen windows
        self.fullscreen_launcher_row = Adw.SwitchRow()
        self.fullscreen_launcher_row.set_title("Launcher Over Fullscreen Windows")
        self.fullscreen_launcher_row.set_subtitle("Allow the Pop Launcher to appear on top of fullscreen windows")
        behavior_group.add(self.fullscreen_launcher_row)

        # Active hint border radius
        self.hint_radius_row = Adw.SpinRow()
        self.hint_radius_row.set_title("Active Hint Border Radius")
        self.hint_radius_row.set_subtitle("Corner rounding of the focused window highlight, in pixels")
        radius_adj = Gtk.Adjustment(value=0, lower=0, upper=30, step_increment=1, page_increment=5)
        self.hint_radius_row.set_adjustment(radius_adj)
        behavior_group.add(self.hint_radius_row)

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
        self.settings.bind("stacking-with-mouse", self.stacking_mouse_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("mouse-cursor-follows-active-window", self.cursor_follows_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("fullscreen-launcher", self.fullscreen_launcher_row, "active", Gio.SettingsBindFlags.DEFAULT)
        self.settings.bind("active-hint-border-radius", self.hint_radius_row, "value", Gio.SettingsBindFlags.DEFAULT)
