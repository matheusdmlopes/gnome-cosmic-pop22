import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Background from 'resource:///org/gnome/shell/ui/background.js';
import * as Workspace from 'resource:///org/gnome/shell/ui/workspace.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

import * as _Util from './util.js';

const NUM_WORKSPACES_THRESHOLD = 2;
export const MAX_THUMBNAIL_SCALE = 0.05;
const RESCALE_ANIMATION_TIME = 200;
const SLIDE_ANIMATION_TIME = 200;
const WORKSPACE_CUT_SIZE = 10;
const WORKSPACE_KEEP_ALIVE_TIME = 100;
const MUTTER_SCHEMA = 'org.gnome.mutter';

export function override() {
    global.vertical_overview.GSFunctions['ThumbnailsBox'] =
        _Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, ThumbnailsBoxOverride);
    global.vertical_overview.GSFunctions['WorkspaceThumbnail'] =
        _Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, WorkspaceThumbnailOverride);

    const thumbnailsBox = Main.overview._overview?._controls?._thumbnailsBox;
    if (thumbnailsBox)
        thumbnailsBox.x_align = Clutter.ActorAlign.FILL;
}

export function reset() {
    _Util.overrideProto(WorkspaceThumbnail.ThumbnailsBox.prototype, global.vertical_overview.GSFunctions['ThumbnailsBox']);
    _Util.overrideProto(WorkspaceThumbnail.WorkspaceThumbnail.prototype, global.vertical_overview.GSFunctions['WorkspaceThumbnail']);

    const thumbnailsBox = Main.overview._overview?._controls?._thumbnailsBox;
    if (thumbnailsBox)
        thumbnailsBox.x_align = Clutter.ActorAlign.CENTER;
}

export function thumbnails_old_style() {
    const thumbnailsBox = Main.overview._overview?._controls?._thumbnailsBox;
    if (!thumbnailsBox) return;

    if (global.vertical_overview.old_style_enabled && global.vertical_overview.default_old_style_enabled) {
        thumbnailsBox.add_style_class_name('vertical-overview');
    } else {
        thumbnailsBox.remove_style_class_name('vertical-overview');
    }
}

