import pytest
import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw, Gtk

from pop_settings.pages import (
    DesktopPage,
    WorkspacesPage,
    TilingPage,
    DockPage,
    AppearancePage,
)
from pop_settings.window import PopSettingsWindow
from pop_settings.app import PopSettingsApp

@pytest.fixture(scope="session")
def gtk_app():
    app = PopSettingsApp()
    return app

def test_desktop_page_init():
    page = DesktopPage()
    assert page.get_title() == "Desktop and Top Bar"
    assert page.workspaces_row is not None
    assert page.apps_row is not None
    assert page.clock_row is not None
    assert page.super_row is not None

def test_workspaces_page_init():
    page = WorkspacesPage()
    assert page.get_title() == "Workspaces"
    assert page.static_bg_row is not None
    assert page.scaling_bg_row is not None
    assert page.thumb_width_row is not None

def test_tiling_page_init():
    page = TilingPage()
    assert page.get_title() == "Tile Windows"
    assert page.tile_default_row is not None
    assert page.inner_gap_row is not None
    assert page.outer_gap_row is not None

def test_dock_page_init():
    page = DockPage()
    assert page.get_title() == "Dock"
    assert page.enable_dock_row is not None
    assert page.visibility_row is not None
    assert page.position_row is not None
    assert page.extend_height_row is not None
    assert page.multimonitor_row is not None
    assert page.icon_size_row is not None
    assert page.click_action_row is not None
    assert page.apps_item_row is not None
    assert page.launcher_item_row is not None
    assert page.workspaces_item_row is not None
    assert page.mounts_row is not None
    assert page.trash_row is not None

def test_appearance_page_init():
    page = AppearancePage()
    assert page.get_title() == "Appearance and Themes"
    assert page.dark_mode_row is not None

def test_window_init(gtk_app):
    win = PopSettingsWindow(application=gtk_app)
    assert win.get_title() == "Pop Settings"
    assert win.desktop_page is not None
    assert win.workspaces_page is not None
    assert win.tiling_page is not None
    assert win.dock_page is not None
    assert win.appearance_page is not None
