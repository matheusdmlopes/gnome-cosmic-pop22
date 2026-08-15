from gi.repository import Adw, Gtk
from pop_settings.pages import (
    DesktopPage,
    WorkspacesPage,
    TilingPage,
    DockPage,
    AppearancePage,
)
from pop_settings.extension_monitor import ExtensionMonitor

class PopSettingsWindow(Adw.ApplicationWindow):
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_title("Pop Settings")
        self.set_default_size(860, 640)

        # Extension status monitor (D-Bus, gracefully degrades)
        self.extension_monitor = ExtensionMonitor()

        # Toolbar View
        toolbar_view = Adw.ToolbarView()
        self.set_content(toolbar_view)

        # Header Bar
        header_bar = Adw.HeaderBar()
        toolbar_view.add_top_bar(header_bar)

        # View Stack & Switcher
        self.view_stack = Adw.ViewStack()
        
        # View Switcher Title in Header
        view_switcher_title = Adw.ViewSwitcherTitle(
            stack=self.view_stack,
            title="Pop Settings"
        )
        header_bar.set_title_widget(view_switcher_title)

        # Bottom View Switcher Bar for compact screens
        view_switcher_bar = Adw.ViewSwitcherBar(stack=self.view_stack)
        toolbar_view.add_bottom_bar(view_switcher_bar)
        view_switcher_title.bind_property(
            "title-visible",
            view_switcher_bar,
            "reveal",
            0
        )

        # Add the 5 modular pages
        self.desktop_page = DesktopPage(extension_monitor=self.extension_monitor)
        self.workspaces_page = WorkspacesPage(extension_monitor=self.extension_monitor)
        self.tiling_page = TilingPage(extension_monitor=self.extension_monitor)
        self.dock_page = DockPage()
        self.appearance_page = AppearancePage()

        self.view_stack.add_titled_with_icon(
            self.desktop_page,
            "desktop",
            "Desktop",
            "preferences-desktop-display-symbolic"
        )
        self.view_stack.add_titled_with_icon(
            self.workspaces_page,
            "workspaces",
            "Workspaces",
            "view-paged-symbolic"
        )
        self.view_stack.add_titled_with_icon(
            self.tiling_page,
            "tiling",
            "Tiling",
            "preferences-desktop-windows-symbolic"
        )
        self.view_stack.add_titled_with_icon(
            self.dock_page,
            "dock",
            "Dock",
            "user-bookmarks-symbolic"
        )
        self.view_stack.add_titled_with_icon(
            self.appearance_page,
            "appearance",
            "Appearance",
            "preferences-desktop-appearance-symbolic"
        )

        toolbar_view.set_content(self.view_stack)
