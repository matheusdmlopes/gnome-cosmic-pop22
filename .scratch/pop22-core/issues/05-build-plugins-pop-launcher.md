# 05 - Integração, Build e Plugins do Pop Launcher

**What to build:** O usuário consegue compilar e instalar os plugins e binário do Pop Launcher (`launcher/`) via Makefile e disparar a busca instantânea pela tecla Super ou atalho `<Super>/` de forma integrada no GNOME 48.

**Blocked by:** 01 - Padronização e Limpeza de Preferências ESM nas Extensões, 04 - Controles de Usabilidade do Pop Shell na TilingPage

**Status:** done

- [x] Target declarativo `build-launcher` e `install-launcher` no Makefile principal construindo o binário `pop-launcher` e instalando plugins em `/usr/lib/pop-launcher/plugins` (ou caminho local).
- [x] Verificação e tratamento de fallback no `cosmic/overview.js` caso o serviço do launcher não responda ou esteja ausente.
- [x] Teste de interoperabilidade entre o `pop-shell` (`window_search`) e o serviço `pop-launcher`.

## Comments

Delivered in 8558840.

`build-launcher` and `install-launcher` cover the binary, the eleven plugins
and the scripts, following the upstream layout: `/usr/lib/pop-launcher` for a
system prefix, `$(PREFIX)/share/pop-launcher` otherwise. Each plugin directory
gets its `.ron` file and a symlink to the multi-call binary under the
dash-spelled name it dispatches on.

`cosmic/overview.js` now wraps the launcher path in try/catch. Previously an
exception from `window_search.open` escaped before the fallback was reached;
the applications drawer is now used whenever the launcher is missing or does
not answer.

The interoperability check was done by hand and is **not automated**, since it
needs a live GNOME session. Verified by installing to an isolated prefix and
driving the service directly: `{"Search":"fire"}` returned `{"Update":[...]}`
with real results, which is exactly the protocol `shell/src/launcher_service.ts`
sends and parses.
