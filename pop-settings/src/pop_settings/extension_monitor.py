"""Monitor GNOME Shell extension status via D-Bus.

Provides a resilient helper that queries the org.gnome.Shell.Extensions
interface and listens for real-time status change signals. Gracefully
degrades when D-Bus is unavailable (e.g., in test environments or
non-GNOME sessions).
"""

from __future__ import annotations

from typing import Callable, Optional

from gi.repository import Gio, GLib


# Extension state constants from GNOME Shell's ExtensionState enum.
EXTENSION_STATE_ENABLED: int = 1
EXTENSION_STATE_DISABLED: int = 2
EXTENSION_STATE_ERROR: int = 3
EXTENSION_STATE_OUT_OF_DATE: int = 4
EXTENSION_STATE_DOWNLOADING: int = 5
EXTENSION_STATE_INITIALIZED: int = 6
EXTENSION_STATE_UNINSTALLED: int = 99

_DBUS_NAME = "org.gnome.Shell.Extensions"
_DBUS_PATH = "/org/gnome/Shell/Extensions"
_DBUS_INTERFACE = "org.gnome.Shell.Extensions"

# Callback type: receives (uuid: str, state: int)
StatusCallback = Callable[[str, int], None]


class ExtensionMonitor:
    """Monitors GNOME Shell extension states over D-Bus.

    Connects asynchronously to the org.gnome.Shell.Extensions interface
    and caches extension states. Listeners can register callbacks to be
    notified when an extension status changes.

    When D-Bus is unavailable, all queries return safe defaults
    (UNINSTALLED / False) and no errors are raised.
    """

    def __init__(self, autostart: bool = True) -> None:
        self._proxy: Optional[Gio.DBusProxy] = None
        self._states: dict[str, int] = {}
        self._callbacks: list[StatusCallback] = []
        self._signal_subscription_id: int = 0

        if autostart:
            self._connect()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_extension_state(self, uuid: str) -> int:
        """Return the cached state for *uuid*, or UNINSTALLED if unknown."""
        return self._states.get(uuid, EXTENSION_STATE_UNINSTALLED)

    def is_extension_active(self, uuid: str) -> bool:
        """Return True only when the extension is in the ENABLED state."""
        return self.get_extension_state(uuid) == EXTENSION_STATE_ENABLED

    def connect_status_changed(self, callback: StatusCallback) -> None:
        """Register a *callback* invoked on every status change.

        The callback signature is ``(uuid: str, state: int) -> None``.
        """
        self._callbacks.append(callback)

    def disconnect_status_changed(self, callback: StatusCallback) -> None:
        """Remove a previously registered *callback*."""
        try:
            self._callbacks.remove(callback)
        except ValueError:
            pass

    def refresh(self) -> None:
        """Re-query all extension states from D-Bus (synchronous)."""
        if self._proxy is None:
            return
        self._fetch_all_extensions()

    # ------------------------------------------------------------------
    # D-Bus connection helpers
    # ------------------------------------------------------------------

    def _connect(self) -> None:
        """Create the D-Bus proxy and initialize extension states."""
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_sync(
                Gio.BusType.SESSION,
                Gio.DBusProxyFlags.NONE,
                None,  # GDBusInterfaceInfo
                _DBUS_NAME,
                _DBUS_PATH,
                _DBUS_INTERFACE,
                None,  # GCancellable
            )
            self._fetch_all_extensions()
            self._subscribe_signals()
        except Exception:
            # Fallback to async creation if sync blocks or fails
            try:
                Gio.DBusProxy.new_for_bus(
                    Gio.BusType.SESSION,
                    Gio.DBusProxyFlags.NONE,
                    None,  # GDBusInterfaceInfo
                    _DBUS_NAME,
                    _DBUS_PATH,
                    _DBUS_INTERFACE,
                    None,  # GCancellable
                    self._on_proxy_ready,
                )
            except Exception:
                self._proxy = None

    def _subscribe_signals(self) -> None:
        """Subscribe to the ExtensionStatusChanged signal."""
        if self._proxy is None or self._signal_subscription_id != 0:
            return
        connection = self._proxy.get_connection()
        if connection is not None:
            self._signal_subscription_id = connection.signal_subscribe(
                _DBUS_NAME,
                _DBUS_INTERFACE,
                "ExtensionStatusChanged",
                _DBUS_PATH,
                None,  # arg0
                Gio.DBusSignalFlags.NONE,
                self._on_extension_status_changed,
            )

    def _on_proxy_ready(
        self,
        source_object: Gio.DBusProxy,
        result: Gio.AsyncResult,
        user_data: object = None,
    ) -> None:
        """Callback fired when the async proxy creation finishes."""
        try:
            self._proxy = Gio.DBusProxy.new_for_bus_finish(result)
        except GLib.Error:
            self._proxy = None
            return

        if self._proxy is None:
            return

        # Fetch initial states.
        self._fetch_all_extensions()
        self._subscribe_signals()

        # Notify any listeners that registered callbacks before the proxy was ready
        for uuid, state in self._states.items():
            self._notify_listeners(uuid, state)

    # ------------------------------------------------------------------
    # Data fetching
    # ------------------------------------------------------------------

    def _fetch_all_extensions(self) -> None:
        """Call ListExtensions() and populate the state cache."""
        if self._proxy is None:
            return
        try:
            result = self._proxy.call_sync(
                "ListExtensions",
                None,  # no parameters
                Gio.DBusCallFlags.NONE,
                500,  # timeout ms
                None,  # GCancellable
            )
            if result is not None:
                extensions_dict = result.unpack()[0]
                for uuid, info in extensions_dict.items():
                    state = info.get("state", EXTENSION_STATE_UNINSTALLED)
                    self._states[uuid] = state
        except (GLib.Error, Exception):
            pass

    def get_extension_info(self, uuid: str) -> Optional[dict]:
        """Call GetExtensionInfo(uuid) and return the info dict, or None."""
        if self._proxy is None:
            return None
        try:
            result = self._proxy.call_sync(
                "GetExtensionInfo",
                GLib.Variant("(s)", (uuid,)),
                Gio.DBusCallFlags.NONE,
                500,
                None,
            )
            if result is not None:
                return result.unpack()[0]
        except (GLib.Error, Exception):
            pass
        return None

    # ------------------------------------------------------------------
    # Signal handler
    # ------------------------------------------------------------------

    def _on_extension_status_changed(
        self,
        connection: Gio.DBusConnection,
        sender_name: Optional[str],
        object_path: str,
        interface_name: str,
        signal_name: str,
        parameters: GLib.Variant,
        user_data: object = None,
    ) -> None:
        """Handle the ExtensionStatusChanged D-Bus signal."""
        try:
            uuid, state_variant = parameters.unpack()
            # state_variant may be a dict with 'state' key or an int directly.
            if isinstance(state_variant, dict):
                state = state_variant.get("state", EXTENSION_STATE_UNINSTALLED)
            else:
                state = int(state_variant)
        except (ValueError, TypeError):
            return

        old_state = self._states.get(uuid, EXTENSION_STATE_UNINSTALLED)
        self._states[uuid] = state

        if old_state != state:
            self._notify_listeners(uuid, state)

    def _notify_listeners(self, uuid: str, state: int) -> None:
        """Invoke all registered callbacks with the changed extension info."""
        for callback in self._callbacks:
            try:
                callback(uuid, state)
            except Exception:
                # Never let a broken listener crash the monitor.
                pass
