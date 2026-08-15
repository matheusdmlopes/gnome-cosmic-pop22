# 0006 - Declarative Makefile as Unified Build and Packaging Interface

To orchestrate the multiple components of the suite (GJS extensions, GSettings schemas, Python Libadwaita app, and desktop/icon assets), we adopted a declarative Makefile at the root of the repository. This provides a standardized build interface (`make build`, `make install`, `make install-system`, `make test`) compatible with GitHub Actions CI workflows and distribution packaging tools such as PKGBUILD (Arch) and `dpkg-buildpackage` (Debian/Ubuntu).
