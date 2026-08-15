import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import * as applications from './applications.js';
import { Service } from './dbus_service.js';
import {
    OVERVIEW_WORKSPACES,
    OVERVIEW_APPLICATIONS,
    OVERVIEW_LAUNCHER,
    overview_visible,
    overview_show,
    overview_hide,
    overview_toggle
} from './overview.js';
import { CosmicTopBarButton } from './topBarButton.js';

let activities_signal_show = null;
let appMenu_signal_show = null;
let workspaces_button = null;
let applications_button = null;
let signal_overlay_key = null;
let signal_monitors_changed = null;
let signal_notify_checked = null;
let search_signal_showing = null;
let original_signal_overlay_key = null;
let settings = null;
let touchpad_settings = null;
let service = null;

let injections = [];

function inject(object, parameter, replacement) {
    if (!object || object[parameter] === undefined)
        return;
    injections.push({
        "object": object,
        "parameter": parameter,
        "value": object[parameter]
    });
    object[parameter] = replacement;
}

const CLOCK_CENTER = 0;
const CLOCK_LEFT = 1;
const CLOCK_RIGHT = 2;

let indicatorPad = null;
function clock_alignment(alignment) {
    let dash2Panel = Main.extensionManager.lookup("dash-to-panel@jderose9.github.com");
    if (dash2Panel && dash2Panel.state === 1) {
        return;
    }

    if (Main.layoutManager.monitors.length === 0) {
        return;
    }

    const dateMenu = Main.panel.statusArea['dateMenu'];
    if (!dateMenu)
        return;
    const container = dateMenu.container;
    const parent = container.get_parent();
    if (parent != null) {
        parent.remove_child(container);
    }

    const messageList = Main.panel.statusArea.dateMenu?._messageList;
    const banner_width = messageList ? messageList.width : 400;
    const banner_offset = Main.layoutManager.monitors[0].width - banner_width;
    let clock_padding = false;

    if (Main.messageTray?._bannerBin) {
        Main.messageTray._bannerBin.width = banner_width;
    }

    if (alignment === CLOCK_LEFT) {
        Main.panel._leftBox.insert_child_at_index(container, 0);
        if (Main.messageTray?._bannerBin)
            Main.messageTray._bannerBin.x = -banner_offset;
    } else if (alignment === CLOCK_RIGHT) {
        Main.panel._rightBox.add_child(container);
        if (Main.messageTray?._bannerBin)
            Main.messageTray._bannerBin.x = banner_offset;
    } else {
        Main.panel._centerBox.add_child(container);
        if (Main.messageTray?._bannerBin)
            Main.messageTray._bannerBin.x = 0;
        clock_padding = true;
    }

    const dateMenuBox = dateMenu.get_child_at_index ? dateMenu.get_child_at_index(0) : null;
    if (dateMenuBox) {
        if (indicatorPad === null && dateMenuBox.get_child_at_index) {
            indicatorPad = dateMenuBox.get_child_at_index(0);
        }
        if (indicatorPad) {
            if (clock_padding) {
                if (indicatorPad.get_parent() === null) {
                    dateMenuBox.insert_child_at_index(indicatorPad, 0);
                }
            } else {
                if (indicatorPad.get_parent() !== null) {
                    dateMenuBox.remove_child(indicatorPad);
                }
            }
        }
    }
}

let overlay_key_action = OVERVIEW_LAUNCHER;

function overlay_key() {
    overview_toggle(overlay_key_action);
}

function overlay_key_changed(extSettings) {
    if (overview_visible(overlay_key_action)) {
        overview_hide(overlay_key_action);
    }
    overlay_key_action = extSettings.get_enum("overlay-key-action");
}

function show_application_menu(show) {
    if (!Main.panel.statusArea.appMenu)
        return;
    if (show) {
        if (appMenu_signal_show != null) {
            Main.panel.statusArea.appMenu.disconnect(appMenu_signal_show);
            appMenu_signal_show = null;
        }
        Main.panel.statusArea.appMenu.show();
    } else {
        appMenu_signal_show = Main.panel.statusArea.appMenu.connect("show", function() {
            Main.panel.statusArea.appMenu.hide();
        });
        Main.panel.statusArea.appMenu.hide();
    }
}

function switch_workspace(direction) {
    let workspaceManager = global.display.get_workspace_manager();

    if (!Main.sessionMode.hasWorkspaces) {
        return;
    }

    if (workspaceManager.n_workspaces === 1) {
        return;
    }

    if (workspaceManager.layout_rows === -1 &&
        direction !== Meta.MotionDirection.UP &&
        direction !== Meta.MotionDirection.DOWN) {
        return;
    }

    if (workspaceManager.layout_columns === -1 &&
        direction !== Meta.MotionDirection.LEFT &&
        direction !== Meta.MotionDirection.RIGHT) {
        return;
    }

    let activeWorkspace = workspaceManager.get_active_workspace();
    let newWorkspace = activeWorkspace.get_neighbor(direction);

    if (newWorkspace !== activeWorkspace) {
        newWorkspace.activate(global.get_current_time());
    }
}

