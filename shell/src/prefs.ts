import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

import * as focus from './focus.js';
import * as log from './log.js';

const POP_SETTINGS_DESKTOP_ID = 'pop-settings.desktop';
const POP_SETTINGS_COMMAND = 'pop-settings';

/**
 * Resolve Pop Settings through the desktop entry first, then through the
 * command on PATH. Never hardcode an install location: the suite has to work
 * from any user account and any prefix.
 */
function pop_settings_app_info(): any {
    const desktop_app = Gio.DesktopAppInfo.new(POP_SETTINGS_DESKTOP_ID);
    if (desktop_app !== null) return desktop_app;

    if (GLib.find_program_in_path(POP_SETTINGS_COMMAND) === null) return null;

    try {
        return Gio.AppInfo.create_from_commandline(
            POP_SETTINGS_COMMAND,
            'Pop Settings',
            Gio.AppInfoCreateFlags.NONE,
        );
    } catch (e) {
        console.error(`pop-shell: cannot build launcher for Pop Settings: ${e}`);
        return null;
    }
}

/**
 * Row that opens Pop Settings. When Pop Settings is not installed the row
 * stays visible but insensitive, so the dialog degrades quietly instead of
 * offering a button that fails.
 */
function pop_settings_group(): any {
    const group = new Adw.PreferencesGroup({
        title: 'Settings Center',
        description: 'Open the integrated Pop COSMIC panel to configure every desktop option.',
    });

    const app_info = pop_settings_app_info();

    const row = new Adw.ActionRow({
        title: 'Pop Settings',
        subtitle:
            app_info !== null
                ? 'Open the full Pop COSMIC settings application.'
                : 'Pop Settings is not installed on this system.',
    });

    const button = new Gtk.Button({
        label: 'Open Pop Settings',
        valign: Gtk.Align.CENTER,
        css_classes: ['suggested-action'],
        sensitive: app_info !== null,
    });

    button.connect('clicked', () => {
        try {
            app_info?.launch([], null);
        } catch (e) {
            console.error(`pop-shell: failed to launch Pop Settings: ${e}`);
        }
    });

    row.add_suffix(button);
    row.set_activatable_widget(button);
    group.add(row);

    return group;
}

/** Adw.SwitchRow two-way bound to a boolean key. */
function switch_row(settings: any, key: string, title: string, subtitle: string): any {
    const row = new Adw.SwitchRow({ title, subtitle });
    settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/** Adw.SpinRow two-way bound to an unsigned integer key. */
function spin_row(
    settings: any,
    key: string,
    title: string,
    subtitle: string,
    lower: number,
    upper: number,
    step: number,
): any {
    const row = new Adw.SpinRow({
        title,
        subtitle,
        adjustment: new Gtk.Adjustment({
            lower,
            upper,
            step_increment: step,
            page_increment: step * 5,
        }),
    });
    settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    return row;
}

/**
 * Adw.ComboRow over an unsigned integer key, where the key stores the index
 * of the chosen label.
 */
function combo_row(settings: any, key: string, title: string, labels: string[]): any {
    const row = new Adw.ComboRow({
        title,
        model: Gtk.StringList.new(labels),
    });

    const sync_from_settings = () => {
        const value = settings.get_uint(key);
        if (value < labels.length) row.set_selected(value);
    };

    sync_from_settings();

    row.connect('notify::selected', () => {
        const selected = row.get_selected();
        if (selected < labels.length && selected !== settings.get_uint(key))
            settings.set_uint(key, selected);
    });
    settings.connect(`changed::${key}`, () => sync_from_settings());

    return row;
}

/** Enum member labels, in declaration order. */
function enum_labels(source: any): string[] {
    return Object.keys(source)
        .filter(key => typeof source[key] === 'string')
        .map(key => source[key] as string);
}

export default class PopShellPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: any) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Pop Shell',
            icon_name: 'preferences-desktop-windows-symbolic',
        });

        page.add(pop_settings_group());

        const tiling_group = new Adw.PreferencesGroup({
            title: 'Tiling',
            description: 'How windows are arranged on the workspace',
        });
        tiling_group.add(
            switch_row(
                settings,
                'show-title',
                'Show Window Titles',
                'Show traditional title bars on tiled windows',
            ),
        );
        tiling_group.add(
            switch_row(
                settings,
                'snap-to-grid',
                'Snap to Grid (Floating Mode)',
                'Snap windows into the tiling grid when dragging with the mouse',
            ),
        );
        tiling_group.add(
            switch_row(
                settings,
                'smart-gaps',
                'Smart Gaps',
                'Hide outer gaps when only one window is open on the workspace',
            ),
        );
        tiling_group.add(
            switch_row(
                settings,
                'show-skip-taskbar',
                'Show Minimize to Tray Windows',
                'Include windows that hide from the taskbar when tiling',
            ),
        );
        page.add(tiling_group);

        const gaps_group = new Adw.PreferencesGroup({
            title: 'Gaps',
            description: 'Spacing between windows and screen edges, in pixels',
        });
        gaps_group.add(
            spin_row(
                settings,
                'gap-inner',
                'Inner Gaps',
                'Distance between adjacent tiled windows',
                0,
                64,
                1,
            ),
        );
        gaps_group.add(
            spin_row(
                settings,
                'gap-outer',
                'Outer Gaps',
                'Distance between windows and screen edges',
                0,
                64,
                1,
            ),
        );
        page.add(gaps_group);

        const behavior_group = new Adw.PreferencesGroup({
            title: 'Window and Mouse Behavior',
            description: 'How the pointer and the launcher interact with tiled windows',
        });
        behavior_group.add(
            switch_row(
                settings,
                'stacking-with-mouse',
                'Stack Windows with the Mouse',
                'Drop a dragged window onto another to stack them in the same tile',
            ),
        );
        behavior_group.add(
            switch_row(
                settings,
                'mouse-cursor-follows-active-window',
                'Mouse Cursor Follows Active Window',
                'Warp the pointer to the window focused by keyboard navigation',
            ),
        );
        behavior_group.add(
            switch_row(
                settings,
                'fullscreen-launcher',
                'Launcher Over Fullscreen Windows',
                'Allow the Pop Launcher to appear on top of fullscreen windows',
            ),
        );
        behavior_group.add(
            combo_row(
                settings,
                'mouse-cursor-focus-location',
                'Mouse Cursor Focus Position',
                enum_labels(focus.FocusPosition),
            ),
        );
        behavior_group.add(
            spin_row(
                settings,
                'active-hint-border-radius',
                'Active Hint Border Radius',
                'Corner rounding of the focused window highlight, in pixels',
                0,
                30,
                1,
            ),
        );
        page.add(behavior_group);

        const advanced_group = new Adw.PreferencesGroup({
            title: 'Advanced',
        });
        advanced_group.add(
            spin_row(
                settings,
                'max-window-width',
                'Maximum Window Width',
                'Widest a tiled window may become, in pixels; 0 to disable',
                0,
                8192,
                100,
            ),
        );
        advanced_group.add(
            combo_row(settings, 'log-level', 'Log Level', enum_labels(log.LOG_LEVELS)),
        );
        page.add(advanced_group);

        window.add(page);
    }
}
