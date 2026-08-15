import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Pango from 'gi://Pango';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as Dialog from 'resource:///org/gnome/shell/ui/dialog.js';
import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
import * as OverviewControls from 'resource:///org/gnome/shell/ui/overviewControls.js';
import { PopupMenu } from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ParentalControlsManager from 'resource:///org/gnome/shell/misc/parentalControlsManager.js';
import * as RemoteSearch from 'resource:///org/gnome/shell/ui/remoteSearch.js';
import * as Search from 'resource:///org/gnome/shell/ui/search.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

let dialog = null;
let extensionInstance = null;

function getTermsForSearchString(searchString) {
    if (!searchString)
        return [];
    const trimmed = searchString.trim();
    if (trimmed === '')
        return [];
    return trimmed.split(/\s+/);
}

export const CosmicFolderEditDialog = GObject.registerClass(
class CosmicFolderEditDialog extends ModalDialog.ModalDialog {
    _init(title, description, acceptText, hasEntry, onAccept) {
        super._init();
        this.dialogLayout._dialog.add_style_class_name('cosmic-folder-edit-dialog');

        const contentBox = new Dialog.MessageDialogContent({ title, description });
        this.contentLayout.add_child(contentBox);

        if (hasEntry) {
            this._entry = new St.Entry();
            contentBox.add_child(this._entry);

            this._entry.clutter_text.connect('activate', () => {
                onAccept(this);
                this.close();
            });
        }

        this.addButton({
            label: _("Cancel"),
            action: () => this.close(),
            key: Clutter.KEY_Escape,
        });

        this.addButton({
            label: acceptText,
            action: () => {
                onAccept(this);
                this.close();
            },
            default: true,
        });

        this.open();

        if (this._entry)
            this._entry.grab_key_focus();
    }

    get entry() {
        if (this._entry)
            return this._entry;
        return null;
    }
});

// Used for `CosmicFolderButton`, and also add folder button
export const CosmicBaseFolderButton = GObject.registerClass(
class CosmicBaseFolderButton extends St.Button {
    _init(icon_name) {
        this._icon = new IconGrid.BaseIcon("", {
            createIcon: size => {
                return new St.Icon({
                    icon_name: icon_name,
                    icon_size: size,
                    style_class: 'cosmic-applications-icon'
                });
            },
            setSizeManually: true
        });
        this._icon.setIconSize(32);

        super._init({ child: this._icon, style_class: 'app-well-app' });

        this.add_style_class_name('cosmic-base-folder-button');
    }

    get label() {
        return this._icon.label;
    }
});