function swap_for_natural(direction) {
    switch (direction) {
        case Meta.MotionDirection.UP:
            return Meta.MotionDirection.DOWN;
        case Meta.MotionDirection.DOWN:
            return Meta.MotionDirection.UP;
        case Meta.MotionDirection.LEFT:
            return Meta.MotionDirection.RIGHT;
        case Meta.MotionDirection.RIGHT:
            return Meta.MotionDirection.LEFT;
        default:
            return direction;
    }
}

function apply_scroll_settings(direction) {
    if (touchpad_settings && touchpad_settings.get_boolean('natural-scroll')) {
        return swap_for_natural(direction);
    }
    return direction;
}

function gesture_up() {
    switch_workspace(apply_scroll_settings(Meta.MotionDirection.UP));
}

function gesture_down() {
    switch_workspace(apply_scroll_settings(Meta.MotionDirection.DOWN));
}

function gesture_left() {
    if (overview_visible(OVERVIEW_WORKSPACES)) {
        overview_hide(OVERVIEW_WORKSPACES);
    } else if (overview_visible(OVERVIEW_APPLICATIONS)) {
        overview_hide(OVERVIEW_APPLICATIONS);
    } else {
        overview_show(OVERVIEW_WORKSPACES);
    }
}

function gesture_right() {
    if (overview_visible(OVERVIEW_WORKSPACES)) {
        overview_hide(OVERVIEW_WORKSPACES);
    } else if (overview_visible(OVERVIEW_APPLICATIONS)) {
        overview_hide(OVERVIEW_APPLICATIONS);
    } else {
        overview_show(OVERVIEW_APPLICATIONS);
    }
}

function monitors_changed() {
    if (settings)
        clock_alignment(settings.get_enum("clock-alignment"));
}

