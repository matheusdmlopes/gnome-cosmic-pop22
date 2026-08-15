# 0002 - Preservation of Upstream Pop Shell and Focused COSMIC Extension Modernization

The `pop-shell` extension continues to be actively maintained by System76 for modern GNOME Shell versions, whereas `pop-cosmic` and `cosmic-workspaces` were frozen at GNOME 42 due to System76's transition to the Rust-based COSMIC desktop. We decided to keep `pop-shell` as an external dependency configured by `pop-settings`, focusing ESM porting and GNOME 48 compatibility work exclusively on `pop-cosmic` and `cosmic-workspaces`.

## Status

Superseded by [0007](0007-self-contained-pop-cosmic-suite.md).

Treating `pop-shell` as an external dependency meant the suite could not guarantee which version of the tiling manager a user had, and left its preferences dialog on the GTK3-era grid while the rest of the suite moved to Libadwaita. ADR 0007 instead bundles `pop-shell` in `shell/` as a first-class component, so it is versioned, built, tested and installed alongside the other extensions. Its `prefs.js` is now a Libadwaita dialog like the others, and `shell/` and `launcher/` are tracked in git rather than excluded by `.gitignore`.

The other half of this decision still holds: `pop-cosmic` and `cosmic-workspaces` remain the components frozen upstream at GNOME 42, and the ESM modernization work is theirs.
