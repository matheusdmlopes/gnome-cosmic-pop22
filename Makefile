SHELL := /bin/bash

# PREFIX is the runtime install prefix; DESTDIR is the staging root used by
# package builders. Paths on disk are $(DESTDIR)$(PREFIX)/..., while paths
# baked into generated files use $(PREFIX) alone.
PREFIX ?= $(HOME)/.local
DESTDIR ?=

EXTENSIONS_DIR := $(DESTDIR)$(PREFIX)/share/gnome-shell/extensions
SCHEMAS_DIR := $(DESTDIR)$(PREFIX)/share/glib-2.0/schemas
APPLICATIONS_DIR := $(DESTDIR)$(PREFIX)/share/applications
ICONS_DIR := $(DESTDIR)$(PREFIX)/share/icons
THEMES_DIR := $(DESTDIR)$(PREFIX)/share/themes
BACKGROUNDS_DIR := $(DESTDIR)$(PREFIX)/share/backgrounds
SOUNDS_DIR := $(DESTDIR)$(PREFIX)/share/sounds
# The Pop shell theme drops Pop-named files alongside GNOME's own theme, which
# lives in gnome-shell-theme.gresource and is never touched.
SHELL_THEME_DIR := $(DESTDIR)$(PREFIX)/share/gnome-shell/theme
BIN_DIR := $(DESTDIR)$(PREFIX)/bin
SETTINGS_LIB_DIR := $(DESTDIR)$(PREFIX)/share/pop-settings
SETTINGS_LIB_RUNTIME := $(PREFIX)/share/pop-settings

COSMIC_UUID := pop-cosmic@system76.com
WORKSPACES_UUID := cosmic-workspaces@system76.com
SHELL_UUID := pop-shell@system76.com

# pop-launcher follows the upstream layout: a system install puts plugins
# under /usr/lib, a user install under the prefix's share directory.
ifeq ($(PREFIX),/usr)
LAUNCHER_LIB_DIR := $(DESTDIR)/usr/lib/pop-launcher
else
LAUNCHER_LIB_DIR := $(DESTDIR)$(PREFIX)/share/pop-launcher
endif
LAUNCHER_PLUGIN_DIR := $(LAUNCHER_LIB_DIR)/plugins
LAUNCHER_SCRIPTS_DIR := $(LAUNCHER_LIB_DIR)/scripts
LAUNCHER_BIN := $(BIN_DIR)/pop-launcher
LAUNCHER_PLUGINS := calc desktop_entries files find pop_shell pulse recent scripts terminal web cosmic_toplevel

.PHONY: all build build-shell build-launcher test test-syntax test-schemas test-desktop test-python \
        install install-cosmic install-workspaces install-shell install-settings install-launcher \
        install-themes install-wallpapers install-all uninstall clean

all: build

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build:
	@echo "Compiling GSettings schemas..."
	@glib-compile-schemas --strict cosmic/schemas/
	@glib-compile-schemas --strict cosmic-workspaces/schemas/
	@glib-compile-schemas --strict shell/schemas/

build-shell:
	@if ! command -v tsc >/dev/null; then \
		echo "error: TypeScript (tsc) is required to build pop-shell"; \
		exit 1; \
	fi
	@echo "Transpiling pop-shell TypeScript sources..."
	@$(MAKE) -C shell compile

build-launcher:
	@if ! command -v cargo >/dev/null; then \
		echo "error: cargo is required to build pop-launcher"; \
		exit 1; \
	fi
	@echo "Building pop-launcher (release)..."
	@cd launcher && cargo build -p pop-launcher-bin --release

# ---------------------------------------------------------------------------
# Test - the three validation seams
# ---------------------------------------------------------------------------

test: test-schemas test-syntax test-desktop test-python

# Seam 1a: strict GSettings schema compilation.
test-schemas:
	@echo "Validating GSettings schemas (strict)..."
	@glib-compile-schemas --strict --dry-run cosmic/schemas/
	@glib-compile-schemas --strict --dry-run cosmic-workspaces/schemas/
	@glib-compile-schemas --strict --dry-run shell/schemas/

