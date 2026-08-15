# Spec: Sinalização Confiável de Falha do Pop Launcher

**Status:** ready-for-agent

## Problem Statement

O usuário da Pop COSMIC Suite configura a tecla Super para abrir o Pop Launcher. Quando o serviço do launcher não está instalado, não sobe, ou morre logo depois de subir, a tecla Super deixa de fazer qualquer coisa útil: aparece um diálogo de busca vazio que não responde a nada digitado, ou nada aparece. O usuário não recebe nenhum aviso e não tem como saber que a busca instantânea está quebrada, nem que existe uma gaveta de aplicativos perfeitamente funcional que poderia atendê-lo naquele momento.

A suíte já tinha a intenção de tratar isso, mas o tratamento nunca disparava. O `pop-cosmic` só caía na gaveta de aplicativos quando a abertura do launcher lançava uma exceção, e a falha de spawn do processo do serviço é capturada e convertida em retorno nulo bem antes disso. Os guards internos do launcher (já aberto, janela em fullscreen) também retornavam sem sinalizar nada, então todos os caminhos de falha se pareciam com sucesso.

## Solution

O `pop-shell` passa a dizer explicitamente o que aconteceu quando alguém pede o launcher, e o `pop-cosmic` decide o fallback a partir dessa resposta em vez de esperar por uma exceção. Quando o launcher genuinamente não pode aparecer, a gaveta de aplicativos assume e a tecla Super continua produtiva. Quando o `pop-shell` decidiu deliberadamente não abrir, por exemplo porque uma janela em fullscreen tem foco e o usuário não pediu para sobrepor, essa decisão é respeitada e nada mais acontece.

Além disso, o serviço do launcher passa a ser observado durante a vida toda, e não apenas no instante em que sobe. Se ele morrer sozinho enquanto o diálogo está na tela, o diálogo é desmontado de forma limpa em vez de ficar preso e inerte, e os recursos do processo são liberados corretamente.

## User Stories

1. As a Pop COSMIC Suite user without the Pop Launcher installed, I want the Super key to open the applications drawer, so that my keyboard workflow keeps working instead of doing nothing.
2. As a user whose Pop Launcher service fails to spawn, I want the applications drawer to appear immediately, so that I am never left staring at an empty search dialog.
3. As a user with a working Pop Launcher, I want the Super key to keep opening it exactly as before, so that the fallback never costs me the feature I actually installed.
4. As a user with a fullscreen window focused and the fullscreen override turned off, I want the Super key to stay inert, so that the setting I chose is honoured rather than silently replaced by the applications drawer.
5. As a user who presses Super twice quickly, I want the second press not to open a second surface, so that the launcher and the drawer never appear stacked on top of each other.
6. As a user running pop-cosmic with pop-shell disabled in GNOME Shell, I want the Super key to fall back to the applications drawer, so that one disabled extension does not take the whole Super key workflow down with it.
7. As a user whose Pop Launcher process dies while the search dialog is open, I want the dialog to close itself, so that I am not typing into a surface that can never answer.
8. As a user, I want a launcher that died to be retried on my next Super press, so that a transient crash does not permanently downgrade me to the drawer for the rest of the session.
9. As a user closing the launcher normally with Escape, I want no error behaviour and no spurious teardown, so that the ordinary path stays quiet.
10. As a user, I want a malformed or unexpected response from the launcher service not to tear down a healthy launcher, so that one bad line does not kill a working session.
11. As a user of a long-lived GNOME session, I want every dead launcher process to release its pipes, so that repeated launcher failures do not accumulate leaked file descriptors in my Shell process.
12. As a user triggering the launcher through its D-Bus method rather than the Super key, I want identical behaviour, so that the entry point I use does not change the outcome.
13. As a user triggering the launcher through its keyboard shortcut binding, I want identical behaviour, so that all three entry points agree.
14. As a developer, I want the launcher service lifecycle covered by automated tests that run without a live GNOME session, so that regressions in this path are caught in CI instead of by users.
15. As a developer, I want the test suite to exercise a real subprocess rather than a mock of the service, so that races between process death and stream reads are actually reproducible in tests.
16. As a developer, I want the outcome of a launcher open attempt to be a named, documented set of states, so that I can tell "deliberately not shown" apart from "could not be shown" without reading the implementation.
17. As a maintainer, I want the new tests wired into the standard build target, so that they run the same way as every other check in the suite.
18. As a maintainer, I want no back-compatibility shim for pop-shell versions the suite does not ship, so that the bundled-component decision in the ADRs is not quietly reopened.
19. As a maintainer, I want the launcher service module to remain importable outside GNOME Shell, so that the test seam this work depends on does not rot.

## Implementation Decisions

1. **Named outcome for an open attempt.** The tiling manager's launcher exposes an exported, documented union type for the result of an open attempt, with three states: the launcher is showing, the launcher was deliberately not shown, and the launcher could not be shown. Only the third authorises a caller to substitute its own UI. The "deliberately not shown" state covers both the already-open guard and the fullscreen policy guard, and exists specifically so that a caller cannot mistake a policy decision for a failure.

2. **Service availability is reported, not inferred.** Starting the launcher service returns whether a service is actually available to answer queries. Since the modal is already on screen by the time this is known, the failure path tears the dialog back down through the same sequence the existing "modal refused to open" path uses, then reports that the launcher is unavailable.

