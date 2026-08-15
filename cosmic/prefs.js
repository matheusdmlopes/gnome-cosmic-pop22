import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class PopCosmicPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();
        const page = new Adw.PreferencesPage();
        page.set_title(_("Pop COSMIC"));
        page.set_icon_name("preferences-desktop-display-symbolic");

        // Grupo: Central Pop Settings
        const centralGroup = new Adw.PreferencesGroup({
            title: _("Central de Configurações"),
            description: _("Acesse o painel integrado do Pop COSMIC para configurar todas as opções do desktop.")
        });

        const centralActionRow = new Adw.ActionRow({
            title: _("Pop Settings"),
            subtitle: _("Abrir o aplicativo completo de configurações do Pop COSMIC.")
        });

        const centralButton = new Gtk.Button({
            label: _("Abrir Pop Settings"),
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action']
        });

        centralButton.connect('clicked', () => {
            try {
                GLib.spawn_command_line_async("uv --directory /home/matheusdm/Desktop/projetos/pop22/pop-settings run python -m pop_settings");
            } catch (e) {
                console.error(`Failed to launch pop-settings: ${e}`);
            }
        });

        centralActionRow.add_suffix(centralButton);
        centralActionRow.set_activatable_widget(centralButton);
        centralGroup.add(centralActionRow);
        page.add(centralGroup);

        // Grupo: Barra Superior
        const topBarGroup = new Adw.PreferencesGroup({
            title: _("Barra Superior"),
            description: _("Ajustes individuais para esta extensão.")
        });

        // Workspaces Button
        const workspacesRow = new Adw.SwitchRow({
            title: _("Botão Workspaces"),
            subtitle: _("Exibe o botão de alternância de áreas de trabalho no painel.")
        });
        settings.bind("show-workspaces-button", workspacesRow, "active", Gio.SettingsBindFlags.DEFAULT);
        topBarGroup.add(workspacesRow);

        // Applications Button
        const appsRow = new Adw.SwitchRow({
            title: _("Botão Applications"),
            subtitle: _("Exibe o botão da gaveta de aplicativos Pop no painel.")
        });
        settings.bind("show-applications-button", appsRow, "active", Gio.SettingsBindFlags.DEFAULT);
        topBarGroup.add(appsRow);

        // App Menu
        const appMenuRow = new Adw.SwitchRow({
            title: _("Menu da Aplicação"),
            subtitle: _("Exibe o menu do aplicativo ativo no painel.")
        });
        settings.bind("show-application-menu", appMenuRow, "active", Gio.SettingsBindFlags.DEFAULT);
        topBarGroup.add(appMenuRow);

        // Clock Alignment
        const clockRow = new Adw.ComboRow({
            title: _("Posição do Relógio"),
            subtitle: _("Alinhamento da data e hora no painel superior."),
            model: Gtk.StringList.new([_("Centro"), _("Esquerda"), _("Direita")])
        });
        clockRow.set_selected(settings.get_enum("clock-alignment"));
        clockRow.connect("notify::selected", () => {
            settings.set_enum("clock-alignment", clockRow.get_selected());
        });
        topBarGroup.add(clockRow);

        // Super Key Action
        const superRow = new Adw.ComboRow({
            title: _("Ação da Tecla Super"),
            subtitle: _("Comportamento ao pressionar a tecla Super."),
            model: Gtk.StringList.new([_("Workspaces"), _("Applications"), _("Pop Launcher")])
        });
        superRow.set_selected(settings.get_enum("overlay-key-action"));
        superRow.connect("notify::selected", () => {
            settings.set_enum("overlay-key-action", superRow.get_selected());
        });
        topBarGroup.add(superRow);

        page.add(topBarGroup);
        window.add(page);
    }
}
