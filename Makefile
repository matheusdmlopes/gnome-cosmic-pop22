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
DOC_DIR := $(DESTDIR)$(PREFIX)/share/doc/gnome-cosmic-pop22

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

.PHONY: all build build-release build-shell build-launcher test test-syntax test-launcher test-schemas test-desktop test-python \
        test-rust test-format test-clippy test-release-contract test-doctor test-install venv \
        install install-cosmic install-workspaces install-shell install-settings install-launcher \
        install-themes install-wallpapers install-all uninstall uninstall-wallpapers uninstall-all clean

all: build

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: test-schemas

build-release: build-shell build-launcher install-themes

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

test: test-schemas test-syntax test-launcher test-grid test-desktop test-python test-rust test-format test-clippy test-release-contract test-doctor

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

# Seam 1c: LauncherService lifecycle and subprocess observation under gjs.
test-launcher: build-shell
	@echo "Running LauncherService test suite with gjs..."
	@gjs -m scripts/test-launcher-service.js

# Seam 1d: applications grid arithmetic, the input St.Viewport turns into the
# drawer's scrollable extent.
test-grid:
	@echo "Running applications grid metrics test suite with gjs..."
	@gjs -m scripts/test-grid-metrics.js

# Seam 3: desktop entry validation.
test-desktop:
	@echo "Validating desktop entries..."
	@desktop-file-validate pop-settings/data/pop-settings.desktop

# PyGObject is a distribution package, so the virtualenv has to be built from
# the system interpreter with its site-packages visible. A venv that predates
# this rule (or a restored CI cache) is rebuilt rather than silently reused,
# since the alternative is an obscure "No module named 'gi'".
venv:
	@if [ ! -f pop-settings/.venv/pyvenv.cfg ] || \
	    ! grep -q 'include-system-site-packages = true' pop-settings/.venv/pyvenv.cfg; then \
		echo "Creating pop-settings virtualenv against the system Python..."; \
		rm -rf pop-settings/.venv; \
		cd pop-settings && uv venv --python python3 --system-site-packages; \
	fi

# Seam 2: Pop Settings application test suite.
#
# The tests build real GTK4/Libadwaita widgets, and GTK4 segfaults when it
# constructs a widget with no display at all. In a graphical session that is
# free; on a headless runner the suite goes through Xvfb.
test-python: venv
	@echo "Running pop-settings test suite..."
	@if [ -n "$$DISPLAY" ] || [ -n "$$WAYLAND_DISPLAY" ]; then \
		cd pop-settings && uv run pytest -q; \
	elif command -v xvfb-run >/dev/null; then \
		cd pop-settings && xvfb-run -a uv run pytest -q; \
	else \
		echo "error: the widget tests need a display; install xvfb or run inside a graphical session"; \
		exit 1; \
	fi

test-rust:
	@echo "Running deterministic Pop Launcher tests..."
	@cd launcher && cargo test --workspace --locked

test-format:
	@echo "Checking Rust formatting..."
	@cd launcher && cargo fmt --all -- --check

test-clippy:
	@echo "Running Clippy with warnings denied..."
	@cd launcher && cargo clippy --workspace --all-targets --locked -- -D warnings

test-release-contract:
	@bash scripts/test-release-contract.sh

test-doctor:
	@bash scripts/test-doctor.sh

# Exercises the public install/uninstall seam without touching the host.
test-install:
	@set -eu; \
	stage="$$(mktemp -d)"; \
	trap 'rm -rf "$$stage"' EXIT; \
	$(MAKE) install PREFIX=/usr DESTDIR="$$stage"; \
	test ! -e "$$stage/usr/share/glib-2.0/schemas/gschemas.compiled"; \
	for uuid in $(COSMIC_UUID) $(WORKSPACES_UUID) $(SHELL_UUID); do \
		test ! -d "$$stage/usr/share/gnome-shell/extensions/$$uuid/schemas"; \
	done; \
	$(MAKE) install-cosmic install-workspaces install-shell \
		PREFIX=/opt/pop-user DESTDIR="$$stage"; \
	for uuid in $(COSMIC_UUID) $(WORKSPACES_UUID) $(SHELL_UUID); do \
		test -f "$$stage/opt/pop-user/share/gnome-shell/extensions/$$uuid/schemas/gschemas.compiled"; \
	done; \
	$(MAKE) uninstall PREFIX=/opt/pop-user DESTDIR="$$stage"; \
	$(MAKE) uninstall PREFIX=/usr DESTDIR="$$stage"; \
	if find "$$stage" -type f -o -type l | grep -q .; then \
		echo "error: uninstall left suite-owned files in the staging root"; \
		find "$$stage" -type f -o -type l; \
		exit 1; \
	fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

