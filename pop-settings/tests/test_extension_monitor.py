"""Tests for ExtensionMonitor and page banner integration.

All tests run without a live GNOME Shell session; D-Bus interactions are
mocked or simply absent (the monitor gracefully degrades).
"""

import pytest
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk

from pop_settings.extension_monitor import (
    ExtensionMonitor,
    EXTENSION_STATE_ENABLED,
    EXTENSION_STATE_DISABLED,
    EXTENSION_STATE_ERROR,
    EXTENSION_STATE_UNINSTALLED,
)
from pop_settings.pages.desktop import DesktopPage
from pop_settings.pages.workspaces import WorkspacesPage


# ======================================================================
# ExtensionMonitor unit tests (D-Bus unavailable)
# ======================================================================


class TestExtensionMonitorWithoutDBus:
    """Verify safe defaults when D-Bus is not available."""

    def test_init_does_not_raise(self):
        """Creating a monitor without a session bus must not raise."""
        monitor = ExtensionMonitor(autostart=False)
        assert monitor is not None

    def test_get_extension_state_returns_uninstalled(self):
        """Unknown extensions default to UNINSTALLED."""
        monitor = ExtensionMonitor(autostart=False)
        state = monitor.get_extension_state("nonexistent@example.com")
        assert state == EXTENSION_STATE_UNINSTALLED

    def test_is_extension_active_returns_false(self):
        """Without D-Bus data, no extension is considered active."""
        monitor = ExtensionMonitor(autostart=False)
        assert monitor.is_extension_active("pop-cosmic@system76.com") is False

    def test_refresh_does_not_raise(self):
        """Calling refresh with no proxy must be a no-op."""
        monitor = ExtensionMonitor(autostart=False)
        monitor.refresh()  # should not raise


# ======================================================================
# Callback mechanism tests
# ======================================================================


class TestExtensionMonitorCallbacks:
    """Verify the callback registration and invocation logic."""

    def test_connect_and_notify(self):
        """Registered callbacks receive status change notifications."""
        monitor = ExtensionMonitor(autostart=False)
        received: list[tuple[str, int]] = []

        def on_change(uuid: str, state: int) -> None:
            received.append((uuid, state))

        monitor.connect_status_changed(on_change)

        # Simulate an internal notification.
        monitor._notify_listeners("test@example.com", EXTENSION_STATE_ENABLED)

        assert len(received) == 1
        assert received[0] == ("test@example.com", EXTENSION_STATE_ENABLED)

    def test_disconnect_callback(self):
        """Disconnected callbacks are no longer invoked."""
        monitor = ExtensionMonitor(autostart=False)
        received: list[tuple[str, int]] = []

        def on_change(uuid: str, state: int) -> None:
            received.append((uuid, state))

        monitor.connect_status_changed(on_change)
        monitor.disconnect_status_changed(on_change)

        monitor._notify_listeners("test@example.com", EXTENSION_STATE_DISABLED)

        assert len(received) == 0

    def test_disconnect_unknown_callback_does_not_raise(self):
        """Disconnecting a callback that was never registered is harmless."""
        monitor = ExtensionMonitor(autostart=False)
        monitor.disconnect_status_changed(lambda u, s: None)

    def test_broken_callback_does_not_crash(self):
        """A callback that raises must not prevent other callbacks."""
        monitor = ExtensionMonitor(autostart=False)
        received: list[tuple[str, int]] = []

        def bad_callback(uuid: str, state: int) -> None:
            raise RuntimeError("oops")

        def good_callback(uuid: str, state: int) -> None:
            received.append((uuid, state))

        monitor.connect_status_changed(bad_callback)
        monitor.connect_status_changed(good_callback)

        monitor._notify_listeners("test@example.com", EXTENSION_STATE_ERROR)

        assert len(received) == 1

    def test_multiple_callbacks(self):
        """Multiple callbacks are all invoked in order."""
        monitor = ExtensionMonitor(autostart=False)
        call_order: list[int] = []

        monitor.connect_status_changed(lambda u, s: call_order.append(1))
        monitor.connect_status_changed(lambda u, s: call_order.append(2))

        monitor._notify_listeners("x@y.com", EXTENSION_STATE_ENABLED)

        assert call_order == [1, 2]


# ======================================================================
# DesktopPage banner integration tests
# ======================================================================


