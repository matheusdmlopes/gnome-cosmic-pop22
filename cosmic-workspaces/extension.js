import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Gio from 'gi://Gio';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Util from './util.js';
import * as OverviewControlsOverride from './overviewControls.js';
import * as WorkspacesViewOverrides from './workspacesView.js';
import * as WorkspaceThumbnailOverrides from './workspaceThumbnail.js';
import * as WorkspaceSwitcherPopupOverride from './workspaceSwitcherPopup.js';
import * as DashOverride from './dash.js';
import * as Gestures from './gestures.js';
import * as WorkspaceOverrides from './workspace.js';

const __DEBUG__ = true;
const SHELL_KEYBINDINGS_SCHEMA = 'org.gnome.shell.keybindings';
const WM_KEYBINDINGS_SCHEMA = 'org.gnome.desktop.wm.keybindings';

const WM_KEYS_OVERRIDE = {
    'switch-to-workspace-up': ['<Super>Page_Up', '<Control><Alt>Up', '<Primary><Super>Up', '<Primary><Super>k'],
    'switch-to-workspace-down': ['<Super>Page_Down', '<Control><Alt>Down', '<Primary><Super>Down', '<Primary><Super>j'],
    'switch-to-workspace-left': ['<Super><Alt>Left', '<Control><Alt>Left', '<Primary><Super>Left', '<Primary><Super>h'],
    'switch-to-workspace-right': ['<Super><Alt>Right', '<Control><Alt>Right', '<Primary><Super>Right', '<Primary><Super>l'],
    'move-to-workspace-up': ['<Super><Shift>Page_Up', '<Control><Shift><Alt>Up', '<Primary><Shift><Super>Up', '<Primary><Shift><Super>k'],
    'move-to-workspace-down': ['<Super><Shift>Page_Down', '<Control><Shift><Alt>Down', '<Primary><Shift><Super>Down', '<Primary><Shift><Super>j'],
    'move-to-workspace-left': ['<Super><Shift><Alt>Left', '<Control><Shift><Alt>Left', '<Primary><Shift><Super>Left', '<Primary><Shift><Super>h'],
    'move-to-workspace-right': ['<Super><Shift><Alt>Right', '<Control><Shift><Alt>Right', '<Primary><Shift><Super>Right', '<Primary><Shift><Super>l'],
};

export default class CosmicWorkspacesExtension extends Extension {
    enable() {
        if (__DEBUG__) console.log('[VERTICAL-OVERVIEW] starting overrides');

        global.vertical_overview = {
            GSFunctions: {},
            extension: this,
            workspace_picker_left: true,
        };

        this._bindSettings();

        // Checar schema pop-cosmic se existir no sistema
        const defaultSource = Gio.SettingsSchemaSource.get_default();
        const settingsSchema = defaultSource ? defaultSource.lookup('org.gnome.shell.extensions.pop-cosmic', true) : null;
        if (settingsSchema !== null) {
            const settings = new Gio.Settings({ settings_schema: settingsSchema });
            global.vertical_overview.cosmic_settings = settings;
            this._popCosmicSignal = settings.connect('changed::workspace-picker-left', (s, label) => {
                if (global.vertical_overview)
                    global.vertical_overview.workspace_picker_left = s.get_boolean(label);
            });
            global.vertical_overview.workspace_picker_left = settings.get_boolean('workspace-picker-left');
        }

        OverviewControlsOverride.override();
        WorkspacesViewOverrides.override();
        WorkspaceThumbnailOverrides.override();
        WorkspaceOverrides.override();
        Gestures.override();
        DashOverride.override();
        WorkspaceSwitcherPopupOverride.override();

        // Muda layout interno para vertical
        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, true, -1, 1);

        // Rebinding keys para manter navegação vertical
        rebind_keys();
        override_wm_keybindings();

