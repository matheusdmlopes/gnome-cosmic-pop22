#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

HOME="$test_root/empty-home" XDG_DATA_HOME="$test_root/empty-data" \
    bash scripts/pop-cosmic-doctor \
    | grep -q 'No conflicting user-space'

conflict_home="$test_root/conflict-home"
conflict_paths=()
while IFS= read -r relative_path; do
    conflict_path="$conflict_home/.local/$relative_path"
    mkdir -p "$(dirname "$conflict_path")"
    printf 'user-owned-marker\n' > "$conflict_path"
    conflict_paths+=("$conflict_path")
done <<'EOF'
share/gnome-shell/extensions/pop-cosmic@system76.com
share/gnome-shell/extensions/cosmic-workspaces@system76.com
share/gnome-shell/extensions/pop-shell@system76.com
share/glib-2.0/schemas/org.gnome.shell.extensions.pop-cosmic.gschema.xml
share/glib-2.0/schemas/org.gnome.shell.extensions.cosmic-workspaces.gschema.xml
share/glib-2.0/schemas/org.gnome.shell.extensions.pop-shell.gschema.xml
share/applications/pop-settings.desktop
share/applications/pop-cosmic-applications.desktop
share/applications/pop-cosmic-launcher.desktop
share/applications/pop-cosmic-workspaces.desktop
share/pop-settings
share/pop-launcher
share/themes/Pop
share/themes/Pop-dark
share/gnome-shell/theme/Pop
share/gnome-shell/theme/Pop-dark
share/gnome-shell/theme/pop.css
share/gnome-shell/theme/pop-dark.css
share/icons/Pop
share/icons/Pop-Dark
share/icons/hicolor/scalable/actions/pop-cosmic-applications.svg
share/icons/hicolor/scalable/actions/pop-cosmic-launcher.svg
share/icons/hicolor/scalable/actions/pop-cosmic-workspaces.svg
share/sounds/Pop
bin/pop-launcher
bin/pop-settings
bin/pop-cosmic-doctor
EOF

set +e
output="$(HOME="$conflict_home" XDG_DATA_HOME="$test_root/other-data" \
    bash scripts/pop-cosmic-doctor 2>&1)"
status=$?
set -e

test "$status" -eq 1
grep -q 'did not change any files' <<<"$output"
for conflict_path in "${conflict_paths[@]}"; do
    grep -q "$conflict_path" <<<"$output"
    grep -q 'user-owned-marker' "$conflict_path"
done

echo "Doctor behavior passed."