class TestDesktopPageBanner:
    """Verify the status banner on DesktopPage."""

    def test_has_extension_banner(self):
        """DesktopPage must expose an extension_banner component."""
        page = DesktopPage()
        assert hasattr(page, "extension_banner")
        assert isinstance(page.extension_banner.banner, Adw.Banner)

    def test_banner_not_revealed_without_monitor(self):
        """When no monitor is provided, the banner stays hidden."""
        page = DesktopPage()
        assert page.extension_banner.is_revealed() is False

    def test_banner_text(self):
        """The banner must display the correct warning message."""
        page = DesktopPage()
        assert "Pop COSMIC extension is not active" in page.extension_banner.banner.get_title()

    def test_banner_revealed_when_extension_inactive(self):
        """Banner is shown when the monitor reports the extension as inactive."""
        monitor = ExtensionMonitor(autostart=False)
        # No D-Bus, so is_extension_active returns False -> banner revealed.
        page = DesktopPage(extension_monitor=monitor)
        assert page.extension_banner.is_revealed() is True

    def test_banner_reacts_to_status_change(self):
        """Banner updates dynamically when the monitor fires a callback."""
        monitor = ExtensionMonitor(autostart=False)
        page = DesktopPage(extension_monitor=monitor)

        # Initially revealed (extension not active).
        assert page.extension_banner.is_revealed() is True

        # Simulate the extension becoming active.
        monitor._states["pop-cosmic@system76.com"] = EXTENSION_STATE_ENABLED
        monitor._notify_listeners("pop-cosmic@system76.com", EXTENSION_STATE_ENABLED)
        assert page.extension_banner.is_revealed() is False

        # Simulate the extension becoming disabled again.
        monitor._states["pop-cosmic@system76.com"] = EXTENSION_STATE_DISABLED
        monitor._notify_listeners("pop-cosmic@system76.com", EXTENSION_STATE_DISABLED)
        assert page.extension_banner.is_revealed() is True

    def test_banner_ignores_other_extensions(self):
        """Status changes for unrelated extensions must not affect the banner."""
        monitor = ExtensionMonitor(autostart=False)
        page = DesktopPage(extension_monitor=monitor)

        # Banner starts revealed because pop-cosmic is not active.
        assert page.extension_banner.is_revealed() is True

        # A different extension becoming enabled should not hide the banner.
        monitor._notify_listeners("other@example.com", EXTENSION_STATE_ENABLED)
        assert page.extension_banner.is_revealed() is True


# ======================================================================
# WorkspacesPage banner integration tests
# ======================================================================


class TestWorkspacesPageBanner:
    """Verify the status banner on WorkspacesPage."""

    def test_has_extension_banner(self):
        """WorkspacesPage must expose an extension_banner component."""
        page = WorkspacesPage()
        assert hasattr(page, "extension_banner")
        assert isinstance(page.extension_banner.banner, Adw.Banner)

    def test_banner_not_revealed_without_monitor(self):
        """When no monitor is provided, the banner stays hidden."""
        page = WorkspacesPage()
        assert page.extension_banner.is_revealed() is False

    def test_banner_text(self):
        """The banner must display the correct warning message."""
        page = WorkspacesPage()
        assert "Cosmic Workspaces extension is not active" in page.extension_banner.banner.get_title()

    def test_banner_revealed_when_extension_inactive(self):
        """Banner is shown when the monitor reports the extension as inactive."""
        monitor = ExtensionMonitor(autostart=False)
        page = WorkspacesPage(extension_monitor=monitor)
        assert page.extension_banner.is_revealed() is True

    def test_banner_reacts_to_status_change(self):
        """Banner updates dynamically when the monitor fires a callback."""
        monitor = ExtensionMonitor(autostart=False)
        page = WorkspacesPage(extension_monitor=monitor)

        assert page.extension_banner.is_revealed() is True

        monitor._states["cosmic-workspaces@system76.com"] = EXTENSION_STATE_ENABLED
        monitor._notify_listeners("cosmic-workspaces@system76.com", EXTENSION_STATE_ENABLED)
        assert page.extension_banner.is_revealed() is False

        monitor._states["cosmic-workspaces@system76.com"] = EXTENSION_STATE_DISABLED
        monitor._notify_listeners("cosmic-workspaces@system76.com", EXTENSION_STATE_DISABLED)
        assert page.extension_banner.is_revealed() is True

    def test_banner_ignores_other_extensions(self):
        """Status changes for unrelated extensions must not affect the banner."""
        monitor = ExtensionMonitor(autostart=False)
        page = WorkspacesPage(extension_monitor=monitor)

        assert page.extension_banner.is_revealed() is True

        monitor._notify_listeners("other@example.com", EXTENSION_STATE_ENABLED)
        assert page.extension_banner.is_revealed() is True
