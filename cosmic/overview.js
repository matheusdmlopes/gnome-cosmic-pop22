import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as applications from './applications.js';

function with_pop_shell(callback) {
    let pop_shell = Main.extensionManager.lookup("pop-shell@system76.com");
    if (pop_shell && pop_shell.stateObj) {
        let ext = pop_shell.stateObj.ext || pop_shell.stateObj._ext || pop_shell.stateObj;
        if (ext) {
            return callback(ext);
        }
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
        if (with_pop_shell((ext) => {
            return ext.window_search?.dialog?.visible;
        }) === true) {
            return true;
        }
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
        Main.overview.hide();
        applications.show();
    } else if (kind === OVERVIEW_LAUNCHER) {
        Main.overview.hide();
        let launched = false;
        with_pop_shell((ext) => {
            if (ext.window_search) {
                ext.tiler?.exit?.(ext);
                ext.window_search?.load_desktop_files?.();
                ext.window_search?.open?.(ext);
                launched = true;
            }
        });
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
