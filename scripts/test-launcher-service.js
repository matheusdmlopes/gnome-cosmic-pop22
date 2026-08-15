// Test suite for LauncherService lifecycle under pure gjs without GNOME Shell.
// Covers the verification cases at the LauncherService seam.

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import System from 'system';

// Install globals provided by GNOME Shell environment before module import.
globalThis.log = (text) => print(text);
globalThis.popShellExtension = {
    getSettings: () => ({
        get_uint: (_key) => 1, // LOG_LEVELS.ERROR
    }),
};

const { LauncherService } = await import('../shell/_build/launcher_service.js');

function create_transport(argv) {
    const launcher = new Gio.SubprocessLauncher({
        flags: Gio.SubprocessFlags.STDIN_PIPE | Gio.SubprocessFlags.STDOUT_PIPE,
    });
    const child = launcher.spawnv(argv);
    const cancellable = new Gio.Cancellable();

    const stdin = new Gio.DataOutputStream({
        base_stream: child.get_stdin_pipe(),
        close_base_stream: true,
    });

    const stdout = new Gio.DataInputStream({
        base_stream: child.get_stdout_pipe(),
        close_base_stream: true,
    });

    child.wait_async(null, (source, res) => {
        try {
            source.wait_finish(res);
        } catch (_) {}
        cancellable.cancel();
    });

    return { child, stdin, stdout, cancellable };
}

function spawn_launcher_service(argv, on_response = () => {}, on_lost = () => {}) {
    return new LauncherService(create_transport(argv), on_response, on_lost);
}

function run_with_loop(fn, timeout_ms = 2000) {
    const loop = new GLib.MainLoop(null, false);
    let error = null;
    let timed_out = false;

    const timeout_id = GLib.timeout_add(GLib.PRIORITY_DEFAULT, timeout_ms, () => {
        timed_out = true;
        loop.quit();
        return GLib.SOURCE_REMOVE;
    });

    const done = (err = null) => {
        if (error === null && err !== null) {
            error = err;
        }
        GLib.source_remove(timeout_id);
        loop.quit();
    };

    try {
        fn(done);
        loop.run();
    } catch (e) {
        error = e;
    }

    if (timed_out) {
        throw new Error(`Test timed out after ${timeout_ms}ms`);
    }
    if (error) {
        throw error;
    }
}

let passed = 0;
let failed = 0;

function run_test(name, fn) {
    try {
        fn();
        print(`  PASS: ${name}`);
        passed += 1;
    } catch (e) {
        printerr(`  FAIL: ${name}: ${e.message}`);
        failed += 1;
    }
}

print('Running LauncherService test suite (gjs)...');

// Case 1: A well-formed response line reaches the response handler, parsed.
run_test('1. Well-formed response line reaches handler parsed', () => {
    run_with_loop((done) => {
        let received = null;
        let lost = false;

        const service = spawn_launcher_service(
            ['sh', '-c', 'printf \'{"Fill":"search_query"}\\n\'; cat'],
            (resp) => {
                received = resp;
                service.exit();
                if (received && received.Fill === 'search_query' && !lost) {
                    done();
                } else {
                    done(new Error(`Unexpected response: ${JSON.stringify(received)}`));
                }
            },
            () => {
                lost = true;
            }
        );
    });
});

// Case 2: Multiple response lines are delivered in order and the read loop continues.
run_test('2. Multiple response lines delivered in order and read loop continues', () => {
    run_with_loop((done) => {
        const responses = [];
        let lost = false;

        const service = spawn_launcher_service(
            ['sh', '-c', 'printf \'{"Fill":"first"}\\n{"Fill":"second"}\\n\'; cat'],
            (resp) => {
                responses.push(resp);
                if (responses.length === 2) {
                    service.exit();
                    if (responses[0]?.Fill === 'first' && responses[1]?.Fill === 'second' && !lost) {
                        done();
                    } else {
                        done(new Error(`Responses out of order: ${JSON.stringify(responses)}`));
                    }
                }
            },
            () => {
                lost = true;
            }
        );
    });
});

