import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.cosmic-workspaces';

const POP_SETTINGS_DESKTOP_ID = 'pop-settings.desktop';
const POP_SETTINGS_COMMAND = 'pop-settings';

// Resolve Pop Settings through the desktop entry first, then through the
// command on PATH. Never hardcode an install location: the suite has to work
// from any user account and any prefix.
function pop_settings_app_info() {
    const desktop_app = Gio.DesktopAppInfo.new(POP_SETTINGS_DESKTOP_ID);
    if (desktop_app !== null)
        return desktop_app;

    if (GLib.find_program_in_path(POP_SETTINGS_COMMAND) === null)
        return null;

    try {
        return Gio.AppInfo.create_from_commandline(
            POP_SETTINGS_COMMAND,
            _('Pop Settings'),
            Gio.AppInfoCreateFlags.NONE
        );
    } catch (e) {
        console.error(`cosmic-workspaces: cannot build launcher for Pop Settings: ${e}`);
        return null;
    }
}

// Build the row that opens Pop Settings. When Pop Settings is not installed
// the row stays visible but insensitive, so the preferences dialog degrades
// quietly instead of offering a button that fails.
function pop_settings_group() {
    const group = new Adw.PreferencesGroup({
        title: _('Settings Center'),
        description: _('Open the integrated Pop COSMIC panel to configure every desktop option.'),
    });

    const app_info = pop_settings_app_info();

    const row = new Adw.ActionRow({
        title: _('Pop Settings'),
        subtitle: app_info !== null
            ? _('Open the full Pop COSMIC settings application.')
            : _('Pop Settings is not installed on this system.'),
    });

    const button = new Gtk.Button({
        label: _('Open Pop Settings'),
        valign: Gtk.Align.CENTER,
        css_classes: ['suggested-action'],
        sensitive: app_info !== null,
    });

    button.connect('clicked', () => {
        try {
            app_info?.launch([], null);
        } catch (e) {
            console.error(`cosmic-workspaces: failed to launch Pop Settings: ${e}`);
        }
    });

    row.add_suffix(button);
    row.set_activatable_widget(button);
    group.add(row);

    return group;
}

