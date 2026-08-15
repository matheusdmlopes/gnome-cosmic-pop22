import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Overview from 'resource:///org/gnome/shell/ui/overview.js';
import * as SearchController from 'resource:///org/gnome/shell/ui/searchController.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as WindowManager from 'resource:///org/gnome/shell/ui/windowManager.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';
import * as WorkspacesView from 'resource:///org/gnome/shell/ui/workspacesView.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';

import * as _Util from './util.js';

export const SMALL_WORKSPACE_RATIO = 0.15;
export const DASH_MAX_HEIGHT_RATIO = 0.15;
export const SIDE_CONTROLS_ANIMATION_TIME = OverviewControls.SIDE_CONTROLS_ANIMATION_TIME || 250;

export function override() {
    const controlsManager = Main.overview._overview?._controls;
    const layoutProto = controlsManager?.layout_manager
        ? Object.getPrototypeOf(controlsManager.layout_manager)
        : OverviewControls.ControlsManagerLayout?.prototype;

    if (layoutProto) {
        global.vertical_overview.GSFunctions['ControlsManagerLayout'] =
            _Util.overrideProto(layoutProto, ControlsManagerLayoutOverride);
    }

    global.vertical_overview.GSFunctions['ControlsManager'] =
        _Util.overrideProto(OverviewControls.ControlsManager.prototype, ControlsManagerOverride);

    if (controlsManager) {
        global.vertical_overview._updateID =
            controlsManager._stateAdjustment.connect('notify::value', _updateWorkspacesDisplay.bind(controlsManager));
        global.vertical_overview._workspaceDisplayVisibleID =
            controlsManager._workspacesDisplay.connect('notify::visible', () => {
                controlsManager._workspacesDisplay._updateWorkspacesViews?.();
            });
    }
}

export function reset() {
    const controlsManager = Main.overview._overview?._controls;
    const layoutProto = controlsManager?.layout_manager
        ? Object.getPrototypeOf(controlsManager.layout_manager)
        : OverviewControls.ControlsManagerLayout?.prototype;

    if (layoutProto && global.vertical_overview?.GSFunctions?.['ControlsManagerLayout'])
        _Util.overrideProto(layoutProto, global.vertical_overview.GSFunctions['ControlsManagerLayout']);

    if (global.vertical_overview?.GSFunctions?.['ControlsManager'])
        _Util.overrideProto(OverviewControls.ControlsManager.prototype, global.vertical_overview.GSFunctions['ControlsManager']);

    if (controlsManager) {
        if (global.vertical_overview._updateID)
            controlsManager._stateAdjustment.disconnect(global.vertical_overview._updateID);
        if (global.vertical_overview._workspaceDisplayVisibleID)
            controlsManager._workspacesDisplay.disconnect(global.vertical_overview._workspaceDisplayVisibleID);
        controlsManager._workspacesDisplay.reactive = true;
        controlsManager._workspacesDisplay.setPrimaryWorkspaceVisible?.(true);
    }
}

