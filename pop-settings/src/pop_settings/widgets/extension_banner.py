"""Reusable status banner for a single GNOME Shell extension.

Pages that depend on an extension embed one of these at the top. The banner
reveals itself whenever the tracked extension leaves the ENABLED state, so a
setting that silently has no effect always comes with an explanation.
"""

from __future__ import annotations

from typing import Optional

from gi.repository import Adw

from pop_settings.extension_monitor import (
    EXTENSION_STATE_ENABLED,
    ExtensionMonitor,
)


class ExtensionStatusBanner(Adw.PreferencesGroup):
    """An untitled preferences group holding a single status banner.

    Wrapping the banner in a group lets a page add it with one call and have
    it land at the top of the page, above every real settings group.
    """

    def __init__(
        self,
        uuid: str,
        message: str,
        monitor: Optional[ExtensionMonitor] = None,
    ) -> None:
        super().__init__()

        self._uuid = uuid
        self._monitor = monitor

        self.banner = Adw.Banner()
        self.banner.set_title(message)
        self.banner.set_revealed(False)
        self.add(self.banner)

        if monitor is None:
            return

        self.banner.set_revealed(not monitor.is_extension_active(uuid))
        monitor.connect_status_changed(self._on_status_changed)

    def is_revealed(self) -> bool:
        """Return whether the warning is currently on screen."""
        return self.banner.get_revealed()

    def _on_status_changed(self, uuid: str, state: int) -> None:
        if uuid != self._uuid:
            return
        self.banner.set_revealed(state != EXTENSION_STATE_ENABLED)
