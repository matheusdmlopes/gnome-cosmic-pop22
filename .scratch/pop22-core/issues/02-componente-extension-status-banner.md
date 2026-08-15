# 02 - Componente Reutilizável ExtensionStatusBanner e Desduplicação no Pop Settings

**What to build:** O usuário visualiza alertas reativos e contextualizados dentro do Pop Settings sempre que a extensão necessária para aquela página de configurações estiver desativada no GNOME Shell, com código modular sem duplicação de boilerplate nas páginas.

**Blocked by:** None - can start immediately

**Status:** done

- [x] Componente `ExtensionStatusBanner` implementado em `pop_settings/widgets/extension_banner.py` herdando de `Adw.PreferencesGroup`.
- [x] Integração com `ExtensionMonitor` via sinal D-Bus `ExtensionStatusChanged` com atualização dinâmica de visibilidade do `Adw.Banner`.
- [x] Refatoração de `DesktopPage` para utilizar o novo componente com uma única declaração.
- [x] Refatoração de `WorkspacesPage` para utilizar o novo componente com uma única declaração.
- [x] Eliminação de métodos e atributos de banner duplicados em todas as páginas de preferências.

## Comments

Delivered in 8558840.

`ExtensionStatusBanner` lives in `pop_settings/widgets/extension_banner.py` as
an untitled `Adw.PreferencesGroup`, so a page adds it with a single call and
it lands above every real settings group. Desktop, Workspaces and Tiling all
use it; no page carries banner state of its own any more.

A first pass left a `status_banner` alias behind on two of the three pages.
Code review caught it and it was removed, with the page tests retargeted at
`page.extension_banner`.