export const ControlsManagerLayoutOverride = {
    _computeWorkspacesBoxForState(state, workAreaBox, searchHeight, dashHeight, thumbnailsHeight, spacing) {
        const workspaceBox = workAreaBox.copy();
        const [startX, startY] = workAreaBox.get_origin();
        const [width, height] = workspaceBox.get_size();

        const { expandFraction } = this._workspacesThumbnails;
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);

        switch (state) {
        case OverviewControls.ControlsState.HIDDEN:
            if (global.vertical_overview.misc_dTPLeftRightFix) {
                const [w] = Main.layoutManager.panelBox.get_size();
                const [x] = Main.layoutManager.panelBox.get_transformed_position();
                if (x > 0) {
                    workspaceBox.set_size(width - w, workspaceBox.y2);
                } else {
                    workspaceBox.set_origin(w / 2, workspaceBox.y1);
                }
            }
            break;
        case OverviewControls.ControlsState.WINDOW_PICKER:
        case OverviewControls.ControlsState.APP_GRID: {
            const newWidth = width - this._workspacesThumbnails.width * (scaleFactor > 1 ? scaleFactor : 2);
            const newXOrigin = global.vertical_overview.workspace_picker_left
                ? this._workspacesThumbnails.x + this._workspacesThumbnails.width + (spacing || 0) * 2
                : this._workspacesThumbnails.x - newWidth - (spacing || 0) * 2;
            workspaceBox.set_origin(
                newXOrigin,
                startY + searchHeight + (spacing || 0) * expandFraction);
            workspaceBox.set_size(
                newWidth,
                height - startY - (searchHeight + (spacing || 0) * expandFraction) * 2);
            break;
        }
        }

        return workspaceBox;
    },

    _getAppDisplayBoxForState(state, workAreaBox, searchHeight, dashHeight, appGridBox, spacing) {
        const [startX, startY] = workAreaBox.get_origin();
        const [width, height] = workAreaBox.get_size();
        const appDisplayBox = new Clutter.ActorBox();

        switch (state) {
        case OverviewControls.ControlsState.HIDDEN:
        case OverviewControls.ControlsState.WINDOW_PICKER:
            appDisplayBox.set_origin(startX, workAreaBox.y2);
            break;
        case OverviewControls.ControlsState.APP_GRID:
            appDisplayBox.set_origin(startX,
                startY + searchHeight + (spacing || 0));
            break;
        }

        appDisplayBox.set_size(width,
            height - startY - searchHeight - (spacing || 0)
        );

        return appDisplayBox;
    },

    vfunc_allocate(container, box) {
        const childBox = new Clutter.ActorBox();

        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        let leftOffset = (this.leftOffset || 300) * scaleFactor;
        let rightOffset = (this.rightOffset || 300) * scaleFactor;

        const spacing = this.spacing || 0;

        let startY = 0;

        if (global.vertical_overview.misc_dTPLeftRightFix) {
            const [w] = Main.layoutManager.panelBox.get_size();
            leftOffset -= w;
        } else {
            if (Main.layoutManager.panelBox && Main.layoutManager.primaryMonitor &&
                Main.layoutManager.panelBox.y === Main.layoutManager.primaryMonitor.y) {
                startY = Main.layoutManager.panelBox.height;
                box.y1 += startY;
            }
        }

        const [width, height] = box.get_size();
        let availableHeight = height;

        // Search entry
        const searchHeight = 0;
        availableHeight -= spacing;

        // Dash
        if (global.vertical_overview.dash_override) {
            if (!global.vertical_overview.settings?.object?.get_boolean('hide-dash')) {
                const dashHeight = height * (this.dashMaxHeightScale || 0.8);
                this._dash.setMaxSize(leftOffset, dashHeight);
                childBox.set_origin(0, startY);
                childBox.set_size(leftOffset, height);
                this._dash.allocate(childBox);
            }
        } else {
            const maxDashHeight = Math.round(box.get_height() * DASH_MAX_HEIGHT_RATIO);
            this._dash.setMaxSize(width, maxDashHeight);

            let [, dashHeight] = this._dash.get_preferred_height(width);
            dashHeight = Math.min(dashHeight, maxDashHeight);
            childBox.set_origin(0, startY + height - dashHeight);
            childBox.set_size(width, dashHeight);
            this._dash.allocate(childBox);

            availableHeight -= dashHeight + spacing;
        }

        // Workspace Thumbnails
        if (this._workspacesThumbnails.visible) {
            let origin, size;
            if (global.vertical_overview.workspace_picker_left) {
                origin = [0, startY];
                size = [leftOffset, height];
            } else {
                origin = [width - rightOffset, startY];
                size = [rightOffset, height];
            }

            const cosmicDock = _Util.getDock();
            if (cosmicDock) {
                const mainDock = cosmicDock.stateObj.dockManager.mainDock;
                const [, dashHeight] = mainDock.get_preferred_height(width);
                const [, dashWidth] = mainDock.get_preferred_width(height);

                if (mainDock.position === St.Side.BOTTOM) {
                    size[1] -= dashHeight;
                } else if (mainDock.position === St.Side.LEFT && global.vertical_overview.workspace_picker_left) {
                    origin[0] += dashWidth;
                } else if (mainDock.position === St.Side.RIGHT && !global.vertical_overview.workspace_picker_left) {
                    origin[0] -= dashWidth;
                }
            }

            childBox.set_origin(...origin);
            childBox.set_size(...size);

            this._workspacesThumbnails.allocate(childBox);
        }

        // Workspaces
        const params = [box, searchHeight, 0, this._workspacesThumbnails.height, spacing];
        const transitionParams = this._stateAdjustment.getStateTransitionParams();

        // Update cached boxes
        for (const state of Object.values(OverviewControls.ControlsState)) {
            this._cachedWorkspaceBoxes.set(
                state, this._computeWorkspacesBoxForState(state, ...params));
        }

        let workspacesBox;
        if (!transitionParams.transitioning) {
            workspacesBox = this._cachedWorkspaceBoxes.get(transitionParams.currentState);
        } else {
            const initialBox = this._cachedWorkspaceBoxes.get(transitionParams.initialState);
            const finalBox = this._cachedWorkspaceBoxes.get(transitionParams.finalState);
            workspacesBox = initialBox.interpolate(finalBox, transitionParams.progress);
        }

        this._workspacesDisplay.allocate(workspacesBox);

        // App grid
        if (this._appDisplay.visible) {
            const appParams = [box, startY, searchHeight, 0, null, spacing];
            let appDisplayBox;
            if (!transitionParams.transitioning) {
                appDisplayBox =
                    this._getAppDisplayBoxForState(transitionParams.currentState, ...appParams);
            } else {
                const initialBox =
                    this._getAppDisplayBoxForState(transitionParams.initialState, ...appParams);
                const finalBox =
                    this._getAppDisplayBoxForState(transitionParams.finalState, ...appParams);

                appDisplayBox = initialBox.interpolate(finalBox, transitionParams.progress);
            }

            this._appDisplay.allocate(appDisplayBox);
        }

        // Search
        childBox.set_origin(leftOffset, startY + searchHeight + spacing);
        childBox.set_size(width - leftOffset - rightOffset, availableHeight);
        this._searchController.allocate(childBox);
        this._runPostAllocation();
    },
};

