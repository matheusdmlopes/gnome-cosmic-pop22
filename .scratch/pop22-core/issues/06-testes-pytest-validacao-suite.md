# 06 - Suíte Completa de Testes Automatizados e Validação de Sintaxe/Schemas

**What to build:** Desenvolvedores e agentes conseguem validar com 100% de automação a integridade estática das extensões (ESM, GJS e schemas GSettings) e a funcionalidade completa do Pop Settings (todas as páginas, widgets, fallbacks e monitores D-Bus) através de comandos padrão.

**Blocked by:** 01 - Padronização e Limpeza de Preferências ESM nas Extensões, 02 - Componente Reutilizável ExtensionStatusBanner e Desduplicação no Pop Settings, 03 - Descoberta Dinâmica de Temas GTK e Ícones na AppearancePage, 04 - Controles de Usabilidade do Pop Shell na TilingPage, 05 - Build e Plugins do Pop Launcher

**Status:** done

- [x] Testes automatizados em Python (`uv run pytest`) cobrindo:
  - Inicialização de todas as 5 páginas (`DesktopPage`, `WorkspacesPage`, `TilingPage`, `DockPage`, `AppearancePage`).
  - `ExtensionStatusBanner` e mock reativo de D-Bus com `ExtensionMonitor`.
  - Módulo `theme_helper` com simulação de diretórios vazios, inexistentes e com temas válidos.
- [x] Validação estática de sintaxe ESM com `gjs -c` para todos os arquivos `.js` em `cosmic/`, `cosmic-workspaces/` e `shell/`.
- [x] Compilação estrita de schemas GSettings com `glib-compile-schemas --strict`.
- [x] Alvo `make test` no Makefile executando todas as validações estáticas e testes de unidade.

## Comments

Delivered in 8558840, with two CI fixes in 3a56b71 and 0cf0d44.

`scripts/check-js-syntax.js` parses every extension module with
`Reflect.parse({ target: 'module' })` under gjs itself. `gjs -c` alone cannot
do this: it evaluates rather than parses, so modules importing
`resource:///org/gnome/shell/...` fail outside a live Shell. Reflect.parse
gives real ESM validation on the same SpiderMonkey build with nothing
evaluated. 58 files pass.

`make test` runs the three seams: strict schema compilation, ESM syntax, the
desktop entry, and 81 pytest tests.

Two things only surfaced once CI ran for real:

- GTK4 segfaults when constructing a widget with no display at all. `make test`
  passed locally only because of the graphical session. It now uses the session
  display when there is one and `xvfb-run` when there is not.
- uv downloaded its own CPython, which cannot see the distribution's
  `python3-gi`. uv is now pinned to the system interpreter and the venv is
  built with `--system-site-packages`. A stale `.python-version` pinning 3.13
  was also removed, since the project supports >= 3.10 and CI runs 3.12.
