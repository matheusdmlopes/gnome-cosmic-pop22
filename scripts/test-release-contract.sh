#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-only
set -euo pipefail

fail() {
    echo "release contract: $*" >&2
    exit 1
}

for metadata in cosmic/metadata.json cosmic-workspaces/metadata.json shell/metadata.json; do
    python3 - "$metadata" <<'PY'
import json
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as source:
    metadata = json.load(source)
if metadata.get("shell-version") != ["48"]:
    raise SystemExit(f"{path}: shell-version must be exactly ['48']")
PY
done

test -f debian/control || fail "root debian/control is missing"
test ! -e packaging/debian/control || fail "obsolete packaging/debian/control still exists"
grep -q '^Architecture: amd64$' debian/control || fail "package is not amd64-only"
grep -q 'gnome-shell (>= 48)' debian/control || fail "GNOME 48 lower bound is missing"
grep -q 'gnome-shell (<< 49)' debian/control || fail "GNOME 49 upper bound is missing"
grep -q '^Version: 0.1.0~beta1-1$' <(dpkg-parsechangelog) || fail "Debian beta version is wrong"

if grep -Eq 'wallpaper|backgrounds/pop' debian/control debian/rules; then
    fail "wallpapers must not be advertised or installed by the beta package"
fi

echo "Release metadata contract passed."
