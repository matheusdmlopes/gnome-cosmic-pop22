from pathlib import Path
from typing import Optional
from gi.repository import Gio, GLib

def get_settings(schema_id: str) -> Optional[Gio.Settings]:
    """Returns a Gio.Settings instance for the schema_id, looking up default or local schema directories."""
    schema_source = Gio.SettingsSchemaSource.get_default()
    
    # Additional local search directories
    search_paths = [
        Path.home() / ".local/share/glib-2.0/schemas",
        Path.home() / ".local/share/gnome-shell/extensions/pop-cosmic@system76.com/schemas",
        Path.home() / ".local/share/gnome-shell/extensions/cosmic-workspaces@system76.com/schemas",
        Path.home() / ".local/share/gnome-shell/extensions/pop-shell@system76.com/schemas",
    ]
    
    # 1. Try default schema source
    if schema_source is not None:
        schema = schema_source.lookup(schema_id, True)
        if schema is not None:
            try:
                return Gio.Settings.new(schema_id)
            except Exception:
                pass
                
    # 2. Try schemas in additional local directories
    for path in search_paths:
        if path.exists() and (path / "gschemas.compiled").exists():
            try:
                custom_source = Gio.SettingsSchemaSource.new_from_directory(
                    str(path),
                    schema_source,
                    False
                )
                if custom_source is not None:
                    schema = custom_source.lookup(schema_id, True)
                    if schema is not None:
                        return Gio.Settings.new_full(schema, None, None)
            except Exception:
                continue

    return None
