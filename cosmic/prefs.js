import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

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
        console.error(`pop-cosmic: cannot build launcher for Pop Settings: ${e}`);
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
            console.error(`pop-cosmic: failed to launch Pop Settings: ${e}`);
        }
    });

    row.add_suffix(button);
    row.set_activatable_widget(button);
    group.add(row);

    return group;
}

export default class PopCosmicPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage({
            title: _('Pop COSMIC'),
            icon_name: 'preferences-desktop-display-symbolic',
        });

        page.add(pop_settings_group());

        const top_bar_group = new Adw.PreferencesGroup({
            title: _('Top Bar'),
            description: _('Settings specific to this extension.'),
        });

        const workspaces_row = new Adw.SwitchRow({
            title: _('Workspaces Button'),
            subtitle: _('Show the workspace switcher button on the top bar.'),
        });
        settings.bind('show-workspaces-button', workspaces_row, 'active', Gio.SettingsBindFlags.DEFAULT);
        top_bar_group.add(workspaces_row);

        const applications_row = new Adw.SwitchRow({
            title: _('Applications Button'),
            subtitle: _('Show the Pop application drawer button on the top bar.'),
        });
        settings.bind('show-applications-button', applications_row, 'active', Gio.SettingsBindFlags.DEFAULT);
        top_bar_group.add(applications_row);

        const app_menu_row = new Adw.SwitchRow({
            title: _('Application Menu'),
            subtitle: _('Show the focused application menu on the top bar.'),
        });
        settings.bind('show-application-menu', app_menu_row, 'active', Gio.SettingsBindFlags.DEFAULT);
        top_bar_group.add(app_menu_row);

        const clock_row = new Adw.ComboRow({
            title: _('Clock Position'),
            subtitle: _('Alignment of the date and time on the top bar.'),
            model: Gtk.StringList.new([_('Center'), _('Left'), _('Right')]),
        });
        clock_row.set_selected(settings.get_enum('clock-alignment'));
        clock_row.connect('notify::selected', () => {
            settings.set_enum('clock-alignment', clock_row.get_selected());
        });
        top_bar_group.add(clock_row);

        const super_row = new Adw.ComboRow({
            title: _('Super Key Action'),
            subtitle: _('Behavior triggered by pressing the Super key.'),
            model: Gtk.StringList.new([_('Workspaces'), _('Applications'), _('Pop Launcher')]),
        });
        super_row.set_selected(settings.get_enum('overlay-key-action'));
        super_row.connect('notify::selected', () => {
            settings.set_enum('overlay-key-action', super_row.get_selected());
        });
        top_bar_group.add(super_row);

        page.add(top_bar_group);
        window.add(page);
    }
}