export const ControlsManagerOverride = {
    _getFitModeForState(state) {
        switch (state) {
        case OverviewControls.ControlsState.HIDDEN:
        case OverviewControls.ControlsState.WINDOW_PICKER:
        case OverviewControls.ControlsState.APP_GRID:
            return WorkspacesView.FitMode.SINGLE;
        default:
            return WorkspacesView.FitMode.SINGLE;
        }
    },

    _getThumbnailsBoxParams() {
        const { initialState, finalState, progress } =
            this._stateAdjustment.getStateTransitionParams();

        const paramsForState = () => {
            return { opacity: 255, scale: 1 };
        };

        const initialParams = paramsForState(initialState);
        const finalParams = paramsForState(finalState);

        return [
            Util.lerp(initialParams.opacity, finalParams.opacity, progress),
            Util.lerp(initialParams.scale, finalParams.scale, progress),
        ];
    },

    _updateThumbnailsBox(animate = false) {
        const { shouldShow } = this._thumbnailsBox;
        const { searchActive } = this._searchController;
        const [opacity, scale] = this._getThumbnailsBoxParams();

        const thumbnailsBoxVisible = shouldShow && !searchActive && opacity !== 0 && !this.dash.showAppsButton.checked;
        if (thumbnailsBoxVisible) {
            this._thumbnailsBox.opacity = 0;
            this._thumbnailsBox.visible = thumbnailsBoxVisible;
        }

        const params = {
            opacity: searchActive ? 0 : opacity,
            duration: animate ? SIDE_CONTROLS_ANIMATION_TIME : 0,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => (this._thumbnailsBox.visible = thumbnailsBoxVisible),
        };

        if (!searchActive) {
            params.scale_x = scale;
            params.scale_y = scale;
        }

        this._thumbnailsBox.ease(params);
    },

    animateToOverview(state, callback) {
        this._ignoreShowAppsButtonToggle = true;

        this._searchController.prepareToEnterOverview();
        this._workspacesDisplay.prepareToEnterOverview();

        this._stateAdjustment.value = OverviewControls.ControlsState.HIDDEN;

        this._workspacesDisplay.opacity = 255;
        this._workspacesDisplay.setPrimaryWorkspaceVisible(!this.dash.showAppsButton.checked);
        this._workspacesDisplay.reactive = !this.dash.showAppsButton.checked;

        this._stateAdjustment.ease(state, {
            duration: Overview.ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onStopped: () => {
                if (callback)
                    callback();
            },
        });

        this.dash.showAppsButton.checked =
            state === OverviewControls.ControlsState.APP_GRID;

        this._ignoreShowAppsButtonToggle = false;
    },
};

function _updateWorkspacesDisplay() {
    const { initialState, finalState, progress } = this._stateAdjustment.getStateTransitionParams();
    const { searchActive } = this._searchController;

    const paramsForState = s => {
        let opacity, scale;
        switch (s) {
        case OverviewControls.ControlsState.HIDDEN:
        case OverviewControls.ControlsState.WINDOW_PICKER:
            opacity = 255;
            scale = 1;
            break;
        case OverviewControls.ControlsState.APP_GRID:
            opacity = 0;
            scale = 0.5;
            break;
        default:
            opacity = 255;
            scale = 1;
            break;
        }
        return { opacity, scale };
    };

    const initialParams = paramsForState(initialState);
    const finalParams = paramsForState(finalState);

    const opacity = Math.round(Util.lerp(initialParams.opacity, finalParams.opacity, progress));
    const scale = Util.lerp(initialParams.scale, finalParams.scale, progress);

    const workspacesDisplayVisible = (opacity !== 0) && !searchActive;
    const params = {
        opacity,
        scale,
        duration: 0,
        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        onComplete: () => {
            this._workspacesDisplay.reactive = workspacesDisplayVisible;
            this._workspacesDisplay.setPrimaryWorkspaceVisible(workspacesDisplayVisible);
        },
    };

    this._workspacesDisplay.ease(params);
}
