import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

export function override() {
    const workspacesDisplay = Main.overview._overview?._controls?._workspacesDisplay;
    if (workspacesDisplay?._swipeTracker) {
        workspacesDisplay._swipeTracker.orientation = Clutter.Orientation.VERTICAL;
    }

    const workspaceAnimation = Main.wm?._workspaceAnimation;
    if (workspaceAnimation?._swipeTracker) {
        workspaceAnimation._swipeTracker.orientation = Clutter.Orientation.VERTICAL;
    }
}

export function reset() {
    const workspacesDisplay = Main.overview._overview?._controls?._workspacesDisplay;
    if (workspacesDisplay?._swipeTracker) {
        workspacesDisplay._swipeTracker.orientation = Clutter.Orientation.HORIZONTAL;
    }

    const workspaceAnimation = Main.wm?._workspaceAnimation;
    if (workspaceAnimation?._swipeTracker) {
        workspaceAnimation._swipeTracker.orientation = Clutter.Orientation.HORIZONTAL;
    }
}