export default class CosmicWorkspacesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SETTINGS_SCHEMA);

        // Page 1: Workspaces & Overview
        const overviewPage = new Adw.PreferencesPage({
            title: _('Workspaces'),
            icon_name: 'view-paged-symbolic',
        });
        window.add(overviewPage);

        overviewPage.add(pop_settings_group());

        // Group: Workspace Thumbnails
        const thumbnailsGroup = new Adw.PreferencesGroup({
            title: _('Workspace Thumbnails'),
            description: _('Configuration for the vertical workspace column in the Overview'),
        });
        overviewPage.add(thumbnailsGroup);

        // Thumbnails position: Left or Right
        const posModel = new Gtk.StringList();
        posModel.append(_('Left'));
        posModel.append(_('Right'));
        const posRow = new Adw.ComboRow({
            title: _('Thumbnails Position'),
            subtitle: _('Side of the monitor where workspace thumbnails are displayed'),
            model: posModel,
            selected: settings.get_int('thumbnails-position') === 1 ? 1 : 0,
        });
        posRow.connect('notify::selected', () => {
            settings.set_int('thumbnails-position', posRow.selected);
        });
        thumbnailsGroup.add(posRow);

        // Left offset
        const leftOffsetRow = new Adw.SpinRow({
            title: _('Left Offset (pixels)'),
            subtitle: _('Distance between the left side of the monitor and the workspaces display'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 800,
                step_increment: 10,
                page_increment: 50,
            }),
        });
        settings.bind('left-offset', leftOffsetRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        thumbnailsGroup.add(leftOffsetRow);

        // Right offset
        const rightOffsetRow = new Adw.SpinRow({
            title: _('Right Offset (pixels)'),
            subtitle: _('Distance between the right side of the monitor and the workspaces display'),
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 800,
                step_increment: 10,
                page_increment: 50,
            }),
        });
        settings.bind('right-offset', rightOffsetRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        thumbnailsGroup.add(rightOffsetRow);

        // Workspace peek distance
        const peekRow = new Adw.SpinRow({
            title: _('Workspace Peek Distance'),
            subtitle: _('Visible margin of adjacent workspaces in the Overview (in pixels)'),
            adjustment: new Gtk.Adjustment({
                lower: 0,
                upper: 500,
                step_increment: 5,
                page_increment: 20,
            }),
        });
        settings.bind('workspace-peek-distance', peekRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        thumbnailsGroup.add(peekRow);

        // Group: Appearance and Backgrounds
        const appearanceGroup = new Adw.PreferencesGroup({
            title: _('Appearance & Backgrounds'),
        });
        overviewPage.add(appearanceGroup);

        const staticBgRow = new Adw.SwitchRow({
            title: _('Static Background'),
            subtitle: _('Add static desktop background in the Overview'),
        });
        settings.bind('static-background', staticBgRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(staticBgRow);

        const scaleBgRow = new Adw.SwitchRow({
            title: _('Scaling Workspace Background'),
            subtitle: _('Scale workspace background during transitions in the Overview'),
        });
        settings.bind('scaling-workspace-background', scaleBgRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(scaleBgRow);

        const panelOverviewRow = new Adw.SwitchRow({
            title: _('Top Bar in Overview'),
            subtitle: _('Disable top bar turning transparent in the Overview'),
        });
        settings.bind('panel-in-overview', panelOverviewRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(panelOverviewRow);

        const oldStyleRow = new Adw.SwitchRow({
            title: _('Connected Side Boxes (Old Style)'),
            subtitle: _('Display workspace thumbnails in boxes connected to the sides of the screen'),
        });
        settings.bind('old-style', oldStyleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(oldStyleRow);

        // Page 2: Dash & Compatibility
        const dashPage = new Adw.PreferencesPage({
            title: _('Dash & Compatibility'),
            icon_name: 'preferences-desktop-apps-symbolic',
        });
        window.add(dashPage);

        const dashGroup = new Adw.PreferencesGroup({
            title: _('Integrated Vertical Dash'),
            description: _('Use when not running Dash to Dock or another dock extension'),
        });
        dashPage.add(dashGroup);

        const overrideDashRow = new Adw.SwitchRow({
            title: _('Override Dash'),
            subtitle: _('Enable vertical dash override inside the Overview'),
        });
        settings.bind('override-dash', overrideDashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(overrideDashRow);

        const hideDashRow = new Adw.SwitchRow({
            title: _('Hide Dash'),
            subtitle: _('Hide the dash inside the Overview'),
        });
        settings.bind('hide-dash', hideDashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(hideDashRow);

        const showAppsTopRow = new Adw.SwitchRow({
            title: _('Show Applications on Top'),
            subtitle: _('Move the Show Applications button to the top of the Dash'),
        });
        settings.bind('show-apps-on-top', showAppsTopRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(showAppsTopRow);

        const maxIconSizeRow = new Adw.SpinRow({
            title: _('Maximum Icon Size (pixels)'),
            adjustment: new Gtk.Adjustment({
                lower: 16,
                upper: 128,
                step_increment: 8,
                page_increment: 16,
            }),
        });
        settings.bind('dash-max-icon-size', maxIconSizeRow, 'value', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(maxIconSizeRow);

        const compatGroup = new Adw.PreferencesGroup({
            title: _('Compatibility'),
        });
        dashPage.add(compatGroup);

        const dtpFixRow = new Adw.SwitchRow({
            title: _('Dash to Panel Left/Right Fix'),
            subtitle: _('Width compensation when Dash to Panel is placed on screen edges'),
        });
        settings.bind('dash-to-panel-left-right-fix', dtpFixRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        compatGroup.add(dtpFixRow);
    }
}