# Seam 1b: static ESM syntax validation under the GJS engine itself.
# The file list is globbed by the shell at recipe time, not by $(wildcard) at
# parse time, so sources that build-shell has just generated are included.
test-syntax: build-shell
	@echo "Validating extension ESM syntax with gjs..."
	@gjs -c "$$(cat scripts/check-js-syntax.js)" -- cosmic/*.js cosmic-workspaces/*.js shell/_build/*.js

# Seam 3: desktop entry validation.
test-desktop:
	@echo "Validating desktop entries..."
	@desktop-file-validate pop-settings/data/pop-settings.desktop

# Seam 2: Pop Settings application test suite.
#
# The tests build real GTK4/Libadwaita widgets, and GTK4 segfaults when it
# constructs a widget with no display at all. In a graphical session that is
# free; on a headless runner the suite goes through Xvfb.
test-python:
	@echo "Running pop-settings test suite..."
	@if [ -n "$$DISPLAY" ] || [ -n "$$WAYLAND_DISPLAY" ]; then \
		cd pop-settings && uv run pytest -q; \
	elif command -v xvfb-run >/dev/null; then \
		cd pop-settings && xvfb-run -a uv run pytest -q; \
	else \
		echo "error: the widget tests need a display; install xvfb or run inside a graphical session"; \
		exit 1; \
	fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

install: install-cosmic install-workspaces install-shell install-settings install-launcher install-themes
	@echo ""
	@echo "Pop COSMIC Suite installed under $(PREFIX)."
	@echo "Restart GNOME Shell (Alt+F2 -> r, or log out and back in on Wayland)."

install-cosmic: build
	@echo "Installing pop-cosmic extension..."
	@install -d $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@cp -rf cosmic/*.js cosmic/*.css cosmic/metadata.json cosmic/schemas $(EXTENSIONS_DIR)/$(COSMIC_UUID)/
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 cosmic/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@install -d $(APPLICATIONS_DIR) $(ICONS_DIR)
	@cp -rf cosmic/usr/share/applications/. $(APPLICATIONS_DIR)/
	@cp -rf cosmic/usr/share/icons/. $(ICONS_DIR)/
	@glib-compile-schemas $(SCHEMAS_DIR)

install-workspaces: build
	@echo "Installing cosmic-workspaces extension..."
	@install -d $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@cp -rf cosmic-workspaces/*.js cosmic-workspaces/*.css cosmic-workspaces/metadata.json cosmic-workspaces/schemas $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 cosmic-workspaces/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@glib-compile-schemas $(SCHEMAS_DIR)

install-shell: build-shell
	@echo "Installing pop-shell extension..."
	@install -d $(EXTENSIONS_DIR)/$(SHELL_UUID)
	@cp -rf shell/_build/. $(EXTENSIONS_DIR)/$(SHELL_UUID)/
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 shell/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@glib-compile-schemas $(SCHEMAS_DIR)

install-settings:
	@echo "Installing Pop Settings application..."
	@install -d $(SETTINGS_LIB_DIR)
	@cp -rf pop-settings/src/pop_settings $(SETTINGS_LIB_DIR)/
	@find $(SETTINGS_LIB_DIR) -name '__pycache__' -type d -exec rm -rf {} + 2>/dev/null || true
	@install -d $(BIN_DIR)
	@sed 's|@PYTHON_LIB@|$(SETTINGS_LIB_RUNTIME)|g' pop-settings/data/pop-settings.in > $(BIN_DIR)/pop-settings
	@chmod 0755 $(BIN_DIR)/pop-settings
	@install -d $(APPLICATIONS_DIR)
	@install -m 0644 pop-settings/data/pop-settings.desktop $(APPLICATIONS_DIR)/

install-launcher: build-launcher
	@echo "Installing pop-launcher..."
	@install -Dm0755 launcher/target/release/pop-launcher-bin $(LAUNCHER_BIN)
	@for plugin in $(LAUNCHER_PLUGINS); do \
		dest=$(LAUNCHER_PLUGIN_DIR)/$${plugin}; \
		install -d $${dest}; \
		install -m 0644 launcher/plugins/src/$${plugin}/*.ron $${dest}/; \
		ln -srf $(LAUNCHER_BIN) $${dest}/$$(echo $${plugin} | tr '_' '-'); \
	done
	@install -d $(LAUNCHER_SCRIPTS_DIR)
	@cp -rf launcher/scripts/. $(LAUNCHER_SCRIPTS_DIR)/

# The GTK theme is a Meson project: it compiles Sass into the Pop and
# Pop-dark stylesheets, the GNOME Shell theme and the Pop sound theme. The
# icon theme ships ready-to-install directories, so those are copied directly.
install-themes:
	@if ! command -v meson >/dev/null || ! command -v sassc >/dev/null; then \
		echo "error: meson and sassc are required to build the Pop GTK theme"; \
		exit 1; \
	fi
	@echo "Building and installing Pop GTK theme..."
	@meson setup --prefix=$(PREFIX) gtk-theme/_build gtk-theme >/dev/null \
		|| meson setup --reconfigure --prefix=$(PREFIX) gtk-theme/_build gtk-theme >/dev/null
	@DESTDIR=$(DESTDIR) meson install -C gtk-theme/_build >/dev/null
	@echo "Installing Pop icon theme..."
	@install -d $(ICONS_DIR)
	@cp -rf pop-icon-theme/Pop pop-icon-theme/Pop-Dark $(ICONS_DIR)/
	@gtk-update-icon-cache -qtf $(ICONS_DIR)/Pop 2>/dev/null || true
	@gtk-update-icon-cache -qtf $(ICONS_DIR)/Pop-Dark 2>/dev/null || true

install-wallpapers:
	@echo "Installing Pop wallpapers..."
	@install -d $(BACKGROUNDS_DIR)
	@cp -rf wallpapers/* $(BACKGROUNDS_DIR)/ 2>/dev/null || true

install-all: install install-wallpapers

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------

uninstall:
	@echo "Removing Pop COSMIC Suite from $(PREFIX)..."
	@rm -rf $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@rm -rf $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@rm -rf $(EXTENSIONS_DIR)/$(SHELL_UUID)
	@rm -f $(SCHEMAS_DIR)/org.gnome.shell.extensions.pop-cosmic.gschema.xml
	@rm -f $(SCHEMAS_DIR)/org.gnome.shell.extensions.cosmic-workspaces.gschema.xml
	@rm -f $(SCHEMAS_DIR)/org.gnome.shell.extensions.pop-shell.gschema.xml
	@if [ -d $(SCHEMAS_DIR) ]; then glib-compile-schemas $(SCHEMAS_DIR); fi
	@rm -rf $(SETTINGS_LIB_DIR)
	@rm -f $(BIN_DIR)/pop-settings
	@rm -f $(APPLICATIONS_DIR)/pop-settings.desktop
	@rm -f $(APPLICATIONS_DIR)/pop-cosmic-applications.desktop
	@rm -f $(APPLICATIONS_DIR)/pop-cosmic-launcher.desktop
	@rm -f $(APPLICATIONS_DIR)/pop-cosmic-workspaces.desktop
	@rm -f $(ICONS_DIR)/hicolor/scalable/actions/pop-cosmic-applications.svg
	@rm -f $(ICONS_DIR)/hicolor/scalable/actions/pop-cosmic-launcher.svg
	@rm -f $(ICONS_DIR)/hicolor/scalable/actions/pop-cosmic-workspaces.svg
	@rm -f $(LAUNCHER_BIN)
	@rm -rf $(LAUNCHER_LIB_DIR)
	@rm -rf $(THEMES_DIR)/Pop $(THEMES_DIR)/Pop-dark
	@rm -rf $(ICONS_DIR)/Pop $(ICONS_DIR)/Pop-Dark
	@rm -rf $(SHELL_THEME_DIR)/Pop $(SHELL_THEME_DIR)/Pop-dark
	@rm -f $(SHELL_THEME_DIR)/pop.css $(SHELL_THEME_DIR)/pop-dark.css
	@rm -rf $(SOUNDS_DIR)/Pop
	@echo "Uninstall completed."

clean:
	@rm -f cosmic/schemas/gschemas.compiled
	@rm -f cosmic-workspaces/schemas/gschemas.compiled
	@rm -f shell/schemas/gschemas.compiled
	@rm -rf pop-settings/.pytest_cache
	@rm -rf gtk-theme/_build
	@$(MAKE) -C shell clean 2>/dev/null || true