function gnome_40_enable(ext) {
    if (Main.layoutManager._startingUp && Main.sessionMode.hasOverview) {
        inject(Main.sessionMode, "hasOverview", false);
        Main.layoutManager.connect('startup-complete', () => {
            Main.sessionMode.hasOverview = true;
        });
    }

    if (Main.overview._overview?._controls?._searchController) {
        inject(Main.overview._overview._controls._searchController, '_onStageKeyPress', function (actor, event) {
            if (Main.modalCount > 1)
                return Clutter.EVENT_PROPAGATE;

            let symbol = event.get_key_symbol();

            if (symbol === Clutter.KEY_Escape) {
                Main.overview.hide();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    applications.enable(ext);

    const overview_show_orig = Main.overview.show;
    inject(Main.overview, 'show', function(...args) {
        overview_show_orig.apply(this, args);
        applications.hide();
    });

    const overview_hide_orig = Main.overview.hide;
    inject(Main.overview, 'hide', function(...args) {
        overview_hide_orig.apply(this, args);
        applications.hide();
    });
}

function gnome_40_disable() {
    applications.disable();
}

export default class PopCosmicExtension extends Extension {
    enable() {
        gnome_40_enable(this);

        if (AltTab.AppSwitcherPopup?.prototype) {
            inject(AltTab.AppSwitcherPopup.prototype, "_finish", function (timestamp) {
                let appIcon = this._items[this._selectedIndex];
                if (appIcon && appIcon.cachedWindows && appIcon.cachedWindows.length > 0) {
                    if (this._currentWindow < 0)
                        Main.activateWindow(appIcon.cachedWindows[0], timestamp);
                    else
                        Main.activateWindow(appIcon.cachedWindows[this._currentWindow], timestamp);
                }

                SwitcherPopup.SwitcherPopup.prototype._finish.apply(this, [timestamp]);
            });
        }

        if (Main.panel.statusArea.activities) {
            activities_signal_show = Main.panel.statusArea.activities.connect("show", function() {
                Main.panel.statusArea.activities.hide();
            });
            Main.panel.statusArea.activities.hide();
        }

        settings = this.getSettings();

        show_application_menu(settings.get_boolean("show-application-menu"));
        settings.connect("changed::show-application-menu", () => {
            show_application_menu(settings.get_boolean("show-application-menu"));
        });

        overlay_key_changed(settings);
        settings.connect("changed::overlay-key-action", () => {
            overlay_key_changed(settings);
        });

        workspaces_button = new CosmicTopBarButton(settings, OVERVIEW_WORKSPACES);
        Main.panel.addToStatusArea("cosmic_workspaces", workspaces_button, 0, "left");

        applications_button = new CosmicTopBarButton(settings, OVERVIEW_APPLICATIONS);
        Main.panel.addToStatusArea("cosmic_applications", applications_button, 1, "left");

        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            if (!Main.overview._initCalled)
                return GLib.SOURCE_CONTINUE;

            if (Main.overview.searchEntry)
                Main.overview.searchEntry.hide();

            return GLib.SOURCE_REMOVE;
        });

        inject(Main.layoutManager, "_updateVisibility", function () {
            let inOverview = Main.overview.visible || Main.overview._visible;
            let showAppsChecked = Main.overview.dash?.showAppsButton?.checked ?? false;
            let windowsVisible = (Main.sessionMode.hasWindows && !inOverview) || showAppsChecked;

            global.window_group.visible = windowsVisible;
            global.top_window_group.visible = windowsVisible;

            if (this._trackedActors) {
                this._trackedActors.forEach(this._updateActorVisibility.bind(this));
            }
        });

        original_signal_overlay_key = GObject.signal_handler_find(global.display, { signalId: "overlay-key" });
        if (original_signal_overlay_key !== null) {
            global.display.block_signal_handler(original_signal_overlay_key);
        }

        const A11Y_SCHEMA = 'org.gnome.desktop.a11y.keyboard';
        const STICKY_KEYS_ENABLE = 'stickykeys-enable';
        try {
            let _a11ySettings = new Gio.Settings({ schema_id: A11Y_SCHEMA });
            signal_overlay_key = global.display.connect("overlay-key", () => {
                if (!_a11ySettings.get_boolean(STICKY_KEYS_ENABLE))
                    overlay_key();
            });
        } catch {
            signal_overlay_key = global.display.connect("overlay-key", () => {
                overlay_key();
            });
        }

        const SHELL_KEYBINDINGS_SCHEMA = 'org.gnome.shell.keybindings';
        Main.wm.removeKeybinding('toggle-application-view');
        Main.wm.addKeybinding(
            'toggle-application-view',
            new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
            Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            () => overview_toggle(OVERVIEW_APPLICATIONS)
        );

        settings.connect("changed::clock-alignment", () => {
            clock_alignment(settings.get_enum("clock-alignment"));
        });

        signal_monitors_changed = Main.layoutManager.connect('monitors-changed', monitors_changed);
        monitors_changed();

        const DESKTOP_PERIPHERALS_TOUCHPAD_SCHEMA = 'org.gnome.desktop.peripherals.touchpad';
        try {
            touchpad_settings = new Gio.Settings({ schema_id: DESKTOP_PERIPHERALS_TOUCHPAD_SCHEMA });
        } catch {}

        service = new Service();
        service.GestureLeft = () => { gesture_left(); };
        service.GestureRight = () => { gesture_right(); };
        service.GestureUp = () => { gesture_up(); };
        service.GestureDown = () => { gesture_down(); };
        service.ToggleApplications = () => { overview_toggle(OVERVIEW_APPLICATIONS); };
        service.ToggleLauncher = () => { overview_toggle(OVERVIEW_LAUNCHER); };
        service.ToggleWorkspaces = () => { overview_toggle(OVERVIEW_WORKSPACES); };
    }

    disable() {
        if (service !== null) {
            service.destroy();
            service = null;
        }

        gnome_40_disable();

        if (signal_monitors_changed !== null) {
            Main.layoutManager.disconnect(signal_monitors_changed);
            signal_monitors_changed = null;
        }

        const SHELL_KEYBINDINGS_SCHEMA = 'org.gnome.shell.keybindings';
        Main.wm.removeKeybinding('toggle-application-view');

        let obj = Main.overview._overview?._controls;
        if (obj && obj._toggleAppsPage) {
            Main.wm.addKeybinding(
                'toggle-application-view',
                new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
                Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
                obj._toggleAppsPage.bind(obj)
            );
        }

        if (signal_overlay_key !== null) {
            global.display.disconnect(signal_overlay_key);
            signal_overlay_key = null;
        }

        if (original_signal_overlay_key !== null) {
            global.display.unblock_signal_handler(original_signal_overlay_key);
            original_signal_overlay_key = null;
        }

        if (signal_notify_checked !== null && Main.overview.dash?.showAppsButton) {
            Main.overview.dash.showAppsButton.disconnect(signal_notify_checked);
            signal_notify_checked = null;
        }
        if (search_signal_showing !== null) {
            Main.overview.disconnect(search_signal_showing);
            search_signal_showing = null;
        }
        if (Main.overview.searchEntry)
            Main.overview.searchEntry.show();

        if (Main.overview._overview)
            Main.overview._overview.remove_style_class_name("cosmic-solid-bg");

        if (applications_button !== null) {
            applications_button.destroy();
            applications_button = null;
        }

        if (workspaces_button !== null) {
            workspaces_button.destroy();
            workspaces_button = null;
        }

        show_application_menu(true);

        if (activities_signal_show !== null && Main.panel.statusArea.activities) {
            Main.panel.statusArea.activities.disconnect(activities_signal_show);
            activities_signal_show = null;
            Main.panel.statusArea.activities.show();
        }

        for (let i = injections.length - 1; i >= 0; i--) {
            let injection = injections[i];
            if (injection.object) {
                injection.object[injection.parameter] = injection.value;
            }
        }
        injections = [];

        clock_alignment(CLOCK_CENTER);

        touchpad_settings = null;
        settings = null;
    }
}
