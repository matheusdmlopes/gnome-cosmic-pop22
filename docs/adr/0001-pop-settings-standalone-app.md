# 0001 - Pop Settings as a Standalone Libadwaita Application

In the original Pop!_OS 22.04, desktop suite settings were embedded into `gnome-control-center` via patches and the `desktop-widget` component in C/Rust. For GNOME 48, we chose to build `pop-settings` as a standalone Python/Libadwaita application that directly binds to GSettings schemas. This removes the requirement for distro-level control center patches and enables the suite to run on any modern Linux distribution (Arch, Fedora, Debian, Ubuntu) without replacing system binaries.