// Case 3: The service process exiting on its own is reported as service loss,
// with the child watch present that cancels the shared cancellable (20 trials).
run_test('3. Unsolicited process exit reported as service loss (20/20 iterations)', () => {
    for (let trial = 1; trial <= 20; trial++) {
        run_with_loop((done) => {
            spawn_launcher_service(
                ['sh', '-c', 'sleep 0.005; exit 1'],
                () => {},
                () => {
                    done();
                }
            );
        });
    }
});

// Case 4: An orderly shutdown requested through exit does not report service loss.
run_test('4. Orderly shutdown via exit() does not report service loss', () => {
    run_with_loop((done) => {
        let lost = false;

        const service = spawn_launcher_service(
            ['cat'],
            () => {},
            () => {
                lost = true;
            }
        );

        service.exit();

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (!lost) {
                done();
            } else {
                done(new Error('on_lost was called after intentional exit()'));
            }
            return GLib.SOURCE_REMOVE;
        });
    });
});

// Case 5: An exception thrown by the response handler does not report service loss.
run_test('5. Exception in response handler does not report service loss', () => {
    run_with_loop((done) => {
        let lost = false;
        let step1_received = false;
        let step2_received = false;

        const service = spawn_launcher_service(
            ['sh', '-c', 'printf \'{"Fill":"step1"}\\n\'; sleep 0.02; printf \'{"Fill":"step2"}\\n\'; cat'],
            (resp) => {
                if (resp?.Fill === 'step1') {
                    step1_received = true;
                    throw new Error('Simulated exception in response handler');
                } else if (resp?.Fill === 'step2') {
                    step2_received = true;
                    service.exit();
                    if (!lost && step1_received && step2_received) {
                        done();
                    } else {
                        done(new Error('step2 not reached or lost was called'));
                    }
                }
            },
            () => {
                lost = true;
            }
        );
    });
});

// Case 6: A malformed, non-JSON line does not report service loss and does not escape as an unhandled error.
run_test('6. Malformed non-JSON line does not report service loss or crash read loop', () => {
    run_with_loop((done) => {
        let lost = false;
        let recovered = false;

        const service = spawn_launcher_service(
            ['sh', '-c', 'printf \'non-json string line\\n\'; sleep 0.02; printf \'{"Fill":"recovered"}\\n\'; cat'],
            (resp) => {
                if (resp?.Fill === 'recovered') {
                    recovered = true;
                    service.exit();
                    if (!lost && recovered) {
                        done();
                    } else {
                        done(new Error('Recovery response not reached or lost called'));
                    }
                }
            },
            () => {
                lost = true;
            }
        );
    });
});

// Case 7: on_lost is called at most once per instance and is not re-triggered after exit().
// Note: The superseded instance guard in Launcher (shell/src/launcher.ts) lives in a
// class that imports gi://Meta and is not reachable from this seam. Here we verify
// the contract of LauncherService itself: on_lost fires at most once, and never after exit().
run_test('7. on_lost is called at most once and never re-triggered after exit()', () => {
    run_with_loop((done) => {
        let lost_count = 0;

        const service = spawn_launcher_service(
            ['sh', '-c', 'sleep 0.005; exit 1'],
            () => {},
            () => {
                lost_count += 1;
                service.exit();
            }
        );

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
            if (lost_count === 1) {
                done();
            } else {
                done(new Error(`on_lost called ${lost_count} times instead of exactly 1`));
            }
            return GLib.SOURCE_REMOVE;
        });
    });
});

// Case 8: After a service is lost, its streams are closed rather than leaked.
run_test('8. After service is lost, its streams are closed rather than leaked', () => {
    run_with_loop((done) => {
        const transport = create_transport(['sh', '-c', 'sleep 0.005; exit 0']);
        let lost = false;

        const service = new LauncherService(
            transport,
            () => {},
            () => {
                lost = true;
                service.exit();

                GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, () => {
                    const stdin_closed = transport.stdin.is_closed();
                    const stdout_closed = transport.stdout.is_closed();
                    if (stdin_closed && stdout_closed) {
                        done();
                    } else {
                        done(new Error(`Streams not closed: stdin=${stdin_closed}, stdout=${stdout_closed}`));
                    }
                    return GLib.SOURCE_REMOVE;
                });
            }
        );
    });
});

print(`LauncherService results: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    System.exit(1);
}