// Button for a folder, or "Library Home"
export const CosmicFolderButton = GObject.registerClass({
    Signals: { 'apps-changed': {} },
    Properties: {
        'name': GObject.ParamSpec.string(
            'name', 'name', 'name',
            GObject.ParamFlags.READABLE,
            null),
    },
}, class CosmicFolderButton extends CosmicBaseFolderButton {
    _init(appDisplay, id) {
        this._appDisplay = appDisplay;
        this._id = id;

        let icon_name;
        if (id === null) {
            icon_name = 'go-home-symbolic';
            this._settings = null;
        } else {
            icon_name = 'folder-symbolic';

            const path = `/org/gnome/desktop/app-folders/folders/${id}/`;
            this._settings = new Gio.Settings({
                schema_id: 'org.gnome.desktop.app-folders.folder',
                path
            });

            this.appsChangedId = this.settings.connect('changed::apps', () => this._updateApps());
            this.nameChangedId = this.settings.connect('changed::name', () => this._updateName());
        }

        super._init(icon_name);
        this._delegate = this;

        this.connect('clicked', () => this._appDisplay.setFolder(this.id));
        this.connect('destroy', this._onDestroy.bind(this));
        this._updateApps();
        this._updateName();
    }

    vfunc_map() {
        this._connectDnD();
        super.vfunc_map();
    }

    vfunc_unmap() {
        this._disconnectDnD();
        super.vfunc_unmap();
    }

    _connectDnD() {
        this._dragMonitor = {
            dragMotion: this._onDragMotion.bind(this),
        };
        DND.addDragMonitor(this._dragMonitor);
    }

    _disconnectDnD() {
        if (this._dragMonitor) {
            DND.removeDragMonitor(this._dragMonitor);
            this._dragMonitor = null;
        }
    }

    _onDestroy() {
        if (this.settings) {
            this.settings.disconnect(this.appsChangedId);
            this.settings.disconnect(this.nameChangedId);
        }

        this._disconnectDnD();
    }

    get id() {
        return this._id;
    }

    get settings() {
        return this._settings;
    }

    get apps() {
        return this._apps;
    }

    get name() {
        return this._name;
    }

    _updateApps() {
        if (this.settings === null) {
            this._apps = null;
            return;
        }

        const categories = this.settings.get_strv('categories');
        const excludedApps = this.settings.get_strv('excluded-apps');
        const apps = this.settings.get_strv('apps');
        const appInfos = Shell.AppSystem.get_default().get_installed();
        this._apps = appInfos.filter(function(x) {
            if (excludedApps.includes(x.get_id())) {
                return false;
            } else if (apps.includes(x.get_id())) {
                return true;
            } else if (categories.length !== 0) {
                let app_categories = x.get_categories();
                app_categories = app_categories ? app_categories.split(';') : [];
                for (const category of app_categories) {
                    if (category && categories.includes(category)) {
                        return true;
                    }
                }
                return false;
            } else {
                return false;
            }
        }).map(x => x.get_id());

        this.emit('apps-changed');
    }

    _updateName() {
        if (this.settings === null) {
            this._name = _('Library Home');
        } else {
            let name = this.settings.get_string('name');
            if (this.settings.get_boolean('translate')) {
                const translated = Shell.util_get_translated_folder_name(name) ||
                                   Shell.util_get_translated_folder_name(this._id);
                if (translated !== null)
                    name = translated;
            }
            if (!name || name === '') {
                name = this._id;
            }
            if (name.endsWith('.directory')) {
                name = name.replace(/\.directory$/, '');
                if (name === 'suse-yast')
                    name = 'YaST';
                else if (name.startsWith('X-GNOME-'))
                    name = name.replace(/^X-GNOME-/, '');
            }
            this._name = name;
        }

        this.label.text = this._name || _('Untitled');
        this.notify('name');
    }

    _onDragMotion(dragEvent) {
        if (!this.contains(dragEvent.targetActor))
            this.remove_style_pseudo_class('drop');
        return DND.DragMotionResult.CONTINUE;
    }

    handleDragOver(source, _actor, _x, _y, _time) {
        if (!(source instanceof AppDisplay.AppIcon) || !this._appDisplay.contains(source))
            return DND.DragMotionResult.CONTINUE;

        this.add_style_pseudo_class('drop');

        return DND.DragMotionResult.COPY_DROP;
    }

    acceptDrop(source, _actor, _x, _y, _time) {
        if (!(source instanceof AppDisplay.AppIcon) || !this._appDisplay.contains(source))
            return false;

        const id = source.getId();

        // Remove from previous folder
        const prev_folder = this._appDisplay.folder;
        if (prev_folder.id !== null) {
            if (prev_folder.settings.get_strv('categories').length > 0) {
                let excluded_apps = prev_folder.settings.get_strv('excluded-apps');
                if (!excluded_apps.includes(id))
                    excluded_apps.push(id);
                prev_folder.settings.set_strv('excluded-apps', excluded_apps);
            }

            const apps = prev_folder.apps.filter(x => x !== id);
            prev_folder.settings.set_strv('apps', apps);
        }

        if (this.settings !== null) {
            let excluded_apps = this.settings.get_strv('excluded-apps');
            excluded_apps = excluded_apps.filter(x => x !== id);
            this.settings.set_strv('excluded-apps', excluded_apps);

            let apps = this.settings.get_strv('apps');
            if (!apps.includes(id))
                apps.push(id);
            this.settings.set_strv('apps', apps);
        }

        this.remove_style_pseudo_class('drop');

        return true;
    }
});

export const CosmicAppIcon = GObject.registerClass(
class CosmicAppIcon extends AppDisplay.AppIcon {
    _init(app) {
        super._init(app, { setSizeManually: true, expandTitleOnHover: false });

        this.icon.setIconSize(72);
        this.icon.x_expand = true;
        this.icon.y_expand = true;

        this.icon.label.y_expand = true;

        const text = this.icon.label.clutter_text;
        text.line_wrap = true;
        text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
        text.ellipsize = Pango.EllipsizeMode.END;

        this.add_style_class_name('cosmic-app-icon');
    }
});

