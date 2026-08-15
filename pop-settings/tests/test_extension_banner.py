"""Tests for the reusable ExtensionStatusBanner component.

The banner is a self-contained Adw.PreferencesGroup that reveals a warning
whenever the GNOME Shell extension it tracks is not in the ENABLED state.
"""

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw

from pop_settings.extension_monitor import (
    ExtensionMonitor,
    EXTENSION_STATE_DISABLED,
    EXTENSION_STATE_ENABLED,
    EXTENSION_STATE_ERROR,
)
from pop_settings.widgets import ExtensionStatusBanner


_UUID = "pop-cosmic@system76.com"
_MESSAGE = "Pop COSMIC extension is not active. Some settings may not take effect."


class TestBannerWithoutMonitor:
    """Without a monitor the component must stay inert and hidden."""

    def test_is_a_preferences_group(self):
        banner = ExtensionStatusBanner(_UUID, _MESSAGE)
        assert isinstance(banner, Adw.PreferencesGroup)

    def test_exposes_an_adw_banner(self):
        banner = ExtensionStatusBanner(_UUID, _MESSAGE)
        assert isinstance(banner.banner, Adw.Banner)

    def test_banner_carries_the_given_message(self):
        banner = ExtensionStatusBanner(_UUID, _MESSAGE)
        assert banner.banner.get_title() == _MESSAGE

    def test_stays_hidden(self):
        banner = ExtensionStatusBanner(_UUID, _MESSAGE)
        assert banner.is_revealed() is False


class TestBannerWithMonitor:
    """With a monitor the banner mirrors the tracked extension state."""

    def test_revealed_when_extension_is_not_active(self):
        monitor = ExtensionMonitor(autostart=False)
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)
        assert banner.is_revealed() is True

    def test_hidden_when_extension_is_already_enabled(self):
        monitor = ExtensionMonitor(autostart=False)
        monitor._states[_UUID] = EXTENSION_STATE_ENABLED
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)
        assert banner.is_revealed() is False

    def test_hides_when_extension_becomes_enabled(self):
        monitor = ExtensionMonitor(autostart=False)
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)

        monitor._notify_listeners(_UUID, EXTENSION_STATE_ENABLED)

        assert banner.is_revealed() is False

    def test_reveals_again_when_extension_is_disabled(self):
        monitor = ExtensionMonitor(autostart=False)
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)

        monitor._notify_listeners(_UUID, EXTENSION_STATE_ENABLED)
        monitor._notify_listeners(_UUID, EXTENSION_STATE_DISABLED)

        assert banner.is_revealed() is True

    def test_reveals_when_extension_errors_out(self):
        monitor = ExtensionMonitor(autostart=False)
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)

        monitor._notify_listeners(_UUID, EXTENSION_STATE_ENABLED)
        monitor._notify_listeners(_UUID, EXTENSION_STATE_ERROR)

        assert banner.is_revealed() is True

    def test_ignores_other_extensions(self):
        monitor = ExtensionMonitor(autostart=False)
        monitor._states[_UUID] = EXTENSION_STATE_ENABLED
        banner = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)

        monitor._notify_listeners("other@example.com", EXTENSION_STATE_DISABLED)

        assert banner.is_revealed() is False

    def test_two_banners_track_their_own_extension(self):
        monitor = ExtensionMonitor(autostart=False)
        cosmic = ExtensionStatusBanner(_UUID, _MESSAGE, monitor)
        shell = ExtensionStatusBanner("pop-shell@system76.com", "Tiling off", monitor)

        monitor._notify_listeners(_UUID, EXTENSION_STATE_ENABLED)

        assert cosmic.is_revealed() is False
        assert shell.is_revealed() is True