export const ThumbnailsBoxOverride = {
    _updateShouldShow() {
        const shouldShow = true;

        if (this._shouldShow === shouldShow)
            return;

        this._shouldShow = shouldShow;
        this.notify('should-show');
    },

    _activateThumbnailAtPoint(stageX, stageY, time) {
        const [_r, _x, y] = this.transform_stage_point(stageX, stageY);

        const thumbnail = this._thumbnails.find(t => y >= t.y && y <= t.y + t.height);
        if (thumbnail)
            thumbnail.activate(time);
    },

    _getPlaceholderTarget(index, spacing, rtl) {
        const workspace = this._thumbnails[index];

        let targetY1 = workspace.y - spacing - WORKSPACE_CUT_SIZE;
        let targetY2 = workspace.y + WORKSPACE_CUT_SIZE;

        if (index === 0)
            targetY1 += spacing + WORKSPACE_CUT_SIZE;

        if (index === this._dropPlaceholderPos) {
            const placeholderHeight = this._dropPlaceholder.get_height() + spacing;
            targetY1 -= placeholderHeight;
        }

        return [targetY1, targetY2];
    },

    _withinWorkspace(y, index, rtl) {
        const length = this._thumbnails.length;
        const workspace = this._thumbnails[index];

        let workspaceY1 = workspace.y + WORKSPACE_CUT_SIZE;
        let workspaceY2 = workspace.y + workspace.height - WORKSPACE_CUT_SIZE;

        if (index === length - 1)
            workspaceY2 += WORKSPACE_CUT_SIZE;

        return y > workspaceY1 && y <= workspaceY2;
    },

    handleDragOver(source, actor, x, y, time) {
        if (!source.metaWindow &&
            (!source.app || !source.app.can_open_new_window()) &&
            (source.app || !source.shellWorkspaceLaunch) &&
            source !== Main.xdndHandler)
            return DND.DragMotionResult.CONTINUE;

        const rtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;
        const canCreateWorkspaces = Meta.prefs_get_dynamic_workspaces();
        const spacing = this.get_theme_node().get_length('spacing');

        this._dropWorkspace = -1;
        let placeholderPos = -1;
        const length = this._thumbnails.length;
        for (let i = 0; i < length; i++) {
            const index = rtl ? length - i - 1 : i;

            if (canCreateWorkspaces && source !== Main.xdndHandler) {
                const [targetStart, targetEnd] =
                    this._getPlaceholderTarget(index, spacing, rtl);

                if (y > targetStart && y <= targetEnd) {
                    placeholderPos = index;
                    break;
                }
            }

            if (this._withinWorkspace(y, index, rtl)) {
                this._dropWorkspace = index;
                break;
            }
        }

        if (this._dropPlaceholderPos !== placeholderPos) {
            this._dropPlaceholderPos = placeholderPos;
            this.queue_relayout();
        }

        if (this._dropWorkspace !== -1)
            return this._thumbnails[this._dropWorkspace].handleDragOverInternal(source, actor, time);
        else if (this._dropPlaceholderPos !== -1)
            return source.metaWindow ? DND.DragMotionResult.MOVE_DROP : DND.DragMotionResult.COPY_DROP;
        else
            return DND.DragMotionResult.CONTINUE;
    },

    vfunc_allocate(box) {
        if (this._thumbnails.length === 0)
            return;

        box.y1 += 16;
        box.y2 -= 32;

        let width;
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        const scale = Math.max(1, Main.layoutManager.getWorkAreaForMonitor(this._monitorIndex).width / Main.layoutManager.primaryMonitor.width);

        let mainDockHides = false;
        let mainDockWidth = 0;
        let mainDockHeight = 0;
        let mainDockPosition = null;
        const cosmicDock = _Util.getDock();
        if (cosmicDock) {
            const mainDock = cosmicDock.stateObj.dockManager.mainDock;
            const dockSettings = cosmicDock.stateObj.dockManager.settings;
            mainDockHides = dockSettings.intellihideMode || dockSettings.dockFixed || !dockSettings.multiMonitor;
            mainDockPosition = mainDock.position;
            [, mainDockWidth] = mainDock.get_preferred_width(-1);
            [, mainDockHeight] = mainDock.get_preferred_height(-1);
        }

        if (this._monitorIndex === Main.layoutManager.primaryIndex) {
            global.vertical_overview.workspacePickerX1 = box.x1;
            global.vertical_overview.workspacePickerWidth = box.get_width() / scaleFactor;
            width = box.get_width();
        } else {
            box.x1 = global.vertical_overview.workspacePickerX1;
            width = global.vertical_overview.workspacePickerWidth * scale * scaleFactor;

            if (mainDockPosition === St.Side.LEFT && mainDockHides) {
                box.x1 -= mainDockWidth;
            } else if (mainDockPosition === St.Side.BOTTOM && !mainDockHides) {
                box.set_size(box.get_width(), box.get_height() - mainDockHeight);
            }
        }

        let parentBox = box;
        const themeNode = this.get_theme_node();
        box = themeNode.get_content_box(parentBox);

        const portholeWidth = this._porthole.width;
        const portholeHeight = this._porthole.height;
        const ratio = portholeHeight / portholeWidth;

        let height = Math.round(width * ratio);
        let vScale = width / portholeWidth;
        let hScale = height / portholeHeight;

        let spacing = themeNode.get_length('spacing');

        const indicatorValue = this._scrollAdjustment.value;
        const indicatorUpperWs = Math.ceil(indicatorValue);
        const indicatorLowerWs = Math.floor(indicatorValue);

        let indicatorLowerY1 = 0;
        let indicatorLowerY2 = 0;
        let indicatorUpperY1 = 0;
        let indicatorUpperY2 = 0;

        if (this._dropPlaceholderPos === -1) {
            this._dropPlaceholder.allocate_preferred_size(
                ...this._dropPlaceholder.get_position());

            if (this._clearDropPlaceholderLater) {
                this._clearDropPlaceholderLater();
                if (this._dropPlaceholder.visible) {
                    const laters = global.compositor.get_laters();
                    this._dropPlaceholderLater = laters.add(
                        Meta.LaterType.BEFORE_REDRAW, () => {
                            this._dropPlaceholder.hide();
                            delete this._dropPlaceholderLater;
                            return GLib.SOURCE_REMOVE;
                        });
                }
            } else {
                this._dropPlaceholder.hide();
            }
        }

        const totalHeight = (height + spacing) * this._thumbnails.length;
        box.y1 = themeNode.get_padding(St.Side.TOP);

        const additionalScale = (box.get_height() < totalHeight) ? box.get_height() / totalHeight : 1;
        height *= additionalScale;
        width *= additionalScale;
        spacing *= additionalScale;
        vScale *= additionalScale;
        hScale *= additionalScale;

        if (!global.vertical_overview.workspace_picker_left) {
            const total_spacing = spacing * 2;
            const gap = 16 * scaleFactor;
            parentBox.x1 = portholeWidth - width - gap - total_spacing;
            if (mainDockPosition === St.Side.RIGHT && !mainDockHides) {
                parentBox.x1 -= mainDockWidth;
            } else if (this._monitorIndex === Main.layoutManager.primaryIndex &&
                       mainDockPosition === St.Side.LEFT &&
                       mainDockHides) {
                parentBox.x1 += mainDockWidth;
            }
        }

        parentBox.set_size(width + spacing * 2, parentBox.get_height());
        this.set_allocation(parentBox);

        box.x2 = box.x1 + width;

        const childBox = new Clutter.ActorBox();
        for (let i = 0; i < this._thumbnails.length; i++) {
            const thumbnail = this._thumbnails[i];
            let y1 = box.y1 + (height + spacing) * i;

            const [, placeholderHeight] = this._dropPlaceholder.get_preferred_height(-1);
            const [, placeholderWidth] = this._dropPlaceholder.get_preferred_width(-1);
            if (i === this._dropPlaceholderPos) {
                childBox.set_origin(box.x1, y1);
                childBox.set_size(placeholderWidth, placeholderHeight);
                this._dropPlaceholder.allocate(childBox);

                if (this._clearDropPlaceholderLater) {
                    this._clearDropPlaceholderLater();
                    if (!this._dropPlaceholder.visible) {
                        const laters = global.compositor.get_laters();
                        this._dropPlaceholderLater = laters.add(
                            Meta.LaterType.BEFORE_REDRAW, () => {
                                this._dropPlaceholder.show();
                                delete this._dropPlaceholderLater;
                                return GLib.SOURCE_REMOVE;
                            });
                    }
                } else {
                    this._dropPlaceholder.show();
                }
            }

            if (this._dropPlaceholderPos !== -1 && this._dropPlaceholderPos <= i)
                y1 += placeholderHeight + spacing;

            childBox.set_origin(spacing, y1);
            childBox.set_size(width, height);
            thumbnail.setScale(vScale, hScale);
            thumbnail.allocate(childBox);

            if (i === indicatorUpperWs) {
                indicatorUpperY1 = childBox.y1;
                indicatorUpperY2 = childBox.y2;
            }
            if (i === indicatorLowerWs) {
                indicatorLowerY1 = childBox.y1;
                indicatorLowerY2 = childBox.y2;
            }
        }

        const indicatorThemeNode = this._indicator.get_theme_node();
        const indicatorTopFullBorder = indicatorThemeNode.get_padding(St.Side.TOP) + indicatorThemeNode.get_border_width(St.Side.TOP);
        const indicatorBottomFullBorder = indicatorThemeNode.get_padding(St.Side.BOTTOM) + indicatorThemeNode.get_border_width(St.Side.BOTTOM);
        const indicatorLeftFullBorder = indicatorThemeNode.get_padding(St.Side.LEFT) + indicatorThemeNode.get_border_width(St.Side.LEFT);
        const indicatorRightFullBorder = indicatorThemeNode.get_padding(St.Side.RIGHT) + indicatorThemeNode.get_border_width(St.Side.RIGHT);

        childBox.x1 = spacing;
        childBox.x2 = spacing + (box.get_width() + width) / 2;

        const indicatorY1 = indicatorLowerY1 +
            (indicatorUpperY1 - indicatorLowerY1) * (indicatorValue % 1);
        const indicatorY2 = indicatorLowerY2 +
            (indicatorUpperY2 - indicatorLowerY2) * (indicatorValue % 1);

        childBox.y1 = indicatorY1 - indicatorTopFullBorder;
        childBox.y2 = indicatorY2 + indicatorBottomFullBorder;
        childBox.x1 -= indicatorLeftFullBorder;
        childBox.x2 += indicatorRightFullBorder;
        this._indicator.allocate(childBox);
    },
};

export const WorkspaceThumbnailOverride = {
    after__init() {
        this._bgManager = new Background.BackgroundManager({
            monitorIndex: this.monitorIndex,
            container: this._viewport,
            vignette: false,
            controlPosition: false,
        });
        this._viewport.set_child_below_sibling(this._bgManager.backgroundActor, null);

        this.connect('destroy', () => {
            if (this._bgManager) {
                this._bgManager.destroy();
                this._bgManager = null;
            }
        });
    },
};