        if (__DEBUG__) console.log('[VERTICAL_OVERVIEW] enabled');
    }

    disable() {
        if (__DEBUG__) console.log('[VERTICAL-OVERVIEW] resetting overrides');

        OverviewControlsOverride.reset();
        WorkspacesViewOverrides.reset();
        WorkspaceOverrides.reset();
        WorkspaceThumbnailOverrides.reset();
        Gestures.reset();
        DashOverride.reset(true);
        WorkspaceSwitcherPopupOverride.reset();

        unbind_keys();
        restore_wm_keybindings();

        global.workspace_manager.override_workspace_layout(Meta.DisplayCorner.TOPLEFT, false, 1, -1);

        if (global.vertical_overview?.cosmic_settings && this._popCosmicSignal) {
            global.vertical_overview.cosmic_settings.disconnect(this._popCosmicSignal);
            this._popCosmicSignal = null;
        }

        if (global.vertical_overview?.settings?.signals) {
            for (const key in global.vertical_overview.settings.signals) {
                Util.unbindSetting(key);
            }
        }

        delete global.vertical_overview;
        if (__DEBUG__) console.log('[VERTICAL-OVERVIEW] disabled');
    }

    _bindSettings() {
        const controlsManager = Main.overview._overview?._controls;

        Util.bindSetting('thumbnails-position', (settings, label) => {
            if (global.vertical_overview) {
                global.vertical_overview.workspace_picker_left = settings.get_int(label) === 0;
            }
        });

        Util.bindSetting('left-offset', (settings, label) => {
            if (controlsManager?.layoutManager)
                controlsManager.layoutManager.leftOffset = settings.get_int(label);
        });

        Util.bindSetting('right-offset', (settings, label) => {
            if (controlsManager?.layoutManager)
                controlsManager.layoutManager.rightOffset = settings.get_int(label);
        });

        Util.bindSetting('scaling-workspace-background', (settings, label) => {
            if (settings.get_boolean(label)) {
                WorkspaceOverrides.scalingWorkspaceBackgroundOverride();
            } else {
                WorkspaceOverrides.scalingWorkspaceBackgroundReset();
            }
        });

        Util.bindSetting('static-background', (settings, label) => {
            if (settings.get_boolean(label)) {
                WorkspaceOverrides.staticBackgroundOverride();
            } else {
                WorkspaceOverrides.staticBackgroundReset();
            }
        });

        Util.bindSetting('workspace-peek-distance', (settings, label) => {
            if (global.vertical_overview)
                global.vertical_overview.workspacePeek = settings.get_int(label);
        });

        Util.bindSetting('dash-to-panel-left-right-fix', (settings, label) => {
            if (global.vertical_overview)
                global.vertical_overview.misc_dTPLeftRightFix = settings.get_boolean(label);
        });

        Util.bindSetting('default-old-style', (settings, label) => {
            if (global.vertical_overview) {
                global.vertical_overview.default_old_style_enabled = settings.get_boolean(label);
                DashOverride.dash_old_style();
                WorkspaceThumbnailOverrides.thumbnails_old_style();
            }
        });

        Util.bindSetting('old-style', (settings, label) => {
            if (global.vertical_overview) {
                global.vertical_overview.old_style_enabled = settings.get_boolean(label);
                DashOverride.dash_old_style();
                WorkspaceThumbnailOverrides.thumbnails_old_style();
            }
        });

        Util.bindSetting('panel-in-overview', (settings, label) => {
            if (settings.get_boolean(label)) {
                if (global.vertical_overview?.panel_signal_found) {
                    global.vertical_overview.panel_signal.disconnected = true;
                } else if (Main.overview._signalConnections) {
                    const callbackString = "()=>{this.add_style_pseudo_class('overview');}";
                    let i = 0;
                    while (i < Main.overview._signalConnections.length) {
                        const signal = Main.overview._signalConnections[i];
                        if (signal.name === 'showing') {
                            if (signal.callback?.toString().replace(/[\ \n]/g, '') === callbackString) {
                                global.vertical_overview.panel_signal = signal;
                                global.vertical_overview.panel_signal_found = true;
                                signal.disconnected = true;
                                break;
                            }
                        }
                        i++;
                    }
                }
            } else {
                if (global.vertical_overview?.panel_signal_found) {
                    global.vertical_overview.panel_signal.disconnected = false;
                }
            }
        });
    }
}

function rebind_keys() {
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down');

    const controls = Main.overview._overview?._controls;
    if (!controls) return;

    Main.wm.addKeybinding('shift-overview-up',
        new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => controls._shiftState(Meta.MotionDirection.UP));

    Main.wm.addKeybinding('shift-overview-down',
        new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => controls._shiftState(Meta.MotionDirection.DOWN));
}

function unbind_keys() {
    Main.wm.removeKeybinding('shift-overview-up');
    Main.wm.removeKeybinding('shift-overview-down');

    Main.wm.addKeybinding('shift-overview-up',
        new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => Main.overview._shiftState(Meta.MotionDirection.UP));

    Main.wm.addKeybinding('shift-overview-down',
        new Gio.Settings({ schema_id: SHELL_KEYBINDINGS_SCHEMA }),
        Meta.KeyBindingFlags.IGNORE_AUTOREPEAT,
        Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
        () => Main.overview._shiftState(Meta.MotionDirection.DOWN));
}

function override_wm_keybindings() {
    try {
        const settings = new Gio.Settings({ schema_id: WM_KEYBINDINGS_SCHEMA });
        global.vertical_overview.saved_wm_keybindings = {};

        for (const [key, newBindings] of Object.entries(WM_KEYS_OVERRIDE)) {
            global.vertical_overview.saved_wm_keybindings[key] = settings.get_strv(key);
            settings.set_strv(key, newBindings);
        }
    } catch (e) {
        console.error('[VERTICAL-OVERVIEW] Erro ao ajustar atalhos de workspace:', e);
    }
}

function restore_wm_keybindings() {
    if (!global.vertical_overview?.saved_wm_keybindings) return;
    try {
        const settings = new Gio.Settings({ schema_id: WM_KEYBINDINGS_SCHEMA });
        for (const [key, originalBindings] of Object.entries(global.vertical_overview.saved_wm_keybindings)) {
            settings.set_strv(key, originalBindings);
        }
    } catch (e) {
        console.error('[VERTICAL-OVERVIEW] Erro ao restaurar atalhos de workspace:', e);
    }
    delete global.vertical_overview.saved_wm_keybindings;
}
