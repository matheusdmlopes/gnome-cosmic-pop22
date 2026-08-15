# 0007 - Self-Contained Pop COSMIC Suite and Upstream Independence

## Context

The original Pop COSMIC desktop experience was designed for GNOME 42 and subsequently discontinued upstream by System76 in favor of their Rust-based COSMIC desktop. While `pop-shell` continues upstream development for generic GNOME versions, depending on external dynamic upstream extensions or system packages introduces instability and breaks desktop coherence for users attempting to run Pop COSMIC on GNOME 48 (Debian 13 trixie, Ubuntu, Arch).

## Decision

We freeze and bundle the complete, modernized Pop COSMIC Suite directly inside this repository:
1. `pop-cosmic` (top bar buttons, application drawer, super key handling) refactored to ESM for GNOME 48.
2. `cosmic-workspaces` (vertical workspaces, edge thumbnails) refactored to ESM for GNOME 48.
3. `pop-shell` (tiling window manager) embedded as a first-class stable component of the suite in `shell/`.
4. `pop-settings` (centralized standalone configuration application in Python 3 with Libadwaita).
5. Pop GTK and icon themes.

All source code across JavaScript extensions and Python applications is standardized in 100% standard English with gettext internationalization. Extension preferences (`prefs.js`) use native Libadwaita dialogs with standard desktop launchers (`Gio.DesktopAppInfo`) instead of hardcoded paths.

## Status

Accepted. Supersedes [0002](0002-upstream-pop-shell-and-forked-extensions.md), which kept `pop-shell` as an external dependency.

## Consequences

- A self-contained installed runtime that does not depend on external GNOME
  extensions. During the public beta, source builds may fetch dependencies
  pinned by their lockfiles; fully offline source builds are deferred until a
  stable release requires them.
- Seamless single-command installation (`make install` or Debian `.deb` package).
- Consistent and clean multi-language ready codebase.