install: install-cosmic install-workspaces install-shell install-settings install-launcher install-themes
	@install -d $(DOC_DIR)/licenses
	@install -m 0644 launcher/LICENSE $(DOC_DIR)/licenses/MPL-2.0
	@install -m 0644 pop-icon-theme/LICENSE $(DOC_DIR)/licenses/CC-BY-SA-4.0
	@install -m 0644 gtk-theme/COPYING.LGPL-2.1 $(DOC_DIR)/licenses/LGPL-2.1
	@install -m 0644 gtk-theme/COPYING.LGPL-3.0 $(DOC_DIR)/licenses/LGPL-3.0
	@echo ""
	@echo "Pop COSMIC Suite installed under $(PREFIX)."
	@echo "Restart GNOME Shell (Alt+F2 -> r, or log out and back in on Wayland)."

install-cosmic: build
	@echo "Installing pop-cosmic extension..."
	@rm -rf $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@install -d $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@cp -f cosmic/*.js cosmic/*.css cosmic/metadata.json $(EXTENSIONS_DIR)/$(COSMIC_UUID)/
	@if [ "$(PREFIX)" != "/usr" ]; then \
		install -d $(EXTENSIONS_DIR)/$(COSMIC_UUID)/schemas; \
		install -m 0644 cosmic/schemas/*.gschema.xml $(EXTENSIONS_DIR)/$(COSMIC_UUID)/schemas/; \
		glib-compile-schemas $(EXTENSIONS_DIR)/$(COSMIC_UUID)/schemas; \
	fi
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 cosmic/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@if [ -z "$(DESTDIR)" ]; then glib-compile-schemas $(SCHEMAS_DIR); fi
	@install -d $(APPLICATIONS_DIR) $(ICONS_DIR)
	@cp -rf cosmic/usr/share/applications/. $(APPLICATIONS_DIR)/
	@cp -rf cosmic/usr/share/icons/. $(ICONS_DIR)/

install-workspaces: build
	@echo "Installing cosmic-workspaces extension..."
	@rm -rf $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@install -d $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@cp -f cosmic-workspaces/*.js cosmic-workspaces/*.css cosmic-workspaces/metadata.json $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/
	@if [ "$(PREFIX)" != "/usr" ]; then \
		install -d $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/schemas; \
		install -m 0644 cosmic-workspaces/schemas/*.gschema.xml $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/schemas/; \
		glib-compile-schemas $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/schemas; \
	fi
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 cosmic-workspaces/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@if [ -z "$(DESTDIR)" ]; then glib-compile-schemas $(SCHEMAS_DIR); fi

install-shell: build-shell
	@echo "Installing pop-shell extension..."
	@rm -rf $(EXTENSIONS_DIR)/$(SHELL_UUID)
	@install -d $(EXTENSIONS_DIR)/$(SHELL_UUID)
	@cp -rf shell/_build/. $(EXTENSIONS_DIR)/$(SHELL_UUID)/
	@if [ "$(PREFIX)" = "/usr" ]; then \
		rm -rf $(EXTENSIONS_DIR)/$(SHELL_UUID)/schemas; \
	else \
		glib-compile-schemas $(EXTENSIONS_DIR)/$(SHELL_UUID)/schemas; \
	fi
	@install -d $(SCHEMAS_DIR)
	@install -m 0644 shell/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@if [ -z "$(DESTDIR)" ]; then glib-compile-schemas $(SCHEMAS_DIR); fi

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
	@install -m 0755 scripts/pop-cosmic-doctor $(BIN_DIR)/pop-cosmic-doctor

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
	@$(MAKE) -C wallpapers install prefix=$(PREFIX) DESTDIR=$(DESTDIR)

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
	@rm -f $(BIN_DIR)/pop-cosmic-doctor
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
	@rm -rf $(DOC_DIR)
	@echo "Uninstall completed."

uninstall-wallpapers:
	@$(MAKE) -C wallpapers uninstall prefix=$(PREFIX) DESTDIR=$(DESTDIR)

uninstall-all: uninstall uninstall-wallpapers

clean:
	@rm -f cosmic/schemas/gschemas.compiled
	@rm -f cosmic-workspaces/schemas/gschemas.compiled
	@rm -f shell/schemas/gschemas.compiled
	@rm -rf pop-settings/.pytest_cache
	@rm -rf gtk-theme/_build
	@$(MAKE) -C shell clean 2>/dev/null || true
