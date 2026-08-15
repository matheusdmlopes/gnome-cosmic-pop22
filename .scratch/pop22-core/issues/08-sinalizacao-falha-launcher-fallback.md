# 08 - Sinalização de Falha do Pop Launcher e Fallback Real na Gaveta

**What to build:** Quando o `pop-launcher` está ausente ou não sobe, a tecla Super abre a gaveta de aplicativos em vez de um diálogo de busca vazio e inerte.

**Blocked by:** 05 - Integração, Build e Plugins do Pop Launcher

**Status:** superseded

Substituída por `.scratch/launcher-fallback/spec.md`. O `Status: done` abaixo era
falso: a revisão de dois eixos derrubou a metade de observação do serviço. O item
5 do checklist, em particular, não se sustenta, porque o child watch em
`async_process_ipc` cancela o mesmo cancellable da leitura pendente e o EOF só
chega em cerca de 8 de 20 execuções. O registro fica aqui como histórico.

O fallback entregue no item 2 da issue 05 só dispara quando `ext.window_search.open()`
lança. Na prática ele nunca dispara no caso que importa:

- `utils.async_process_ipc` captura a falha de `spawnv`, loga e devolve `null`;
  `Launcher.start_services()` deixa `this.service = null` e retorna normalmente.
- `Launcher.open()` já abriu o modal antes disso, então o usuário fica com um
  diálogo vazio: digitar não produz resultado nenhum, porque `this.search()`
  sai cedo com `service === null`.
- Os guards `this.opened` e o de janela em fullscreen também retornam cedo sem
  sinalizar nada, e `overview.js` conclui `launched = true` nos três casos.

- [x] `Launcher.open()` devolve um estado explícito (`opened`, `suppressed`, `unavailable`) em vez de sair mudo nos guards.
- [x] `Launcher.start_services()` devolve `false` quando o serviço não sobe, e `open()` desmonta o diálogo já aberto antes de reportar `unavailable`.
- [x] `cosmic/overview.js` escolhe o fallback pelo estado devolvido, não por exceção; `suppressed` (já aberto, ou fullscreen com override desligado) continua sem abrir a gaveta.
- [x] pop-shell ausente, desabilitado ou sem `window_search` continua caindo na gaveta; uma versão antiga que devolva `undefined` mantém o comportamento atual.
- [x] `LauncherService` avisa o dono quando o processo do serviço morre sozinho, e o diálogo vazio é fechado em vez de ficar preso na tela.
- [x] `make test` verde.

## Comments

The contract now lives in `shell/src/launcher.ts` as an exported `OpenResult`
union, documented where it is declared: `opened`, `suppressed`, `unavailable`.
Only `unavailable` authorises a fallback. Keeping `suppressed` distinct matters:
the fullscreen guard is a deliberate policy, and opening the applications
drawer instead of the launcher would quietly override the user's own setting.

`start_services()` reports whether a service is available instead of leaving a
silent `null` behind. `open()` calls it after the modal is already up, so the
failure path tears the dialog back down through a shared `dismiss()` before
returning `unavailable`, reusing the sequence the `!dialog.visible` branch
already used.

`cosmic/overview.js` no longer relies on an exception. The try/catch stays as a
belt for anything genuinely thrown, but the decision is made on the returned
state. Two absences are folded into `unavailable`: pop-shell not loaded at all
(`with_pop_shell` returns `undefined`) and a loaded pop-shell without
`window_search`. An older pop-shell that returns nothing from `open()` is read
as `opened`, which is what this extension assumed before this change, so
downgrading the shell extension cannot produce two overlapping UIs.

`LauncherService` takes an `on_lost` callback, fired on end of stream or on a
read error that is not our own cancellation. `exit()` cancels the read before
the process goes away, so an orderly shutdown never triggers it. `Launcher`
uses it to drop the dead service and dismiss the dialog.

`extension.ts` now discards the result at the D-Bus boundary explicitly, since
the `Launcher` method in the interface XML declares no return value.

### What is not covered

If `pop-launcher` spawns and only then dies, that press has already been
reported as `opened`, so pop-cosmic does not get to show the drawer for it. The
dialog closes itself instead of sitting there empty, and the next Super press
retries the spawn. Routing that late failure back into the drawer needs a
cross-extension callback from pop-shell into pop-cosmic, which was judged not
worth the coupling for a case that leaves no stuck UI.

Verified with `make test`: strict schemas, 58 files through the ESM syntax
check, the desktop entry, and 81 pytest tests. As in issue 05, the launcher
path itself is not automated, since it needs a live GNOME session. The premise
was confirmed directly under gjs: `SubprocessLauncher.spawnv` on a missing
binary raises inside `async_process_ipc`, which is exactly why the exception
never reached `overview.js`.
