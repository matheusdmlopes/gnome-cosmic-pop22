# 04 - Controles de Usabilidade do Pop Shell na TilingPage

**What to build:** O usuário consegue configurar as opções avançadas de usabilidade do Pop Shell (empilhamento de janelas com o mouse, comportamento do cursor em navegação por teclado, launcher sobre janelas fullscreen e raio de borda ativa) diretamente pela interface elegante em Libadwaita do Pop Settings.

**Blocked by:** 02 - Componente Reutilizável ExtensionStatusBanner e Desduplicação no Pop Settings

**Status:** done

- [x] Novo grupo `Adw.PreferencesGroup` ("Comportamento e Mouse" / "Window & Mouse Behavior") na `TilingPage`.
- [x] Controles `Adw.SwitchRow` vinculados a `stacking-with-mouse`, `mouse-cursor-follows-active-window` e `fullscreen-launcher`.
- [x] Controle `Adw.SpinRow` vinculado a `active-hint-border-radius` (com ajustes de 0 a 30 pixels).
- [x] Adição do `ExtensionStatusBanner` específico para `pop-shell@system76.com` no topo da `TilingPage`.

## Comments

Delivered in 8558840.

The Tiling page gained a "Window and Mouse Behavior" group with switches for
`stacking-with-mouse`, `mouse-cursor-follows-active-window` and
`fullscreen-launcher`, plus a spin row for `active-hint-border-radius` bounded
to 0-30, matching the range the schema declares.

The page also takes an `ExtensionMonitor` and shows the shared
`ExtensionStatusBanner` for `pop-shell@system76.com`.
