import Clutter from 'gi://Clutter';
import St from 'gi://St';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';

import * as _Util from './util.js';

export function override() {
    global.vertical_overview.GSFunctions['WorkspaceSwitcherPopup'] =
        _Util.overrideProto(WorkspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype, WorkspaceSwitcherPopupOverride);
}

export function reset() {
    _Util.overrideProto(WorkspaceSwitcherPopup.WorkspaceSwitcherPopup.prototype, global.vertical_overview.GSFunctions['WorkspaceSwitcherPopup']);
}

export const WorkspaceSwitcherPopupOverride = {
    _redisplay() {
        this._list.set_vertical(true);
        if (global.vertical_overview.workspace_picker_left) {
            this.set_x_align(Clutter.ActorAlign.START);
        } else {
            this.set_x_align(Clutter.ActorAlign.END);
        }
        this.set_y_align(Clutter.ActorAlign.CENTER);

        const cosmicDock = _Util.getDock();
        if (cosmicDock) {
            const mainDock = cosmicDock.stateObj.dockManager.mainDock;
            const picker_left = global.vertical_overview.workspace_picker_left;
            const dashWidth = mainDock._slider.get_child().get_width();

            if (mainDock.get_height() > mainDock.get_y()) {
                const dock_left = mainDock.get_x() <= 0;
                if (dock_left && picker_left) {
                    this.set_translation(dashWidth, 0, 0);
                } else if (!dock_left && !picker_left) {
                    this.set_translation(-dashWidth, 0, 0);
                }
            }
        }

        const workspaceManager = global.workspace_manager;
        this._list.destroy_all_children();

        for (let i = 0; i < workspaceManager.n_workspaces; i++) {
            const indicator = new St.Bin({
                style_class: 'ws-switcher-indicator',
            });

            if (i === this._activeWorkspaceIndex)
                indicator.add_style_pseudo_class('active');

            this._list.add_child(indicator);
        }
    },
};