"""Tests for the Pop Shell usability controls on the Tiling page."""

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw

from pop_settings.extension_monitor import (
    ExtensionMonitor,
    EXTENSION_STATE_DISABLED,
    EXTENSION_STATE_ENABLED,
)
from pop_settings.pages.tiling import TilingPage
from pop_settings.widgets import ExtensionStatusBanner


class TestWindowAndMouseBehavior:
    def test_stacking_with_mouse_row(self):
        page = TilingPage()
        assert isinstance(page.stacking_mouse_row, Adw.SwitchRow)

    def test_cursor_follows_active_window_row(self):
        page = TilingPage()
        assert isinstance(page.cursor_follows_row, Adw.SwitchRow)

    def test_fullscreen_launcher_row(self):
        page = TilingPage()
        assert isinstance(page.fullscreen_launcher_row, Adw.SwitchRow)

    def test_active_hint_border_radius_row(self):
        page = TilingPage()
        assert isinstance(page.hint_radius_row, Adw.SpinRow)

    def test_border_radius_ranges_from_zero_to_thirty(self):
        page = TilingPage()
        adjustment = page.hint_radius_row.get_adjustment()
        assert adjustment.get_lower() == 0
        assert adjustment.get_upper() == 30

    def test_border_radius_steps_by_one_pixel(self):
        page = TilingPage()
        assert page.hint_radius_row.get_adjustment().get_step_increment() == 1


class TestTilingPageBanner:
    def test_has_an_extension_banner(self):
        page = TilingPage()
        assert isinstance(page.extension_banner, ExtensionStatusBanner)

    def test_banner_hidden_without_a_monitor(self):
        page = TilingPage()
        assert page.extension_banner.is_revealed() is False

    def test_banner_revealed_when_pop_shell_is_inactive(self):
        monitor = ExtensionMonitor(autostart=False)
        page = TilingPage(extension_monitor=monitor)
        assert page.extension_banner.is_revealed() is True

    def test_banner_tracks_pop_shell(self):
        monitor = ExtensionMonitor(autostart=False)
        page = TilingPage(extension_monitor=monitor)

        monitor._notify_listeners("pop-shell@system76.com", EXTENSION_STATE_ENABLED)
        assert page.extension_banner.is_revealed() is False

        monitor._notify_listeners("pop-shell@system76.com", EXTENSION_STATE_DISABLED)
        assert page.extension_banner.is_revealed() is True

    def test_banner_ignores_other_extensions(self):
        monitor = ExtensionMonitor(autostart=False)
        page = TilingPage(extension_monitor=monitor)

        monitor._notify_listeners("pop-cosmic@system76.com", EXTENSION_STATE_ENABLED)

        assert page.extension_banner.is_revealed() is True

    def test_banner_mentions_the_tiling_extension(self):
        page = TilingPage()
        assert "Pop Shell" in page.extension_banner.banner.get_title()


class TestExistingControlsStillPresent:
    def test_original_tiling_rows_survive(self):
        page = TilingPage()
        assert page.tile_default_row is not None
        assert page.hint_row is not None
        assert page.title_row is not None
        assert page.snap_row is not None
        assert page.inner_gap_row is not None
        assert page.outer_gap_row is not None
        assert page.smart_gaps_row is not None