3. **Intentional shutdown is tracked, not inferred from cancellation.** This is the core correctness decision. The launcher service module owns a flag recording that it asked to exit. Any end of the read loop that was not requested, whether end of stream or a cancelled read, counts as service loss. The current code infers the opposite from the cancellation error alone, which is unsound: the process-spawning helper registers a child watch that cancels the very cancellable the pending read uses, so an unsolicited death frequently arrives disguised as a cancellation. A prototype measured this directly against a real subprocess, over 20 trials each:

   ```
   service loss reported, without the child watch cancelling:  20/20
   service loss reported, with the child watch cancelling:       8/20
   ```

   Keeping the flag inside the launcher service module fixes the race without touching the process-spawning helper, and keeps the whole mechanism inside the one module that can be imported and tested outside GNOME Shell.

4. **Read failures and callback failures are separated.** Loss of the service is reported only for failures of the read itself. An exception raised by the response handler must not be interpreted as the service dying, because that would tear down a live service and a visible dialog over one bad line. The existing error guard also assumes a GLib error shape and misbehaves for plain JavaScript errors, so the two failure kinds are distinguished before that guard is reached.

5. **Loss reports are matched to the instance that produced them.** The loss handler verifies that the reporting service is still the current one before clearing it, so a late report from a previous service cannot null out a newly started one.

6. **Teardown honours the documented service contract.** The launcher service module documents that exit must be called before dropping a service. The loss path therefore completes the service shutdown before clearing the reference, rather than clearing it first and skipping shutdown, which is what leaks the pipe pair today.

7. **No back-compatibility shim for older tiling managers.** ADR 0007 bundles the tiling manager as a first-class component of the suite and supersedes ADR 0002 precisely so the suite knows which version is present. The fallback logic therefore treats a missing result as "could not be shown", the same as a missing extension, with no special case assuming an older component that the suite does not ship.

8. **Outcome states are named at the call site.** The consuming extension refers to the outcome states through named constants rather than repeating bare string literals across the decision, matching how that module already names its overview kinds.

9. **No cosmetic changes at the D-Bus boundary.** The D-Bus interface declares no return value and the type system already permits a value-returning handler in that slot, so the handler is left as it is. The keyboard shortcut binding likewise keeps discarding the result implicitly. All three entry points share one behaviour because the behaviour lives in the launcher, not in the callers.

## Testing Decisions

**What makes a good test here.** Tests assert externally observable behaviour of the launcher service: which callbacks fire, in what circumstances, and what happens to the process and its streams. They do not assert on internal flags, private helpers, or the order of internal calls. A test that would still pass if the race in decision 3 were reintroduced is not a useful test, so the service death cases drive a real subprocess and a real main loop rather than a stubbed transport.

**The seam.** One new seam only: the launcher service module, imported directly and driven under plain `gjs`, with no GNOME Shell present. This is viable because the TypeScript compiler elides the type-only import of the utility module, leaving the compiled launcher service module depending on nothing beyond the logging module, `Gio` and `GLib`. The utility module itself is not importable outside the Shell, since it imports `gi://Meta`, whose typelib is not present outside a Shell environment. The test constructs the transport struct it needs directly with `Gio`, which is a plain record of child, streams and cancellable.

**Prior art.** The suite already runs project JavaScript under `gjs` from a build target for the ESM syntax check, so the harness pattern, the invocation style, and the reporting format all have an existing model to follow. ADR 0006 requires the new check to be a declarative build target like the others, and it joins the existing target that runs all checks.

**Cases to cover at that seam.**

1. A well-formed response line reaches the response handler, parsed.
2. Multiple response lines are delivered in order and the read loop continues.
3. The service process exiting on its own is reported as service loss, with the child watch present that cancels the shared cancellable. This is the case that currently fails roughly 60 percent of the time and must be run repeatedly, not once, to be meaningful.
4. An orderly shutdown requested through exit does not report service loss.
5. An exception thrown by the response handler does not report service loss.
6. A malformed, non-JSON line does not report service loss and does not escape as an unhandled error.
7. A loss report from a superseded service instance does not clear a newer one.
8. After a service is lost, its streams are closed rather than leaked.

**Not covered by automation.** The open-attempt outcome itself and the fallback decision in the consuming extension both sit behind GNOME Shell modal and overview APIs that cannot be loaded outside a live session. These stay manual, which is the same conclusion the earlier launcher issue reached, and the manual check is: with the launcher binary removed from the path, the Super key must open the applications drawer.

## Out of Scope

- Routing a late service death back into the applications drawer. When the service dies after the open attempt already reported success, the dialog closes itself and the next Super press retries. Making the drawer appear for that same press would require a callback from the tiling manager into the consuming extension, and that coupling is not justified by a case that leaves no stuck UI.
- Fixing the shared cancellable inside the process-spawning helper. The race is neutralised at the launcher service instead, for the testability reason in decision 3. The other consumer of that helper is left alone.
- Any user-visible notification, banner, or preferences surface telling the user that the launcher is missing. The fallback is silent by design; the drawer simply appears.
- Installing or building the launcher binary, which the earlier launcher issue already covers.
- Changing the fullscreen override policy or the Super key binding lifecycle, which ADR 0005 governs.

## Further Notes

This spec exists because the fallback was previously marked delivered while never actually firing. The two-axis review that produced it found the original attempt sound on the outcome-signalling half and broken on the service-observation half, so the spec deliberately keeps the first half close to what was already written and rewrites the second.

The glossary in `CONTEXT.md` has no entry for the Pop Launcher, even though it is a separate service process that two components depend on, nor for the outcome states introduced here. That gap should be closed through the domain modelling workflow rather than by inventing vocabulary inside this feature.

The triage label vocabulary file referenced by the issue tracker documentation is absent from this repo, so the `ready-for-agent` label above follows the skill's instruction rather than a documented local vocabulary.
