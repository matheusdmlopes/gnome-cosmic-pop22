# Spec: Public Beta 0.1.0-beta.1

Status: ready-for-human

## Goal

Publish a testable public beta of the Pop COSMIC Suite for Debian 13,
GNOME Shell 48, and amd64. The beta is an unofficial, multi-license aggregate
containing the three bundled extensions, Pop Launcher, Pop Settings, and the
Pop visual themes. Wallpapers remain an optional source-install companion and
are not part of the Debian package.

## Supported Environment

- Debian 13 (trixie), amd64 only.
- GNOME Shell 48 (`>= 48` and `< 49`).
- X11 and Wayland, both covered by manual acceptance.
- System-wide source install through `sudo make install PREFIX=/usr`.
- User-space installs are development-only.
- Source builds may fetch lockfile-pinned dependencies during the beta; the
  installed runtime must be self-contained.

## Automated Acceptance

1. Existing schema, ESM, LauncherService, desktop-entry, and Pop Settings tests pass.
2. Pop Launcher web-plugin tests use local fixtures and never mutable live HTML.
3. Pop Launcher and the visual themes build in CI.
4. Rust formatting and Clippy pass with warnings denied.
5. A staged install followed by uninstall leaves no suite-owned files behind.
6. A conventional root `debian/` package builds as version `0.1.0~beta1-1`,
   declares `amd64`, depends on GNOME Shell 48 but not 49, includes no
   wallpapers or compiled global schema cache, and gains runtime ELF depends.
7. CI builds and exercises the package install/remove lifecycle in a clean
   Debian 13 container.
8. CI performs dependency vulnerability, license, and secret audits. Unknown
   or incompatible Rust licenses and known high/critical vulnerabilities fail.
9. A tag workflow for `v0.1.0-beta.1` creates a GitHub prerelease with the
   Debian package and a SHA256 checksum after the manual acceptance gate.

## Installation and Migration

- Extension destinations are replaced cleanly so upgrades cannot retain stale
  modules.
- Staged/package installs do not ship `gschemas.compiled`; package triggers
  compile the global schema cache.
- A doctor command detects conflicting copies under `~/.local`, explains how
  to remove them, and never deletes user files.
- Migration support covers clean package installs and explicit migration from
  the current local source install. Package-to-package upgrade testing begins
  with beta 2.
- `make install-wallpapers` delegates to the wallpaper component's scaled
  installation and GNOME background metadata; it remains outside the beta package.

## Licensing and Branding

- New project code and integration/build tooling use GPL-3.0-only.
- Bundled upstream MPL, GPL, LGPL, and CC BY-SA scopes remain intact and are
  represented accurately in Debian copyright metadata.
- Rust dependencies receive an automated third-party license inventory and
  deny policy for unknown/incompatible terms.
- Public documentation prominently states that the project is unofficial,
  unaffiliated with and not endorsed by System76, and uses the Pop names only
  descriptively. No System76 logo is presented as project branding.

## Manual Acceptance Gate

Record evidence in `docs/release/0.1.0-beta.1-checklist.md` for both X11 and
Wayland: clean install and activation of all three extensions; journal health;
shortcut restoration; all launcher entry points and fallback/loss cases; Pop
Settings launch, preferences links, persistence, and live changes; and
coexistence with Dash-to-Dock and DING. Core install, activation, settings,
shortcut, launcher/fallback, stuck-UI, security, or licensing failures block
publication. Minor cosmetic defects may be listed as known limitations.

## Release Evidence

The release checklist records the environment, exact commands, results, CI
links, manual sign-off, known limitations, and SHA256. The release remains a
GitHub prerelease until all automated and manual gates are complete.