export const CosmicAppsHeader = GObject.registerClass({
    Signals: {
        'delete-clicked': {},
        'rename-clicked': {},
        'search-text-changed': {},
    },
    Properties: {
        'folder': GObject.ParamSpec.object(
            'folder', 'folder', 'folder',
            GObject.ParamFlags.READWRITE,
            CosmicFolderButton.$gtype),
    },
}, class CosmicAppsHeader extends Shell.Stack {
    _init() {
        super._init();

        this._folder = null;
        this._inFolder = false;

        this._title_label = new St.Label({
            style_class: 'cosmic-applications-folder-title',
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });

        const rename_icon = new St.Icon({ icon_name: 'edit-symbolic', icon_size: 24 });
        const rename_button = new St.Button({ child: rename_icon, style_class: 'cosmic-folder-edit-button' });
        rename_button.connect('clicked', () => this.emit('rename-clicked'));

        const delete_icon = new St.Icon({ icon_name: 'edit-delete-symbolic', icon_size: 24 });
        const delete_button = new St.Button({ child: delete_icon, style_class: 'cosmic-folder-edit-button' });
        delete_button.connect('clicked', () => this.emit('delete-clicked'));

        const buttonBox = new St.BoxLayout({
            x_expand: true,
            x_align: Clutter.ActorAlign.END,
            style_class: 'cosmic-folder-edit-button-box'
        });
        buttonBox.add_child(rename_button);
        buttonBox.add_child(delete_button);

        this._folderHeader = new Shell.Stack({ opacity: 0, visible: false, x_expand: true });
        this._folderHeader.add_child(buttonBox);
        this._folderHeader.add_child(this._title_label);
        this.add_child(this._folderHeader);

        this._searchEntry = new St.Entry({
            style_class: 'cosmic-applications-search-entry',
            hint_text: _('  Type to search'),
            track_hover: true,
            can_focus: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._searchEntry);

        this._searchEntry.clutter_text.connect('text-changed', () => {
            this.emit('search-text-changed');
        });
    }

    get searchText() {
        return this._searchEntry.get_text();
    }

    get inFolder() {
        return this._inFolder;
    }

    _updateInFolder() {
        const newInFolder = this.folder && this.folder.id !== null;

        if (newInFolder === this.inFolder)
            return;

        this._inFolder = newInFolder;

        let oldPage, newPage;
        if (newInFolder)
            [oldPage, newPage] = [this._searchEntry, this._folderHeader];
        else
            [oldPage, newPage] = [this._folderHeader, this._searchEntry];

        oldPage.ease({
            opacity: 0,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => { oldPage.visible = false; },
        });

        newPage.visible = true;
        newPage.ease({
            opacity: 255,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    get folder() {
        return this._folder;
    }

    set folder(folder) {
        if (folder === this._folder)
            return;

        this._folder = folder;

        if (this._name_binding) {
            this._name_binding.unbind();
            this._name_binding = null;
        }

        if (folder && folder.id !== null) {
            this._name_binding = this.folder.bind_property(
                'name',
                this._title_label,
                'text',
                GObject.BindingFlags.SYNC_CREATE
            );
            if (this.mapped)
                this.grab_key_focus();
        } else {
            this.reset();
        }

        this._updateInFolder();
        this.notify('folder');
    }

    reset() {
        this._searchEntry.set_text('');
        if (this.mapped)
            this._searchEntry.grab_key_focus();
    }
});

// ModalDialog allocation & grab fixes for drag-and-drop
export const CosmicModalDialog = GObject.registerClass(
class CosmicModalDialog extends ModalDialog.ModalDialog {
    _init(params) {
        super._init(params);

        this.clear_constraints();
        this._backgroundBin.clear_constraints();

        if (Main.layoutManager.modalDialogGroup.contains(this)) {
            Main.layoutManager.modalDialogGroup.remove_child(this);
        }
        Main.layoutManager.uiGroup.insert_child_above(this, Main.layoutManager.overviewGroup);
    }

    monitor() {
        let index;
        if (this._monitorConstraint.primary)
            index = Main.layoutManager.primaryIndex;
        else
            index = Math.min(this._monitorConstraint.index, Main.layoutManager.monitors.length - 1);

        return Main.layoutManager.monitors[index];
    }

    vfunc_allocate(box) {
        const monitor = this.monitor();
        const width = Math.min(box.x2 - box.x1, monitor.width);
        const height = Math.min(box.y2 - box.y1, monitor.height);

        const x = Math.floor((monitor.width - width) / 2);
        const y = Math.floor((monitor.height - height) / 2);

        box.init_rect(monitor.x + x, monitor.y + y, width, height);
        this.set_allocation(box);

        const childBox = new Clutter.ActorBox();
        childBox.init_rect(0, 0, width, height);
        this._backgroundBin.allocate(childBox);
    }

    pushModal(timestamp) {
        if (this._hasModal)
            return true;

        let params = { actionMode: this._actionMode };
        if (timestamp)
            params['timestamp'] = timestamp;
        let grab = Main.pushModal(global.stage, params);
        if (!grab || (grab.get_seat_state && grab.get_seat_state() === Clutter.GrabState.NONE)) {
            if (grab)
                Main.popModal(grab);
            return false;
        }

        this._grab = grab;
        Main.layoutManager.emit('system-modal-opened');

        this._hasModal = true;
        if (this._savedKeyFocus) {
            this._savedKeyFocus.grab_key_focus();
            this._savedKeyFocus = null;
        } else {
            let focus = this._initialKeyFocus || this.dialogLayout.initialKeyFocus;
            if (focus)
                focus.grab_key_focus();
        }

        if (!this._shellReactive && this._eventBlocker)
            this.backgroundStack.set_child_below_sibling(this._eventBlocker, null);
        return true;
    }
});

export const CosmicAppDisplay = GObject.registerClass({
    Properties: {
        'folder': GObject.ParamSpec.object(
            'folder', 'folder', 'READABLE',
            GObject.ParamFlags.READWRITE,
            CosmicFolderButton.$gtype),
    },
}, class CosmicAppDisplay extends St.Widget {
    _init() {
        super._init({
            layout_manager: new Clutter.BoxLayout({
                orientation: Clutter.Orientation.VERTICAL,
                spacing: 6
            }),
        });
        this.add_style_class_name('cosmic-app-display');

        this._scrollView = new St.ScrollView({
            hscrollbar_policy: St.PolicyType.NEVER,
            x_expand: true,
            overlay_scrollbars: true
        });
        this._scrollView.add_style_class_name('cosmic-app-scroll-view');
        this.add_child(this._scrollView);

        this._parentalControlsManager = ParentalControlsManager.getDefault();
        this._parentalControlsManager.connect('app-filter-changed', () => {
            this._queueRedisplay();
        });

        this._box = new St.Viewport({
            layout_manager: new Clutter.FlowLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                homogeneous: true,
            }),
            x_expand: true,
            y_expand: true
        });
        this._scrollView.set_child(this._box);

        let appIcons = [];
        Shell.AppSystem.get_default().get_installed().forEach(appInfo => {
            const app = Shell.AppSystem.get_default().lookup_app(appInfo.get_id());
            if (app) {
                const app_icon = new CosmicAppIcon(app);
                app_icon.connect('key-focus-in', this._keyFocusIn.bind(this));
                appIcons.push(app_icon);
            }
        });
        appIcons.sort((a, b) => a.app.get_name().localeCompare(b.app.get_name()))
                .forEach(icon => this._box.add_child(icon));

        this.add_child(new St.Widget({ height: 1, style_class: 'cosmic-applications-separator' }));

        this._folderBox = new St.Viewport({
            layout_manager: new Clutter.FlowLayout({
                orientation: Clutter.Orientation.HORIZONTAL,
                homogeneous: true,
            }),
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        this.add_child(this._folderBox);

        this._redisplayIdleId = 0;

        this._folderSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.app-folders' });
        this._folderSettings.connect('changed::folder-children', () => {
            this._queueRedisplay();
        });

        this._installChangedId = Shell.AppSystem.get_default().connect('installed-changed', () => {
            this._queueRedisplay();
        });

        this._redisplay();

        this._updateHomeApps();
        this.setFolder(null);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _queueRedisplay() {
        if (this._redisplayIdleId)
            return;
        this._redisplayIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._redisplayIdleId = 0;
            this._redisplay();
            return GLib.SOURCE_REMOVE;
        });
    }

    _onDestroy() {
        if (this._redisplayIdleId) {
            GLib.source_remove(this._redisplayIdleId);
            this._redisplayIdleId = 0;
        }
        Shell.AppSystem.get_default().disconnect(this._installChangedId);
    }

    _keyFocusIn(app_icon) {
        Util.ensureActorVisibleInScrollView(this._scrollView, app_icon);
    }

    _updateHomeApps() {
        this._home_apps = this._box.get_children().map(x => x.getId()).filter(id => {
            for (const k in this._folders) {
                if (this._folders[k].apps && this._folders[k].apps.includes(id))
                    return false;
            }
            return true;
        });
    }

    get inFolder() {
        return !!this._folderId;
    }

    get folder() {
        if (this._folderId && this._folders[this._folderId])
            return this._folders[this._folderId];
        return this._home_button;
    }

    setFolder(folderId) {
        if (this.folder)
            this.folder.remove_style_pseudo_class('checked');

        this._folderId = folderId;
        this.notify('folder');

        const ids = folderId !== null ? this.folder.apps : this._home_apps;

        this.folder.add_style_pseudo_class('checked');

        this._box.get_children().forEach(app => {
            const appInfo = app.app.app_info;
            app.visible = this._parentalControlsManager.shouldShowApp(appInfo) &&
                          ids.includes(app.getId());
        });
    }

    _getAddedRemovedApps() {
        const installed = Shell.AppSystem.get_default().get_installed();
        const appIcons = this._box.get_children();

        const appIcons_ids = appIcons.map(x => x.getId());
        const added = installed.filter(x => !appIcons_ids.includes(x.get_id()));

        const installed_ids = installed.map(x => x.get_id());
        const removed = appIcons.filter(x => !installed_ids.includes(x.getId()));

        return [added, removed];
    }

    _redisplay() {
        const [added, removed] = this._getAddedRemovedApps();
        removed.forEach(icon => icon.destroy());
        added.forEach(appInfo => {
            const app = Shell.AppSystem.get_default().lookup_app(appInfo.get_id());
            if (app) {
                for (const icon of this._box.get_children()) {
                    if (icon.app.get_name().localeCompare(app.get_name()) > 0) {
                        const app_icon = new CosmicAppIcon(app);
                        app_icon.connect('key-focus-in', this._keyFocusIn.bind(this));
                        this._box.insert_child_above(app_icon, icon);
                        break;
                    }
                }
            }
        });
        if (added.length > 0)
            this._updateHomeApps();

        this._folders = {};

        this._folderBox.destroy_all_children();

        this._home_button = new CosmicFolderButton(this, null);
        this._folderBox.add_child(this._home_button);

        const folders = this._folderSettings.get_strv('folder-children');
        folders.forEach(id => {
            const folder_button = new CosmicFolderButton(this, id);
            folder_button.connect('notify::name', () => this._queueRedisplay());
            folder_button.connect('apps-changed', () => {
                this._updateHomeApps();
                this.setFolder(this.folder.id);
            });

            this._folders[id] = folder_button;
        });
        Object.values(this._folders).sort((a, b) => a.name.localeCompare(b.name)).forEach(folder_button => {
            this._folderBox.add_child(folder_button);
        });

        if (!this.get_stage()) {
            return;
        }

        const create_button = new CosmicBaseFolderButton('folder-new-symbolic');
        create_button.label.text = _("Create Folder");
        create_button.connect('clicked', () => this.open_create_folder_dialog());
        this._folderBox.add_child(create_button);

        this._folderBox.get_preferred_width(-1);

        this.folder.add_style_pseudo_class('checked');

        if (this._folderId !== undefined)
            this.setFolder(this.folder.id);
    }

    resize(height, width) {
        this._scrollView.set_style(`height: ${height}px;width: ${width}px;`);
    }

    reset() {
        this.setFolder(null);
    }

    create_folder(name) {
        const newFolderId = GLib.uuid_string_random();
        const newFolderPath = this._folderSettings.path.concat('folders/', newFolderId, '/');
        const newFolderSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.app-folders.folder',
            path: newFolderPath,
        });

        if (!newFolderSettings) {
            console.error('Error creating new folder');
            return;
        }

        newFolderSettings.set_string('name', name);

        let folders = this._folderSettings.get_strv('folder-children');
        folders.push(newFolderId);
        this._folderSettings.set_strv('folder-children', folders);
    }

    delete_folder(id) {
        const settings = this._folders[id]?.settings;

        if (settings) {
            let keys = settings.settings_schema.list_keys();
            for (const key of keys)
                settings.reset(key);
        }

        const folders = this._folderSettings.get_strv('folder-children');
        this._folderSettings.set_strv('folder-children', folders.filter(x => x !== id));
    }

    rename_folder(id, name) {
        const settings = this._folders[id]?.settings;

        if (settings)
            settings.set_string('name', name);
    }

    open_create_folder_dialog() {
        new CosmicFolderEditDialog(_("New Folder"), _("Folder Name"), _("Create"), true, (d) => {
            this.create_folder(d.entry.get_text());
        });
    }

    open_delete_folder_dialog() {
        const id = this.folder.id;
        const desc = _("Deleting this folder will move the application icons to Library Home.");
        new CosmicFolderEditDialog(_("Delete Folder?"), desc, _("Delete"), false, () => {
            this.delete_folder(id);
            this.setFolder(null);
        });
    }

    open_rename_folder_dialog() {
        const id = this.folder.id;
        if (id === null)
            return;

        const name = this._folders[id].name;
        const d = new CosmicFolderEditDialog(_("Rename Folder"), null, _("Rename"), true, (dialogRef) => {
            this.rename_folder(id, dialogRef.entry.get_text());
        });
        d.entry.set_text(name);
    }

    select_next_folder() {
        const next = this.folder.get_next_sibling();
        if (next instanceof CosmicFolderButton)
            this.setFolder(next.id);
    }

    select_previous_folder() {
        const prev = this.folder.get_previous_sibling();
        if (prev instanceof CosmicFolderButton)
            this.setFolder(prev.id);
    }
});

export const CosmicSearchResultsView = GObject.registerClass({
    Signals: { 'terms-changed': {} },
}, class CosmicSearchResultsView extends St.BoxLayout {
    _init(params) {
        super._init(params);

        this._content = new St.BoxLayout({
            name: 'searchResultsContent',
            vertical: true,
            x_expand: true,
            style_class: 'cosmic-applications-search-results',
        });
        this.add_child(this._content);

        this._cancellable = new Gio.Cancellable();
        this._searchTimeoutId = 0;

        this._terms = [];
        this._results = {};

        this._app_provider = new AppDisplay.AppSearchProvider();
        const providerDisplay = new Search.GridSearchResults(this._app_provider, this);
        this._content.add_child(providerDisplay);
        this._app_provider.display = providerDisplay;

        const appInfo = Gio.DesktopAppInfo.new("io.elementary.appcenter.desktop");
        const busName = "io.elementary.appcenter";
        const objectPath = "/io/elementary/appcenter/SearchProvider";
        if (appInfo) {
            const available_box = new St.BoxLayout({ style: 'spacing: 4px;' });
            const available_label = new St.Label({
                text: _("Available to Install"),
                style_class: "cosmic-applications-available"
            });
            this._available_spinner = new Animation.Spinner(16);

            available_box.add_child(available_label);
            available_box.add_child(this._available_spinner);
            this._content.add_child(available_box);

            const RemoteSearchProviderClass = RemoteSearch.RemoteSearchProvider2 || RemoteSearch.RemoteSearchProvider;
            this._shop_provider = new RemoteSearchProviderClass(appInfo, busName, objectPath, true);
            const shopDisplay = new Search.GridSearchResults(this._shop_provider, this);
            shopDisplay._resultDisplayBin.x_align = Clutter.ActorAlign.START;
            this._content.add_child(shopDisplay);
            this._shop_provider.display = shopDisplay;
        }
    }

    get terms() {
        return this._terms;
    }

    setTerms(terms) {
        const searchString = terms.join(' ');
        const previousSearchString = this._terms.join(' ');

        let isSubSearch = false;
        if (this._terms.length > 0)
            isSubSearch = searchString.indexOf(previousSearchString) === 0;

        this._terms = terms;
        this._isSubSearch = isSubSearch;

        this._cancellable.cancel();
        this._cancellable.reset();

        this._doSearch(this._app_provider);
        if (this._searchTimeoutId === 0)
            this._searchTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 150, this._onSearchTimeout.bind(this));

        this.emit('terms-changed');
    }

    async _doSearch(provider) {
        if (provider === this._shop_provider && this._available_spinner)
            this._available_spinner.play();

        provider.searchInProgress = true;

        const providerKey = provider.id || provider.appInfo?.get_id?.() || 'app_provider';
        const previousProviderResults = this._results[providerKey];

        try {
            if (this._isSubSearch && previousProviderResults) {
                let res = provider.getSubsearchResultSet(
                    previousProviderResults,
                    this._terms,
                    results => {
                        this._gotResults(results, provider);
                    },
                    this._cancellable
                );
                if (res instanceof Promise)
                    res = await res;
                if (Array.isArray(res))
                    this._gotResults(res, provider);
            } else {
                let res = provider.getInitialResultSet(
                    this._terms,
                    results => {
                        this._gotResults(results, provider);
                    },
                    this._cancellable
                );
                if (res instanceof Promise)
                    res = await res;
                if (Array.isArray(res))
                    this._gotResults(res, provider);
            }
        } catch (e) {
            console.error(`Search error in provider: ${e}`);
        }
    }

    _onSearchTimeout() {
        this._searchTimeoutId = 0;
        if (this._shop_provider)
            this._doSearch(this._shop_provider);
        return GLib.SOURCE_REMOVE;
    }

    _gotResults(results, provider) {
        if (!results)
            return;
        const display = provider.display;
        const terms = this._terms;

        const providerKey = provider.id || provider.appInfo?.get_id?.() || 'app_provider';
        this._results[providerKey] = results;

        if (display && typeof display.updateSearch === 'function') {
            display.updateSearch(results, terms, () => {
                provider.searchInProgress = false;

                if (provider === this._shop_provider && this._available_spinner)
                    this._available_spinner.stop();

                this._maybeSetInitialSelection();
            });
        }
    }

    highlightTerms(description) {
        return "";
    }

    _maybeSetInitialSelection() {
        const newDefaultResult = this._app_provider.display?.getFirstResult?.();
        if (newDefaultResult && newDefaultResult !== this._defaultResult) {
            this.highlightDefault(false);
            this._defaultResult = newDefaultResult;
            this.highlightDefault(true);
        }
    }

    highlightDefault(highlight) {
        if (!this._defaultResult)
            return;

        if (highlight)
            this._defaultResult.add_style_pseudo_class('selected');
        else
            this._defaultResult.remove_style_pseudo_class('selected');
    }

    activateDefault() {
        if (this._defaultResult)
            this._defaultResult.activate();
    }

    navigateFocus(direction) {
        let rtl = this.get_text_direction() === Clutter.TextDirection.RTL;
        if (direction === St.DirectionType.TAB_BACKWARD ||
            direction === (rtl ? St.DirectionType.RIGHT : St.DirectionType.LEFT) ||
            direction === St.DirectionType.UP) {
            this.navigate_focus(null, direction, false);
            return;
        }

        const from = this._defaultResult ?? null;
        this.navigate_focus(from, direction, false);
    }
});

