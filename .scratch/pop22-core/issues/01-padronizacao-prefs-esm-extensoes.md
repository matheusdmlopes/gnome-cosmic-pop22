# 01 - Padronização e Limpeza de Preferências ESM nas Extensões

**What to build:** O usuário consegue abrir as preferências de cada extensão individualmente pelo Extension Manager do GNOME 48 com interface nativa em Libadwaita em inglês padrão e um botão de ação rápida para abrir o Pop Settings central, sem erros de caminhos locais hardcoded e sem misturas de traduções não estruturadas no código-fonte.

**Blocked by:** None - can start immediately

**Status:** done

- [x] `cosmic/prefs.js` padronizado 100% em inglês com strings preparadas para internacionalização gettext.
- [x] `cosmic-workspaces/prefs.js` padronizado 100% em inglês e remoção do fallback legado `Gio.GLib || imports.gi.GLib`.
- [x] `shell/prefs.js` implementado com diálogo Libadwaita integrado contendo atalho funcional para o Pop Settings.
- [x] Botão de abertura do Pop Settings usa `Gio.DesktopAppInfo` ou `Gio.AppInfo.create_from_commandline` sem caminhos absolutos hardcoded `/home/matheusdm/...`.
- [x] Fallback silencioso e seguro caso o executável do Pop Settings ainda não esteja instalado no sistema.

## Comments

Delivered in 8558840.

`cosmic/prefs.js` and `cosmic-workspaces/prefs.js` are fully in English with
gettext, and the legacy `Gio.GLib || imports.gi.GLib` fallback is gone.
`shell/src/prefs.ts` was rewritten from the GTK3-era `getPreferencesWidget`
grid to a Libadwaita `fillPreferencesWindow`, which also required declaring
`gi://Adw` and the GJS `console` global in `shell/src/mod.d.ts`.

All three resolve Pop Settings through `Gio.DesktopAppInfo`, falling back to
`Gio.AppInfo.create_from_commandline` for the command on PATH. When neither
resolves, the row stays visible but insensitive and its subtitle says so, so
the dialog never offers a button that fails.
