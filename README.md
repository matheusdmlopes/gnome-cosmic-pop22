# Pop COSMIC Suite for GNOME 48

> **Unofficial project.** This repository is independent, unaffiliated with,
> and not endorsed by System76. Pop, Pop!_OS, and COSMIC are used only to
> describe the compatibility and upstream origin of the bundled components.

This project brings the classic Pop!_OS 22.04 desktop workflow to **GNOME
Shell 48 on Debian 13 (trixie), amd64**. The current release target is
`v0.1.0-beta.1`; it is a public beta, not a stable release.

## Included components

- `pop-cosmic`: Workspaces and Applications panel buttons, application drawer,
  and Super-key routing.
- `cosmic-workspaces`: vertical overview, side thumbnails, and reversible
  vertical workspace shortcuts.
- `pop-shell`: tiling window manager and its GNOME Shell integration.
- Pop Launcher: the Rust search service and bundled plugins used by pop-shell.
- Pop Settings: a standalone GTK4/Libadwaita settings application.
- Pop GTK, GNOME Shell, sound, and icon themes.

Wallpapers are an optional source-install companion. They are intentionally
not included in the beta Debian package.

## Supported environment

- Debian 13 (trixie), amd64.
- GNOME Shell 48 only (`>= 48`, `< 49`).
- X11 and Wayland after both manual acceptance matrices are signed off.

Other distributions, architectures, and GNOME versions may work, but they are
not supported by this beta. The installed desktop is self-contained; source
builds may download dependencies pinned by `Cargo.lock` and `uv.lock`.

## Install the Debian beta

Download the `.deb` and matching `.sha256` from the GitHub prerelease, verify
the checksum, then install it:

```bash
sha256sum --check gnome-cosmic-pop22_0.1.0~beta1-1_amd64.deb.sha256
sudo apt install ./gnome-cosmic-pop22_0.1.0~beta1-1_amd64.deb
pop-cosmic-doctor
```

The doctor reports user-space extension copies, launcher/settings executables,
schemas, application entries, plugins, and themes that would shadow or mix
with the package. It never deletes or changes user files. If it reports a
conflict, disable any listed extension, move every listed path to a backup,
and log out and back in.

Enable every bundled extension after logging back in:

```bash
gnome-extensions enable pop-cosmic@system76.com
gnome-extensions enable cosmic-workspaces@system76.com
gnome-extensions enable pop-shell@system76.com
```

Open **Pop Settings** from the application launcher or run `pop-settings`.

## Supported source installation

System-wide installation is the supported source path for beta users:

```bash
sudo make install PREFIX=/usr
```

Required build tools are TypeScript (`tsc`), Rust and Cargo, Meson, SassC,
GJS, GLib schema tools, desktop-file-utils, Python 3, PyGObject, GTK4,
Libadwaita, `uv`, and Xvfb for headless widget tests. On Debian, install the
build dependencies declared in [`debian/control`](debian/control).

Running plain `make install` installs under `~/.local` and is intended only for
development. It can be removed with `make uninstall` using the same `PREFIX`
and `DESTDIR` values used for installation.

Optional wallpapers require ImageMagick and install scaled images plus GNOME
background metadata:

```bash
sudo make install-wallpapers PREFIX=/usr
sudo make uninstall-wallpapers PREFIX=/usr
```

## Build and verification

```bash
make build-release DESTDIR=/tmp/pop-cosmic-build
make test
make test-install
dpkg-buildpackage --no-sign --build=binary
```

`make test` covers strict schemas, GJS ESM syntax, the real-subprocess launcher
lifecycle, desktop metadata, Pop Settings, deterministic Rust tests, formatting,
Clippy with warnings denied, release metadata, and the migration doctor. CI
also performs a Debian 13 package lifecycle, advisory/license checks, secret
scanning, and produces a Rust dependency inventory.

The release is not publishable until
[`docs/release/0.1.0-beta.1-checklist.md`](docs/release/0.1.0-beta.1-checklist.md)
contains passing X11 and Wayland evidence.

## License

This repository and Debian package are a multi-license aggregate. New project
integration code and Pop Settings are GPL-3.0-only. Bundled upstream components
retain their MPL-2.0, GPL, LGPL, or CC BY-SA terms. Exact file scopes and
copyright notices are recorded in [`debian/copyright`](debian/copyright); the
component license texts remain alongside their sources.