export const CosmicAppsDialog = GObject.registerClass(
class CosmicAppsDialog extends CosmicModalDialog {
    _init() {
        super._init({
            destroyOnClose: false,
            shellReactive: true,
            actionMode: Shell.ActionMode.OVERVIEW,
        });
        this.connect('destroy', this._onDestroy.bind(this));

        this.inSearch = false;

        this.appDisplay = new CosmicAppDisplay();

        this.resultsView = new CosmicSearchResultsView({ opacity: 0, visible: false });

        this._header = new CosmicAppsHeader();
        this._header.connect('rename-clicked', () => this.appDisplay.open_rename_folder_dialog());
        this._header.connect('delete-clicked', () => this.appDisplay.open_delete_folder_dialog());
        this._header.connect('search-text-changed', () => {
            const terms = getTermsForSearchString(this._header.searchText);
            this.resultsView.setTerms(terms);
            this.fadeSearch(this._header.searchText !== '');
        });
        this._text = this._header._searchEntry.clutter_text;
        this._text.connect('key-press-event', this._onSearchKeyPress.bind(this));
        this._text.connect('key-focus-in', () => {
            this.resultsView.highlightDefault(true);
        });
        this._text.connect('key-focus-out', () => {
            this.resultsView.highlightDefault(false);
        });

        this.appDisplay.bind_property(
            'folder',
            this._header,
            'folder',
            GObject.BindingFlags.SYNC_CREATE
        );

        const stack = new Shell.Stack();
        stack.add_child(this.resultsView);
        stack.add_child(this.appDisplay);

        const box = new St.BoxLayout({ vertical: true, style_class: 'cosmic-applications-box' });
        box.add_child(this._header);
        box.add_child(stack);

        this.contentLayout.add_child(box);
        this.dialogLayout._dialog.add_style_class_name('cosmic-applications-dialog');
        this.connect("key-press-event", (_, event) => {
            if (event.get_key_symbol() === Clutter.KEY_Escape)
                this.hideDialog();
            else if (!this.inSearch && event.get_key_symbol() === Clutter.KEY_Page_Down)
                this.appDisplay.select_next_folder();
            else if (!this.inSearch && event.get_key_symbol() === Clutter.KEY_Page_Up)
                this.appDisplay.select_previous_folder();
        });

        this.button_press_id = global.stage.connect('button-press-event', () => {
            function has_excluded_ancestor(actor) {
                if (actor === null)
                    return false;
                else if (actor === this.dialogLayout._dialog ||
                         actor._delegate instanceof PopupMenu ||
                         (actor instanceof AppDisplay.AppIcon &&
                          actor.app?.id === "pop-cosmic-applications.desktop") ||
                         actor === Main.panel.statusArea['cosmic_applications'] ||
                         actor === Main.overview.dash?.showAppsButton ||
                         actor.has_style_class_name?.('show-apps') ||
                         actor._delegate?.has_style_class_name?.('show-apps'))
                    return true;
                else
                    return has_excluded_ancestor.call(this, actor.get_parent());
            }

            const [ x, y ] = global.get_pointer();
            const focused_actor = global.stage.get_actor_at_pos(Clutter.PickMode.ALL, x, y);

            if (this.visible && !has_excluded_ancestor.call(this, focused_actor))
                this.hideDialog();
        });

        this._interfaceSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        this._interfaceSettings.connect('changed::gtk-theme', this.reload_theme.bind(this));
        try {
            this._interfaceSettings.connect('changed::color-scheme', this.reload_theme.bind(this));
        } catch {}
        try {
            this._userThemeSettings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.user-theme' });
            this._userThemeSettings.connect('changed::name', this.reload_theme.bind(this));
        } catch {}
        this.reload_theme();
    }

    _onSearchKeyPress(entry, event) {
        if (!this.inSearch)
            return Clutter.EVENT_PROPAGATE;

        let symbol = event.get_key_symbol();
        let arrowNext, nextDirection;
        if (entry.get_text_direction() === Clutter.TextDirection.RTL) {
            arrowNext = Clutter.KEY_Left;
            nextDirection = St.DirectionType.LEFT;
        } else {
            arrowNext = Clutter.KEY_Right;
            nextDirection = St.DirectionType.RIGHT;
        }

        if (symbol === Clutter.KEY_Tab) {
            this.resultsView.navigateFocus(St.DirectionType.TAB_FORWARD);
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Down) {
            this.resultsView.navigateFocus(St.DirectionType.DOWN);
            return Clutter.EVENT_STOP;
        } else if (symbol === arrowNext && this._text.position === -1) {
            this.resultsView.navigateFocus(nextDirection);
            return Clutter.EVENT_STOP;
        } else if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            this.resultsView.activateDefault();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    reload_theme() {
        const theme_context = St.ThemeContext.get_for_stage(global.stage);
        const theme = theme_context.get_theme();
        if (!theme || !extensionInstance)
            return;

        let darkStylesheet = extensionInstance.dir.get_child("dark.css");
        let lightStylesheet = extensionInstance.dir.get_child("light.css");

        theme.unload_stylesheet(darkStylesheet);
        theme.unload_stylesheet(lightStylesheet);

        if (this.is_dark()) {
            if (this.resultsView._available_spinner) {
                this.resultsView._available_spinner.clear_effects();
            }
            theme.load_stylesheet(darkStylesheet);
        } else {
            if (this.resultsView._available_spinner) {
                this.resultsView._available_spinner.add_effect(new Shell.InvertLightnessEffect());
            }
            theme.load_stylesheet(lightStylesheet);
        }

        theme_context.set_theme(theme);
    }

    is_dark() {
        try {
            const colorScheme = this._interfaceSettings.get_string("color-scheme");
            if (colorScheme === "prefer-dark")
                return true;
            if (colorScheme === "prefer-light")
                return false;
        } catch {}
        const DARK = ["dark", "adapta", "plata", "dracula", "pop", "yaru", "adwaita-dark"];
        const theme = this.theme().toLowerCase();
        return DARK.some(dark => theme.includes(dark));
    }

    theme() {
        if (this._userThemeSettings) {
            try {
                const name = this._userThemeSettings.get_string("name");
                if (name) return name;
            } catch {}
        }
        try {
            return this._interfaceSettings.get_string("gtk-theme");
        } catch {
            return "Pop";
        }
    }

    _onDestroy() {
        global.stage.disconnect(this.button_press_id);

        if (extensionInstance) {
            let darkStylesheet = extensionInstance.dir.get_child("dark.css");
            let lightStylesheet = extensionInstance.dir.get_child("light.css");

            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            if (theme) {
                theme.unload_stylesheet(darkStylesheet);
                theme.unload_stylesheet(lightStylesheet);
            }
        }
    }

    fadeSearch(newInSearch) {
        if (newInSearch === this.inSearch)
            return;

        this.inSearch = newInSearch;

        let oldPage, newPage;
        if (this.inSearch)
            [oldPage, newPage] = [this.appDisplay, this.resultsView];
        else
            [oldPage, newPage] = [this.resultsView, this.appDisplay];

        oldPage.ease({
            opacity: 0,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => { oldPage.visible = false; },
        });

        newPage.visible = true;
        newPage.ease({
            opacity: 255,
            duration: OverviewControls.SIDE_CONTROLS_ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
        });
    }

    showDialog() {
        this.open();
        this._header.reset();

        const monitor = this.monitor();
        const monitorScale = 1 / St.ThemeContext.get_for_stage(global.stage).scale_factor;

        const height = Math.min(
            168 * 3,
            Math.floor(monitorScale * monitor.height * 0.65 / 168) * 168
        );
        const width = Math.min(
            168 * 7,
            Math.floor(monitorScale * monitor.width * 0.90 / 168) * 168
        );

        this.appDisplay.resize(height, width);
        this.appDisplay.reset();

        Main.panel.statusArea['cosmic_applications']?.update();
    }

    hideDialog() {
        this.close();

        resetDockShowAppsButton();
        Main.panel.statusArea['cosmic_applications']?.update();
    }
});

function resetDockShowAppsButton() {
    if (Main.overview.dash?.showAppsButton && Main.overview.dash.showAppsButton.checked) {
        Main.overview.dash.showAppsButton.checked = false;
    }

    const dockUuids = [
        "dash-to-dock@micxgx.gmail.com",
        "cosmic-dock@system76.com",
        "ubuntu-dock@ubuntu.com",
    ];

    for (const uuid of dockUuids) {
        const ext = Main.extensionManager.lookup(uuid);
        if (ext && ext.state === 1 && ext.stateObj) {
            const dockManager = ext.stateObj.dockManager || ext.stateObj._dockManager;
            const allDocks = dockManager?.allDocks || dockManager?._allDocks;
            if (allDocks) {
                allDocks.forEach((dock) => {
                    if (dock.dash?.showAppsButton && dock.dash.showAppsButton.checked) {
                        dock.dash.showAppsButton.checked = false;
                    }
                    dock._onOverviewHiding?.();
                });
            }
        }
    }
}

export function enable(ext = null) {
    extensionInstance = ext;
    dialog = new CosmicAppsDialog();
}

export function disable() {
    if (dialog) {
        dialog.destroy();
        dialog = null;
    }
    extensionInstance = null;
}

export function visible() {
    return dialog && (dialog.state === ModalDialog.State?.OPENED || dialog.state === ModalDialog.State?.OPENING || dialog.visible);
}

export function show() {
    if (dialog)
        dialog.showDialog();
}

export function hide() {
    if (dialog)
        dialog.hideDialog();
}
