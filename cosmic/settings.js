import Gio from 'gi://Gio';

export function settings_new_schema(schema, ext = null) {
    const GioSSS = Gio.SettingsSchemaSource;
    let schemaDir = null;
    if (ext && ext.dir) {
        schemaDir = ext.dir.get_child('schemas');
    }

    let schemaSource = (schemaDir && schemaDir.query_exists(null))
        ? GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false)
        : GioSSS.get_default();

    const schemaObj = schemaSource.lookup(schema, true);

    if (!schemaObj) {
        try {
            return new Gio.Settings({ schema_id: schema });
        } catch {
            throw new Error(`Schema ${schema} could not be found. Please check your installation.`);
        }
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}
