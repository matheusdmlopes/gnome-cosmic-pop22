# 03 - Descoberta Dinâmica de Temas GTK e Ícones na AppearancePage

**What to build:** O usuário consegue visualizar e selecionar dinamicamente temas GTK e pacotes de ícones instalados no sistema operacional a partir de menus suspensos (`Adw.ComboRow`) na página de Aparência do Pop Settings, aplicando as mudanças visualmente em tempo real.

**Blocked by:** None - can start immediately

**Status:** done

- [x] Utilitário de descoberta de temas em `pop_settings/theme_helper.py` que escaneia diretórios do sistema (`/usr/share/themes`, `/usr/share/icons`) e do usuário (`~/.themes`, `~/.icons`, `~/.local/share/themes`, `~/.local/share/icons`).
- [x] Enumeração ordenada priorizando os temas Pop (`Pop`, `Pop-dark`) e Adwaita no topo da lista.
- [x] `AppearancePage` atualizada com `Adw.ComboRow` interativos para estilo de aplicação (GTK) e ícones.
- [x] Sincronização bidirecional em tempo real com as chaves `gtk-theme` e `icon-theme` de `org.gnome.desktop.interface`.

## Comments

Delivered in 8558840.

`pop_settings/theme_helper.py` scans the system and user directories for both
GTK themes (a `gtk-3.0` or `gtk-4.0` subdirectory) and icon packs (an
`index.theme` file), skipping the `default` cursor redirect and deduplicating
across directories.

Two things the tests taught us:

- `Adw.ComboRow` always shows some row, so it cannot represent "the active
  theme is not in this list". Rather than let the row display a theme that is
  not in use, an active theme outside the scanned directories is appended to
  the model and selected.
- The icon theme ships as `Pop-Dark` while the GTK theme uses `Pop-dark`. The
  priority list carries both spellings; only installed ones are returned.

The row is seeded before its handler is connected, so building the page never
writes the user's current theme back to GSettings.
