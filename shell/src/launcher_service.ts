import * as utils from './utils.js';
import * as log from './log.js';

import GLib from 'gi://GLib';
const { byteArray } = imports;

/** Reads JSON responses from the launcher service asynchronously, and sends requests.
 *
 * # Note
 * You must call `LauncherService::exit()` before dropping.
 */
export class LauncherService {
    service: utils.AsyncIPC;
    private exited: boolean = false;

    /** @param on_lost Called when the service goes away on its own: end of
     * stream, or a read error that is not our own cancellation. It is never
     * called for an `exit()` we asked for, since that cancels the read first. */
    constructor(service: utils.AsyncIPC, callback: (response: JsonIPC.Response) => void, on_lost: () => void = () => {}) {
        this.service = service;

        /** Recursively registers an intent to read the next line asynchronously  */
        const generator = (stdout: any, res: any) => {
            let bytes: any;
            try {
                [bytes] = stdout.read_line_finish(res);
            } catch (why) {
                if (this.exited) {
                    return;
                }

                log.error(`failed to read response from launcher service: ${why}`);
                on_lost();
                return;
            }

            if (bytes === null) {
                // End of stream: the process closed stdout, so no further
                // request will ever be answered.
                if (!this.exited) {
                    on_lost();
                }
                return;
            }

            const string = byteArray.toString(bytes);
            try {
                const parsed = JSON.parse(string);
                callback(parsed);
            } catch (why) {
                log.error(`failed to process response from launcher service: ${why}`);
            }

            if (!this.exited) {
                try {
                    this.service.stdout.read_line_async(0, this.service.cancellable, generator);
                } catch (why) {
                    if (!this.exited) {
                        log.error(`failed to schedule read on launcher service: ${why}`);
                        on_lost();
                    }
                }
            }
        };

        this.service.stdout.read_line_async(0, this.service.cancellable, generator);
    }

    activate(id: number) {
        this.send({ Activate: id });
    }

    activate_context(id: number, context: number) {
        this.send({ ActivateContext: { id, context } });
    }

    complete(id: number) {
        this.send({ Complete: id });
    }

    context(id: number) {
        this.send({ Context: id });
    }

    exit() {
        if (this.exited) return;
        this.exited = true;

        this.send('Exit');
        this.service.cancellable.cancel();
        const service = this.service;

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            if (service.stdout.has_pending() || service.stdin.has_pending()) return true;

            const close_stream = (stream: any) => {
                try {
                    if (stream && !stream.is_closed()) {
                        stream.close(null);
                    }
                } catch (why) {
                    log.error(`failed to close pop-launcher stream: ${why}`);
                }
            };

            close_stream(service.stdin);
            close_stream(service.stdout);

            // service.child.send_signal(15)

            return false;
        });
    }

    query(search: string) {
        this.send({ Search: search });
    }

    quit(id: number) {
        this.send({ Quit: id });
    }

    select(id: number) {
        this.send({ Select: id });
    }

    send(object: Object) {
        const message = JSON.stringify(object);
        try {
            this.service.stdin.write_all(message + '\n', null);
        } catch (why) {
            log.error(`failed to send request to pop-launcher: ${why}`);
        }
    }
}

/** Launcher types transmitted across the wire as JSON. */
export namespace JsonIPC {
    export interface SearchResult {
        id: number;
        name: string;
        description: string;
        icon?: IconSource;
        category_icon?: IconSource;
        window?: [number, number];
    }

    export type IconSource = IconV.Name | IconV.Mime | IconV.Window;

    namespace IconV {
        export interface Name {
            Name: string;
        }

        export interface Mime {
            Mime: string;
        }

        export interface Window {
            Window: [number, number];
        }
    }

    export type Response =
        | ResponseV.Update
        | ResponseV.Fill
        | ResponseV.Close
        | ResponseV.DesktopEntryR
        | ResponseV.Context;

    namespace ResponseV {
        export type Close = 'Close';

        export interface Context {
            Context: {
                id: number;
                options: Array<ContextOption>;
            };
        }

        export interface ContextOption {
            id: number;
            name: string;
        }

        export interface Update {
            Update: Array<SearchResult>;
        }

        export interface Fill {
            Fill: string;
        }

        export interface DesktopEntryR {
            DesktopEntry: DesktopEntry;
        }
    }

    export interface DesktopEntry {
        path: string;
        gpu_preference: GpuPreference;
    }

    export type GpuPreference = 'Default' | 'NonDefault';
}
