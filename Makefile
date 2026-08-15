SHELL := /bin/bash
PREFIX ?= $(HOME)/.local
EXTENSIONS_DIR ?= $(PREFIX)/share/gnome-shell/extensions
SCHEMAS_DIR ?= $(PREFIX)/share/glib-2.0/schemas
APPLICATIONS_DIR ?= $(PREFIX)/share/applications
ICONS_DIR ?= $(PREFIX)/share/icons
THEMES_DIR ?= $(PREFIX)/share/themes
BACKGROUNDS_DIR ?= $(PREFIX)/share/backgrounds
BIN_DIR ?= $(PREFIX)/bin

COSMIC_UUID := pop-cosmic@system76.com
WORKSPACES_UUID := cosmic-workspaces@system76.com

.PHONY: all build test install install-themes install-wallpapers install-all uninstall clean

all: build

build:
	@echo "Compiling GSettings schemas..."
	@glib-compile-schemas --strict cosmic/schemas/
	@glib-compile-schemas --strict cosmic-workspaces/schemas/

test: build
	@echo "Running extension syntax validation..."
	@node --check cosmic/*.js
	@node --check cosmic-workspaces/*.js
	@echo "Running pop-settings test suite..."
	@cd pop-settings && uv run pytest

install: build
	@echo "Installing GNOME Shell extensions to $(EXTENSIONS_DIR)..."
	@mkdir -p $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@cp -rf cosmic/*.js cosmic/*.css cosmic/metadata.json cosmic/schemas $(EXTENSIONS_DIR)/$(COSMIC_UUID)/
	@mkdir -p $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@cp -rf cosmic-workspaces/*.js cosmic-workspaces/*.css cosmic-workspaces/metadata.json cosmic-workspaces/schemas $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)/
	@echo "Installing GSettings schemas to $(SCHEMAS_DIR)..."
	@mkdir -p $(SCHEMAS_DIR)
	@cp -f cosmic/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@cp -f cosmic-workspaces/schemas/*.gschema.xml $(SCHEMAS_DIR)/
	@glib-compile-schemas $(SCHEMAS_DIR)
	@echo "Installing Pop Settings application..."
	@mkdir -p $(APPLICATIONS_DIR)
	@cp -f pop-settings/data/pop-settings.desktop $(APPLICATIONS_DIR)/
	@sed -i 's|Exec=.*|Exec=$(CURDIR)/pop-settings/.venv/bin/python -m pop_settings|' $(APPLICATIONS_DIR)/pop-settings.desktop || true
	@echo "Installation completed. Restart GNOME Shell (Alt+F2 -> r or log out/in on Wayland)."

install-themes:
	@echo "Installing Pop icon theme and GTK theme..."
	@mkdir -p $(ICONS_DIR) $(THEMES_DIR)
	@cp -rf pop-icon-theme/* $(ICONS_DIR)/ 2>/dev/null || true
	@cp -rf gtk-theme/* $(THEMES_DIR)/ 2>/dev/null || true

install-wallpapers:
	@echo "Installing Pop wallpapers..."
	@mkdir -p $(BACKGROUNDS_DIR)
	@cp -rf wallpapers/* $(BACKGROUNDS_DIR)/ 2>/dev/null || true

install-all: install install-themes install-wallpapers

uninstall:
	@echo "Removing installed extensions and schemas..."
	@rm -rf $(EXTENSIONS_DIR)/$(COSMIC_UUID)
	@rm -rf $(EXTENSIONS_DIR)/$(WORKSPACES_UUID)
	@rm -f $(SCHEMAS_DIR)/org.gnome.shell.extensions.pop-cosmic.gschema.xml
	@rm -f $(SCHEMAS_DIR)/org.gnome.shell.extensions.cosmic-workspaces.gschema.xml
	@glib-compile-schemas $(SCHEMAS_DIR)
	@rm -f $(APPLICATIONS_DIR)/pop-settings.desktop
	@echo "Uninstall completed."

clean:
	@rm -f cosmic/schemas/gschemas.compiled
	@rm -f cosmic-workspaces/schemas/gschemas.compiled
	@rm -rf pop-settings/.pytest_cache
