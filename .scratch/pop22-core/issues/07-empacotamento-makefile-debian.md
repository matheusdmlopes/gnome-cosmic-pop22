# 07 - Empacotamento Declarativo no Makefile e Estrutura Debian

**What to build:** O usuário instala a suíte completa Pop COSMIC no Debian 13 / GNOME 48 em um único comando (`sudo make install` ou instalando o pacote `.deb` gerado), com binários, schemas, temas, ícones e entradas de menu `.desktop` registradas e funcionais.

**Blocked by:** 06 - Suíte Completa de Testes Automatizados e Validação de Sintaxe/Schemas

**Status:** done

- [x] Makefile principal contendo alvos declarativos completos:
  - `install` (suíte completa: extensões, app, temas, launcher e schemas).
  - `install-cosmic`, `install-workspaces`, `install-shell`, `install-settings`, `install-launcher`, `install-themes`.
  - `uninstall` limpo e reversível.
- [x] Wrapper executável `/usr/bin/pop-settings` (e suporte a `~/.local/bin`) gerado corretamente.
- [x] Arquivo `pop-settings.desktop` validado via `desktop-file-validate`.
- [x] Configuração de empacotamento Debian em `packaging/debian/` pronta para gerar o pacote `gnome-cosmic-pop22.deb`.

## Comments

Delivered in 8558840, with an uninstall fix in 3aed7fe.

The Makefile now has the full modular target set and, importantly, honours
`DESTDIR`. It previously ignored it while `packaging/debian/rules` and the
PKGBUILD both passed it, so a package build would have written into the build
machine's `/usr` and produced an empty package.

`/usr/bin/pop-settings` is generated from `pop-settings/data/pop-settings.in`,
running the system Python against the installed package, so no uv or
virtualenv is needed at runtime. The desktop entry passes
`desktop-file-validate` and no longer carries a hardcoded developer path.

The GTK theme is built through Meson rather than copied from the repository
tree, which the previous `cp -rf` would have installed as a broken theme.

Verified end to end in a staging root: `make install PREFIX=/usr DESTDIR=...`
lays down 4021 files and `make uninstall` leaves zero. An early claim that the
theme overwrites GNOME's shell theme was wrong: every file it installs is
Pop-namespaced, and GNOME's own theme lives in `gnome-shell-theme.gresource`,
which is untouched.
