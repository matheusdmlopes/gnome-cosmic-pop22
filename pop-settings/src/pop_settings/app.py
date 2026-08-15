import sys
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gio, GLib

from pop_settings.window import PopSettingsWindow

class PopSettingsApp(Adw.Application):
    def __init__(self):
        super().__init__(
            application_id="io.github.pop_os.CosmicSettings",
            flags=Gio.ApplicationFlags.DEFAULT_FLAGS
        )

    def do_activate(self):
        win = self.props.active_window
        if not win:
            win = PopSettingsWindow(application=self)
        win.present()

def main():
    app = PopSettingsApp()
    return app.run(sys.argv)

if __name__ == "__main__":
    sys.exit(main())
