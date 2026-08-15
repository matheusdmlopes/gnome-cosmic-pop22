import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as applications from './applications.js';

// lookup() hands back the extension metadata object, so the Ext instance lives
// on stateObj. globalThis.popShell is the same object, published by pop-shell's
// enable() as a fallback for when the lookup happens mid lifecycle.
function with_pop_shell(callback) {
    let pop_shell = Main.extensionManager.lookup("pop-shell@system76.com");
    let ext = pop_shell?.stateObj?.ext || globalThis.popShell;
    if (ext) {
        return callback(ext);
    }
}

export const OVERVIEW_WORKSPACES = 0;
export const OVERVIEW_APPLICATIONS = 1;
export const OVERVIEW_LAUNCHER = 2;

const LAUNCHER_UNAVAILABLE = 'unavailable';

export function overview_visible(kind) {
    if (kind === OVERVIEW_WORKSPACES) {
        return Main.overview.visible && !applications.visible();
    } else if (kind === OVERVIEW_APPLICATIONS) {
        return applications.visible();
    } else if (kind === OVERVIEW_LAUNCHER) {
        let is_visible = with_pop_shell((ext) => {
            return Boolean(ext.window_search?.dialog?.visible || ext.window_search?.opened);
        });
        return Boolean(is_visible);
    } else {
        return Main.overview.visible;
    }
    return false;
}

export function overview_show(kind) {
    if (kind === OVERVIEW_WORKSPACES) {
        applications.hide();
        Main.overview.show();
    } else if (kind === OVERVIEW_APPLICATIONS) {
        if (Main.overview.visible) {
            Main.overview.hide();
        }
        applications.show();
    } else if (kind === OVERVIEW_LAUNCHER) {
        if (Main.overview.visible) {
            Main.overview.hide();
        }
        if (applications.visible()) {
            applications.hide();
        }
        // The Pop Launcher lives in a separate service process, and pop-shell
        // itself may be missing or disabled. open() reports back what it did,
        // so the drawer only takes over when the launcher genuinely cannot
        // show up. A spawn failure never raises: it is reported as
        // 'unavailable', which is precisely the case a thrown exception used
        // to miss. 'suppressed' means pop-shell chose not to open (already
        // open, or a fullscreen window has focus), and that choice stands.
        let outcome;
        try {
            outcome = with_pop_shell((ext) => {
                if (!ext.window_search)
                    return LAUNCHER_UNAVAILABLE;
                ext.tiler?.exit?.(ext);
                ext.window_search.load_desktop_files?.();
                return ext.window_search.open(ext);
            });
        } catch (e) {
            console.error(`pop-cosmic: Pop Launcher unavailable, falling back to the applications drawer: ${e}`);
            outcome = LAUNCHER_UNAVAILABLE;
        }
        // undefined means pop-shell is not loaded at all.
        if ((outcome ?? LAUNCHER_UNAVAILABLE) === LAUNCHER_UNAVAILABLE) {
            applications.show();
        }
    } else {
        Main.overview.show();
    }
}

export function overview_hide(kind) {
    if (kind === OVERVIEW_LAUNCHER) {
        with_pop_shell((ext) => {
            ext.window_search?.close?.();
            ext.exit_modes?.();
        });
    } else if (kind === OVERVIEW_APPLICATIONS) {
        applications.hide();
    } else {
        Main.overview.hide();
    }
}

export function overview_toggle(kind) {
    if (Main.overview.animationInProgress) {
        return;
    }
    if (overview_visible(kind)) {
        overview_hide(kind);
    } else {
        overview_show(kind);
    }
}
