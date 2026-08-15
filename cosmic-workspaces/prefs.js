import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.cosmic-workspaces';

export default class CosmicWorkspacesPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings(SETTINGS_SCHEMA);

        // Page 1: Workspaces & Overview
        const overviewPage = new Adw.PreferencesPage({
            title: 'Workspaces',
            icon_name: 'view-paged-symbolic',
        });
        window.add(overviewPage);

        // Grupo: Central Pop Settings
        const centralGroup = new Adw.PreferencesGroup({
            title: 'Central de Configurações',
            description: 'Acesse o painel integrado do Pop COSMIC para configurar todas as opções do desktop.'
        });

        const centralActionRow = new Adw.ActionRow({
            title: 'Pop Settings',
            subtitle: 'Abrir o aplicativo completo de configurações do Pop COSMIC.'
        });

        const centralButton = new Gtk.Button({
            label: 'Abrir Pop Settings',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action']
        });

        centralButton.connect('clicked', () => {
            try {
                const GLib = Gio.GLib || imports.gi.GLib;
                GLib.spawn_command_line_async("uv --directory /home/matheusdm/Desktop/projetos/pop22/pop-settings run python -m pop_settings");
            } catch (e) {
                console.error(`Failed to launch pop-settings: ${e}`);
            }
        });

        centralActionRow.add_suffix(centralButton);
        centralActionRow.set_activatable_widget(centralButton);
        centralGroup.add(centralActionRow);
        overviewPage.add(centralGroup);

        // Group: Workspace Thumbnails
        const thumbnailsGroup = new Adw.PreferencesGroup({
            title: 'Workspace Thumbnails',
            description: 'Configuration for the vertical workspace column in the Overview',
        });
        overviewPage.add(thumbnailsGroup);

        // Thumbnails position: Left or Right
        const posModel = new Gtk.StringList();
        posModel.append('Left');
        posModel.append('Right');
        const posRow = new Adw.ComboRow({
            title: 'Thumbnails Position',
            subtitle: 'Side of the monitor where workspace thumbnails are displayed',
            model: posModel,
            selected: settings.get_int('thumbnails-position') === 1 ? 1 : 0,
        });
        posRow.connect('notify::selected', () => {
            settings.set_int('thumbnails-position', posRow.selected);
        });
        thumbnailsGroup.add(posRow);

        // Left offset
        const leftOffsetRow = new Adw.SpinRow({
            title: 'Left Offset (pixels)',
            subtitle: 'Distance between the left side of the monitor and the workspaces display',
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
            title: 'Right Offset (pixels)',
            subtitle: 'Distance between the right side of the monitor and the workspaces display',
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
            title: 'Workspace Peek Distance',
            subtitle: 'Visible margin of adjacent workspaces in the Overview (in pixels)',
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
            title: 'Appearance & Backgrounds',
        });
        overviewPage.add(appearanceGroup);

        const staticBgRow = new Adw.SwitchRow({
            title: 'Static Background',
            subtitle: 'Add static desktop background in the Overview',
        });
        settings.bind('static-background', staticBgRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(staticBgRow);

        const scaleBgRow = new Adw.SwitchRow({
            title: 'Scaling Workspace Background',
            subtitle: 'Scale workspace background during transitions in the Overview',
        });
        settings.bind('scaling-workspace-background', scaleBgRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(scaleBgRow);

        const panelOverviewRow = new Adw.SwitchRow({
            title: 'Top Bar in Overview',
            subtitle: 'Disable top bar turning transparent in the Overview',
        });
        settings.bind('panel-in-overview', panelOverviewRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(panelOverviewRow);

        const oldStyleRow = new Adw.SwitchRow({
            title: 'Connected Side Boxes (Old Style)',
            subtitle: 'Display workspace thumbnails in boxes connected to the sides of the screen',
        });
        settings.bind('old-style', oldStyleRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        appearanceGroup.add(oldStyleRow);

        // Page 2: Dash & Compatibility
        const dashPage = new Adw.PreferencesPage({
            title: 'Dash & Compatibility',
            icon_name: 'preferences-desktop-apps-symbolic',
        });
        window.add(dashPage);

        const dashGroup = new Adw.PreferencesGroup({
            title: 'Integrated Vertical Dash',
            description: 'Use when not running Dash to Dock or another dock extension',
        });
        dashPage.add(dashGroup);

        const overrideDashRow = new Adw.SwitchRow({
            title: 'Override Dash',
            subtitle: 'Enable vertical dash override inside the Overview',
        });
        settings.bind('override-dash', overrideDashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(overrideDashRow);

        const hideDashRow = new Adw.SwitchRow({
            title: 'Hide Dash',
            subtitle: 'Hide the dash inside the Overview',
        });
        settings.bind('hide-dash', hideDashRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(hideDashRow);

        const showAppsTopRow = new Adw.SwitchRow({
            title: 'Show Applications on Top',
            subtitle: 'Move the Show Applications button to the top of the Dash',
        });
        settings.bind('show-apps-on-top', showAppsTopRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        dashGroup.add(showAppsTopRow);

        const maxIconSizeRow = new Adw.SpinRow({
            title: 'Maximum Icon Size (pixels)',
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
            title: 'Compatibility',
        });
        dashPage.add(compatGroup);

        const dtpFixRow = new Adw.SwitchRow({
            title: 'Dash to Panel Left/Right Fix',
            subtitle: 'Width compensation when Dash to Panel is placed on screen edges',
        });
        settings.bind('dash-to-panel-left-right-fix', dtpFixRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        compatGroup.add(dtpFixRow);
    }
}
