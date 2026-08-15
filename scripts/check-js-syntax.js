// Static ESM syntax check for GNOME Shell extension sources.
//
// Run through gjs so the files are parsed by the exact SpiderMonkey build
// that GNOME Shell will run them on:
//
//     gjs -c "$(cat scripts/check-js-syntax.js)" -- FILE...
//
// Reflect.parse only parses: nothing is evaluated, so modules importing
// resource:///org/gnome/shell/... are checked without a live Shell session.
// Exits non-zero and prints every offending file on the first syntax error.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

const decoder = new TextDecoder();
let failures = 0;
let checked = 0;

// gjs forwards a literal "--" separator into ARGV; it is not a file.
for (const path of ARGV.filter(arg => arg !== '--')) {
    let source;
    try {
        const [, bytes] = Gio.File.new_for_path(path).load_contents(null);
        source = decoder.decode(bytes);
    } catch (e) {
        printerr(`unreadable: ${path}: ${e.message}`);
        failures += 1;
        continue;
    }

    try {
        Reflect.parse(source, { target: 'module', source: path });
        checked += 1;
    } catch (e) {
        printerr(`syntax error: ${path}: ${e.message}`);
        failures += 1;
    }
}

if (failures > 0) {
    printerr(`${failures} file(s) failed ESM syntax validation`);
    imports.system.exit(1);
}

print(`ESM syntax OK: ${checked} file(s)`);
