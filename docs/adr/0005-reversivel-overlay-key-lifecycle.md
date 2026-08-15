# 0005 - Reversible Overlay Key and Shortcut Lifecycle Management

The `pop-cosmic` extension overrides the default Super key behavior by updating `org.gnome.mutter.overlay-key` and related keybinding schemas during its `enable()` lifecycle. To avoid permanent side effects on the user's desktop environment when the extension is disabled or GNOME Shell is updated, previous configuration states are preserved in memory and strictly restored during `disable()`.
