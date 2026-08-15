"""Tests for the dynamic theme selection on the Appearance page.

Theme lists are injected so the assertions do not depend on what happens to
be installed on the machine running the suite. The page is only ever read
here: no test changes a selection, so the developer's real GTK and icon
themes are never written to.
"""

import gi

gi.require_version("Gtk", "4.0")
gi.require_version("Adw", "1")
from gi.repository import Adw

from pop_settings.pages.appearance import AppearancePage


def model_items(combo_row) -> list[str]:
    model = combo_row.get_model()
    return [model.get_string(i) for i in range(model.get_n_items())]


class TestGtkThemeRow:
    def test_is_a_combo_row(self):
        page = AppearancePage(gtk_themes=["Pop", "Adwaita"], icon_themes=["Pop"])
        assert isinstance(page.gtk_theme_row, Adw.ComboRow)

    def test_lists_the_discovered_themes_in_order(self):
        page = AppearancePage(
            gtk_themes=["Pop", "Pop-dark", "Adwaita", "Arc"],
            icon_themes=["Pop"],
        )
        assert model_items(page.gtk_theme_row) == ["Pop", "Pop-dark", "Adwaita", "Arc"]

    def test_empty_discovery_still_lists_the_active_theme(self):
        page = AppearancePage(gtk_themes=[], icon_themes=[])
        if page.settings is None:
            assert model_items(page.gtk_theme_row) == []
            return

        active = page.settings.get_string("gtk-theme")
        assert model_items(page.gtk_theme_row) == [active]


class TestIconThemeRow:
    def test_is_a_combo_row(self):
        page = AppearancePage(gtk_themes=["Pop"], icon_themes=["Pop", "Adwaita"])
        assert isinstance(page.icon_theme_row, Adw.ComboRow)

    def test_lists_the_discovered_icon_packs_in_order(self):
        page = AppearancePage(
            gtk_themes=["Pop"],
            icon_themes=["Pop", "Adwaita", "Papirus"],
        )
        assert model_items(page.icon_theme_row) == ["Pop", "Adwaita", "Papirus"]


class TestSelectionReflectsSettings:
    def test_selects_the_active_gtk_theme(self):
        page = AppearancePage(gtk_themes=["Pop"], icon_themes=["Pop"])
        if page.settings is None:
            return  # no org.gnome.desktop.interface schema on this machine

        active = page.settings.get_string("gtk-theme")
        page = AppearancePage(
            gtk_themes=["Decoy", active, "Other"],
            icon_themes=["Pop"],
        )
        assert page.gtk_theme_row.get_selected() == 1

    def test_selects_the_active_icon_theme(self):
        page = AppearancePage(gtk_themes=["Pop"], icon_themes=["Pop"])
        if page.settings is None:
            return

        active = page.settings.get_string("icon-theme")
        page = AppearancePage(
            gtk_themes=["Pop"],
            icon_themes=["Decoy", active, "Other"],
        )
        assert page.icon_theme_row.get_selected() == 1

    def test_active_theme_outside_the_list_is_appended_and_selected(self):
        """Adw.ComboRow always shows some row, so an undiscovered active
        theme must be added to the list instead of the row silently
        displaying a different theme than the one in use."""
        page = AppearancePage(gtk_themes=[], icon_themes=[])
        if page.settings is None:
            return

        active_gtk = page.settings.get_string("gtk-theme")
        active_icon = page.settings.get_string("icon-theme")

        page = AppearancePage(
            gtk_themes=["Definitely-Not-Installed-A"],
            icon_themes=["Definitely-Not-Installed-B"],
        )

        assert model_items(page.gtk_theme_row)[-1] == active_gtk
        assert page.gtk_theme_row.get_selected() == 1
        assert model_items(page.icon_theme_row)[-1] == active_icon
        assert page.icon_theme_row.get_selected() == 1


class TestDefaultDiscovery:
    def test_page_builds_without_injected_lists(self):
        page = AppearancePage()
        assert isinstance(page.gtk_theme_row, Adw.ComboRow)
        assert isinstance(page.icon_theme_row, Adw.ComboRow)
