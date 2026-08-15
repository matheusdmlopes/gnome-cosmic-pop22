import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import * as Params from 'resource:///org/gnome/shell/misc/params.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';

import * as _Util from './util.js';

export const WINDOW_PREVIEW_MAXIMUM_SCALE = 0.95;
export const WINDOW_REPOSITIONING_DELAY = 750;
export const LAYOUT_SCALE_WEIGHT = 1;
export const LAYOUT_SPACE_WEIGHT = 0.1;
export const BACKGROUND_CORNER_RADIUS_PIXELS = 30;
export const BACKGROUND_MARGIN = 12;

export function updateStaticBackgrounds() {
    if (global.vertical_overview?.bgManagers) {
        for (const bg of global.vertical_overview.bgManagers) {
            bg.destroy();
        }
    }

    if (global.vertical_overview)
        global.vertical_overview.bgManagers = [];

    for (const monitor of Main.layoutManager.monitors) {
        const bgManager = new Background.BackgroundManager({
            monitorIndex: monitor.index,
            container: Main.layoutManager.overviewGroup,
        });

        global.vertical_overview?.bgManagers?.push(bgManager);
    }

    staticBackgroundEnabled = true;
    scalingWorkspaceBackgroundEnabled = true;
}

let staticBackgroundEnabled = false;
let monitorsChangedId = null;

export function staticBackgroundOverride() {
    if (!staticBackgroundEnabled) {
        if (global.vertical_overview)
            global.vertical_overview.bgManagers = [];
        monitorsChangedId = Main.layoutManager.connect('monitors-changed', () => {
            updateStaticBackgrounds();
        });
        updateStaticBackgrounds();

        staticBackgroundEnabled = true;
    }
}

export function staticBackgroundReset() {
    if (staticBackgroundEnabled) {
        if (monitorsChangedId) {
            Main.layoutManager.disconnect(monitorsChangedId);
            monitorsChangedId = null;
        }

        if (global.vertical_overview?.bgManagers) {
            for (const bg of global.vertical_overview.bgManagers) {
                bg.destroy();
            }
            delete global.vertical_overview.bgManagers;
        }
        staticBackgroundEnabled = false;
    }
}

let scalingWorkspaceBackgroundEnabled = false;
export function scalingWorkspaceBackgroundOverride() {
    if (!scalingWorkspaceBackgroundEnabled) {
        global.vertical_overview.GSFunctions['Workspace'] =
            _Util.overrideProto(Workspace.Workspace.prototype, WorkspaceOverride);
        scalingWorkspaceBackgroundEnabled = true;
    }
}

export function scalingWorkspaceBackgroundReset() {
    if (scalingWorkspaceBackgroundEnabled) {
        _Util.overrideProto(Workspace.Workspace.prototype, global.vertical_overview.GSFunctions['Workspace']);
        scalingWorkspaceBackgroundEnabled = false;
    }
}

export function override() {
    global.vertical_overview.GSFunctions['WorkspaceLayout'] =
        _Util.overrideProto(Workspace.WorkspaceLayout.prototype, WorkspaceLayoutOverride);
}

export function reset() {
    staticBackgroundReset();
    scalingWorkspaceBackgroundReset();
    _Util.overrideProto(Workspace.WorkspaceLayout.prototype, global.vertical_overview.GSFunctions['WorkspaceLayout']);
}

export const WorkspaceOverride = {
    _init(metaWorkspace, monitorIndex, overviewAdjustment) {
        St.Widget.prototype._init.call(this, {
            style_class: 'window-picker',
            pivot_point: new Graphene.Point({ x: 0.5, y: 0.5 }),
            layout_manager: new Clutter.BinLayout(),
        });

        const layoutManager = new Workspace.WorkspaceLayout(metaWorkspace, monitorIndex,
            overviewAdjustment);

        // Window previews
        this._container = new Clutter.Actor({
            reactive: true,
            x_expand: true,
            y_expand: true,
        });

        this._container.layout_manager = layoutManager;
        this.add_child(this._container);

        this.metaWorkspace = metaWorkspace;
        this._activeWorkspaceChangedId =
            this.metaWorkspace?.connect('notify::active', () => {
                layoutManager.syncOverlays();
            });

        this._overviewAdjustment = overviewAdjustment;

        this.monitorIndex = monitorIndex;
        this._monitor = Main.layoutManager.monitors[this.monitorIndex];

        if (monitorIndex !== Main.layoutManager.primaryIndex)
            this.add_style_class_name('external-monitor');

        const clickAction = new Clutter.ClickAction();
        clickAction.connect('clicked', action => {
            if (action.get_button() === 1 || action.get_button() === 0) {
                const leaveOverview = this._shouldLeaveOverview();

                this.metaWorkspace?.activate(global.get_current_time());
                if (leaveOverview)
                    Main.overview.hide();
            }
        });
        this.bind_property('mapped', clickAction, 'enabled', GObject.BindingFlags.SYNC_CREATE);
        this._container.add_action(clickAction);

        this.connect('style-changed', this._onStyleChanged.bind(this));
        this.connect('destroy', this._onDestroy.bind(this));

        this._skipTaskbarSignals = new Map();

        const windows = global.get_window_actors().map(a => a.meta_window)
            .filter(this._isMyWindow, this);

        this._windows = [];
        for (let i = 0; i < windows.length; i++) {
            if (this._isOverviewWindow(windows[i]))
                this._addWindowClone(windows[i]);
        }

        this.metaWorkspace?.connectObject(
            'window-added', this._windowAdded.bind(this), GObject.ConnectFlags.AFTER,
            'window-removed', this._windowRemoved.bind(this), GObject.ConnectFlags.AFTER,
            'notify::active', () => layoutManager.syncOverlays(), this);
        global.display.connectObject(
            'window-entered-monitor', this._windowEnteredMonitor.bind(this), GObject.ConnectFlags.AFTER,
            'window-left-monitor', this._windowLeftMonitor.bind(this), GObject.ConnectFlags.AFTER,
            this);
        this._layoutFrozenId = 0;

        this._delegate = this;
    },
};

export const WorkspaceLayoutOverride = {
    _adjustSpacingAndPadding(rowSpacing, colSpacing, containerBox) {
        if (this._sortedWindows.length === 0)
            return [rowSpacing, colSpacing, containerBox];

        const window = this._sortedWindows[0];

        const [topOversize, bottomOversize] = window.chromeHeights();
        const [leftOversize, rightOversize] = window.chromeWidths();

        const oversize =
            Math.max(topOversize, bottomOversize, leftOversize, rightOversize);

        if (rowSpacing !== null)
            rowSpacing += oversize;
        if (colSpacing !== null)
            colSpacing += oversize;

        return [rowSpacing, colSpacing, containerBox];
    },
};
