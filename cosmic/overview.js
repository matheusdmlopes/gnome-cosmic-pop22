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
        let launched = false;
        // The Pop Launcher lives in a separate service process. If it is not
        // installed, or its D-Bus service fails to answer, fall back to the
        // applications drawer rather than leaving the Super key doing nothing.
        try {
            with_pop_shell((ext) => {
                if (!ext.window_search)
                    return;
                ext.tiler?.exit?.(ext);
                ext.window_search.load_desktop_files?.();
                ext.window_search.open(ext);
                launched = true;
            });
        } catch (e) {
            console.error(`pop-cosmic: Pop Launcher unavailable, falling back to the applications drawer: ${e}`);
            launched = false;
        }
        if (!launched) {
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
