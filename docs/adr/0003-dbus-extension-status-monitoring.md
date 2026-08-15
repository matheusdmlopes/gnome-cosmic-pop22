# 0003 - Extension Status Monitoring via D-Bus org.gnome.Shell.Extensions

To determine whether the Pop COSMIC suite extensions are installed, active, or in an error state, `pop-settings` connects to the `org.gnome.Shell.Extensions` D-Bus interface. Querying real-time status through asynchronous calls and listening to the `ExtensionStatusChanged` signal ensures that the user interface displays informative banners (`Adw.Banner`) and reacts immediately when the user enables or disables extensions via external tools such as Extension Manager.
