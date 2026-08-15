import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const Gi = imports._gi;
const SETTINGS_SCHEMA = 'org.gnome.shell.extensions.cosmic-workspaces';

export function hookVfunc(proto, symbol, func) {
    proto[Gi.hook_up_vfunc_symbol](symbol, func);
}

export function overrideProto(proto, overrides) {
    const backup = {};

    for (const symbol in overrides) {
        if (symbol.startsWith('after_')) {
            const actualSymbol = symbol.slice('after_'.length);
            const fn = proto[actualSymbol];
            const afterFn = overrides[symbol];
            proto[actualSymbol] = function (...args) {
                const res = fn ? fn.apply(this, args) : undefined;
                afterFn.apply(this, args);
                return res;
            };
            backup[actualSymbol] = fn;
        } else {
            backup[symbol] = proto[symbol];
            if (symbol.startsWith('vfunc_')) {
                hookVfunc(proto[Gi.gobject_prototype_symbol], symbol.slice(6), overrides[symbol]);
            } else {
                proto[symbol] = overrides[symbol];
            }
        }
    }
    return backup;
}

export function bindSetting(label, callback, executeOnBind = true) {
    let settings = global.vertical_overview?.settings;
    if (!settings) {
        const ext = global.vertical_overview?.extension;
        settings = global.vertical_overview.settings = {
            object: ext ? ext.getSettings(SETTINGS_SCHEMA) : null,
            signals: {},
            callbacks: {},
        };
    }

    if (!settings.object)
        return null;

    if (settings.signals[label])
        settings.object.disconnect(settings.signals[label]);

    const signal = settings.object.connect('changed::' + label, callback);
    settings.signals[label] = signal;
    settings.callbacks[label] = callback;

    if (executeOnBind)
        callback(settings.object, label);
    return signal;
}

export function unbindSetting(label, callback) {
    const settings = global.vertical_overview?.settings;
    if (!settings || !settings.signals[label] || !settings.object)
        return;

    if (callback)
        callback(settings.object, label);

    settings.object.disconnect(settings.signals[label]);
    delete settings.signals[label];

    if (settings.callbacks[label])
        delete settings.callbacks[label];
}

// Retorna o objeto cosmic-dock ou dash-to-dock se estiver ativo
export function getDock() {
    const cosmicDock = Main.extensionManager.lookup('cosmic-dock@system76.com') ||
                       Main.extensionManager.lookup('dash-to-dock@micxgx.gmail.com');
    if (cosmicDock?.stateObj?.dockManager?.mainDock &&
        cosmicDock.state === 1 /* ExtensionState.ENABLED */) {
        return cosmicDock;
    }
    return undefined;
}
