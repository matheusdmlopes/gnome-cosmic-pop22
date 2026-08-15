"""Tests for dynamic GTK theme and icon pack discovery.

Discovery walks real directories, so every test builds a throwaway tree under
tmp_path and passes it in explicitly. Nothing here touches the live system.
"""

from pathlib import Path

from pop_settings.theme_helper import (
    default_gtk_theme_dirs,
    default_icon_theme_dirs,
    discover_gtk_themes,
    discover_icon_themes,
)


def make_gtk_theme(root: Path, name: str, version: str = "gtk-4.0") -> Path:
    theme = root / name / version
    theme.mkdir(parents=True)
    (theme / "gtk.css").write_text("/* test theme */")
    return root / name


def make_icon_theme(root: Path, name: str) -> Path:
    theme = root / name
    theme.mkdir(parents=True)
    (theme / "index.theme").write_text("[Icon Theme]\nName=%s\n" % name)
    return theme


# ======================================================================
# GTK theme discovery
# ======================================================================


class TestGtkThemeDiscovery:
    def test_missing_directory_yields_nothing(self, tmp_path):
        assert discover_gtk_themes([tmp_path / "does-not-exist"]) == []

    def test_empty_directory_yields_nothing(self, tmp_path):
        assert discover_gtk_themes([tmp_path]) == []

    def test_finds_a_gtk4_theme(self, tmp_path):
        make_gtk_theme(tmp_path, "Pop", "gtk-4.0")
        assert discover_gtk_themes([tmp_path]) == ["Pop"]

    def test_finds_a_gtk3_theme(self, tmp_path):
        make_gtk_theme(tmp_path, "Yaru", "gtk-3.0")
        assert discover_gtk_themes([tmp_path]) == ["Yaru"]

    def test_ignores_directory_without_gtk_subdir(self, tmp_path):
        (tmp_path / "NotATheme").mkdir()
        assert discover_gtk_themes([tmp_path]) == []

    def test_ignores_loose_files(self, tmp_path):
        (tmp_path / "README").write_text("not a theme")
        assert discover_gtk_themes([tmp_path]) == []

    def test_merges_multiple_directories(self, tmp_path):
        system = tmp_path / "system"
        user = tmp_path / "user"
        make_gtk_theme(system, "Yaru")
        make_gtk_theme(user, "Nordic")
        assert discover_gtk_themes([system, user]) == ["Nordic", "Yaru"]

    def test_deduplicates_a_theme_present_in_two_directories(self, tmp_path):
        system = tmp_path / "system"
        user = tmp_path / "user"
        make_gtk_theme(system, "Pop")
        make_gtk_theme(user, "Pop")
        assert discover_gtk_themes([system, user]) == ["Pop"]

    def test_pop_and_adwaita_are_listed_first(self, tmp_path):
        for name in ["Zukitre", "Adwaita", "Arc", "Pop-dark", "Pop"]:
            make_gtk_theme(tmp_path, name)

        found = discover_gtk_themes([tmp_path])

        assert found[:3] == ["Pop", "Pop-dark", "Adwaita"]

    def test_remaining_themes_are_alphabetical(self, tmp_path):
        for name in ["Zukitre", "Adwaita", "Arc", "Pop"]:
            make_gtk_theme(tmp_path, name)

        found = discover_gtk_themes([tmp_path])

        assert found == ["Pop", "Adwaita", "Arc", "Zukitre"]

    def test_priority_names_absent_from_disk_are_not_invented(self, tmp_path):
        make_gtk_theme(tmp_path, "Arc")
        assert discover_gtk_themes([tmp_path]) == ["Arc"]


# ======================================================================
# Icon theme discovery
# ======================================================================


class TestIconThemeDiscovery:
    def test_missing_directory_yields_nothing(self, tmp_path):
        assert discover_icon_themes([tmp_path / "nope"]) == []

    def test_finds_theme_with_index_file(self, tmp_path):
        make_icon_theme(tmp_path, "Pop")
        assert discover_icon_themes([tmp_path]) == ["Pop"]

    def test_ignores_directory_without_index_file(self, tmp_path):
        (tmp_path / "loose-icons").mkdir()
        assert discover_icon_themes([tmp_path]) == []

    def test_ignores_the_default_cursor_pseudo_theme(self, tmp_path):
        make_icon_theme(tmp_path, "default")
        make_icon_theme(tmp_path, "Pop")
        assert discover_icon_themes([tmp_path]) == ["Pop"]

    def test_pop_and_adwaita_are_listed_first(self, tmp_path):
        for name in ["Papirus", "Adwaita", "Pop", "Numix"]:
            make_icon_theme(tmp_path, name)

        found = discover_icon_themes([tmp_path])

        assert found[:2] == ["Pop", "Adwaita"]
        assert found[2:] == ["Numix", "Papirus"]

    def test_capitalised_pop_dark_icon_theme_is_prioritised(self, tmp_path):
        """The icon theme ships as "Pop-Dark", not "Pop-dark" like the GTK
        theme, and must still float to the top of the list."""
        for name in ["Papirus", "Pop-Dark", "Pop"]:
            make_icon_theme(tmp_path, name)

        assert discover_icon_themes([tmp_path]) == ["Pop", "Pop-Dark", "Papirus"]

    def test_deduplicates_across_directories(self, tmp_path):
        system = tmp_path / "system"
        user = tmp_path / "user"
        make_icon_theme(system, "Pop")
        make_icon_theme(user, "Pop")
        assert discover_icon_themes([system, user]) == ["Pop"]


# ======================================================================
# Default search paths
# ======================================================================


class TestDefaultDirectories:
    def test_gtk_dirs_cover_system_and_user_locations(self):
        dirs = [str(p) for p in default_gtk_theme_dirs()]
        assert "/usr/share/themes" in dirs
        assert any(d.endswith("/.themes") for d in dirs)
        assert any(d.endswith("/.local/share/themes") for d in dirs)

    def test_icon_dirs_cover_system_and_user_locations(self):
        dirs = [str(p) for p in default_icon_theme_dirs()]
        assert "/usr/share/icons" in dirs
        assert any(d.endswith("/.icons") for d in dirs)
        assert any(d.endswith("/.local/share/icons") for d in dirs)

    def test_discovery_without_arguments_uses_defaults(self):
        # Runs against the real system: must not raise and must return a list.
        assert isinstance(discover_gtk_themes(), list)
        assert isinstance(discover_icon_themes(), list)
