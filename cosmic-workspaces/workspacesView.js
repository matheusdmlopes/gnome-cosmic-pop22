import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as _Util from './util.js';

const WORKSPACE_MIN_SPACING = 24;
const WORKSPACE_MAX_SPACING = 1000;
const WORKSPACE_INACTIVE_SCALE = 0.94;
const SECONDARY_WORKSPACE_SCALE = 0.70;

export function override() {
    global.vertical_overview.GSFunctions['WorkspacesView'] =
        _Util.overrideProto(WorkspacesView.WorkspacesView.prototype, WorkspacesViewOverride);

    global.vertical_overview.GSFunctions['SecondaryMonitorDisplay'] =
        _Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, SecondaryMonitorDisplayOverride);

    if (global.vertical_overview.default_old_style_enabled) {
        Main.overview._overview?._controls?._workspacesDisplay?.add_style_class_name('vertical-overview');
    }
}

export function reset() {
    _Util.overrideProto(WorkspacesView.WorkspacesView.prototype, global.vertical_overview.GSFunctions['WorkspacesView']);
    _Util.overrideProto(WorkspacesView.SecondaryMonitorDisplay.prototype, global.vertical_overview.GSFunctions['SecondaryMonitorDisplay']);
    if (global.vertical_overview.default_old_style_enabled) {
        Main.overview._overview?._controls?._workspacesDisplay?.remove_style_class_name('vertical-overview');
    }
}

export const WorkspacesViewOverride = {
    _getWorkspaceModeForOverviewState(state) {
        const { ControlsState } = OverviewControls;

        switch (state) {
        case ControlsState.HIDDEN:
            return 0;
        case ControlsState.WINDOW_PICKER:
            return 1;
        case ControlsState.APP_GRID:
            return 1;
        }

        return 0;
    },

    _getSpacing(box, fitMode, vertical) {
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;
        let [, workspaceHeight] = workspace.get_preferred_height(width);
        if (workspaceHeight > height)
            workspaceHeight = height;

        const total_height = Main.layoutManager.primaryMonitor?.height || global.stage.height || 1080;
        const availableSpace = ((total_height - workspaceHeight) / 2) - (global.vertical_overview?.workspacePeek || 0);
        const spacing = (availableSpace) * (1 - fitMode);
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        return Math.max(spacing * scaleFactor, 0);
    },

    _getFirstFitSingleWorkspaceBox(box, spacing, vertical) {
        const [width, height] = box.get_size();
        const [workspace] = this._workspaces;

        const rtl = this.text_direction === Clutter.TextDirection.RTL;
        const adj = this._scrollAdjustment;
        const currentWorkspace = vertical || !rtl
            ? adj.value : adj.upper - adj.value - 1;

        let [x1, y1] = box.get_origin();
        let [, workspaceHeight] = workspace.get_preferred_height(width);
        if (workspaceHeight > height)
            workspaceHeight = height;

        y1 += (height - workspaceHeight) / 2;
        y1 -= currentWorkspace * (workspaceHeight + spacing);

        const fitSingleBox = new Clutter.ActorBox({ x1, y1 });
        fitSingleBox.set_size(width, workspaceHeight);

        return fitSingleBox;
    },
};

export const SecondaryMonitorDisplayOverride = {
    _getWorkspacesBoxForState(state, box, padding, leftOffset, rightOffset, spacing) {
        const { ControlsState } = OverviewControls;
        const workspaceBox = box.copy();
        const [width, height] = workspaceBox.get_size();
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        const newWidth = width - this._thumbnails.width * (scaleFactor > 1 ? scaleFactor : 2);
        const newXOrigin = this._thumbnails.x + this._thumbnails.width + spacing * 2;

        switch (state) {
        case ControlsState.HIDDEN:
            break;
        case ControlsState.WINDOW_PICKER:
        case ControlsState.APP_GRID:
            workspaceBox.set_origin(newXOrigin, padding + spacing);
            workspaceBox.set_size(
                newWidth,
                height - 2 * padding - spacing);
            break;
        }

        return workspaceBox;
    },

    vfunc_allocate(box) {
        this.set_allocation(box);

        const themeNode = this.get_theme_node();
        const contentBox = themeNode.get_content_box(box);
        const [width, height] = contentBox.get_size();
        const { expandFraction } = this._thumbnails;
        const spacing = themeNode.get_length('spacing') * expandFraction;
        const padding = Math.round((1 - SECONDARY_WORKSPACE_SCALE) * height / 2);

        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        const scale = Math.max(1, Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex).width / Main.layoutManager.primaryMonitor.width);
        const layoutManager = Main.overview._overview._controls.layoutManager;

        const leftOffset = (layoutManager.leftOffset || 300) * scale * scaleFactor;
        const rightOffset = (layoutManager.rightOffset || 300) * scale * scaleFactor;

        // Workspace Thumbnails
        if (this._thumbnails.visible) {
            const childBox = new Clutter.ActorBox();
            let origin, size;
            if (global.vertical_overview.workspace_picker_left) {
                origin = [0, 0];
                size = [leftOffset, height];
            } else {
                origin = [width - rightOffset, 0];
                size = [rightOffset, height];
            }

            childBox.set_origin(...origin);
            childBox.set_size(...size);

            this._thumbnails.allocate(childBox);
        }

        const {
            currentState, initialState, finalState, transitioning, progress,
        } = this._overviewAdjustment.getStateTransitionParams();

        let workspacesBox;
        const workspaceParams = [contentBox, padding, leftOffset, rightOffset, spacing];
        if (!transitioning) {
            workspacesBox =
                this._getWorkspacesBoxForState(currentState, ...workspaceParams);
        } else {
            const initialBox =
                this._getWorkspacesBoxForState(initialState, ...workspaceParams);
            const finalBox =
                this._getWorkspacesBoxForState(finalState, ...workspaceParams);
            workspacesBox = initialBox.interpolate(finalBox, progress);
        }
        this._workspacesView.allocate(workspacesBox);
    },
};
