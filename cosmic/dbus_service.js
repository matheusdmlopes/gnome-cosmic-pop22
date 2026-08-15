import Gio from 'gi://Gio';

const IFACE = `<node>
  <interface name="com.System76.Cosmic">
    <method name="GestureLeft"/>
    <method name="GestureRight"/>
    <method name="GestureUp"/>
    <method name="GestureDown"/>
    <method name="ToggleApplications"/>
    <method name="ToggleLauncher"/>
    <method name="ToggleWorkspaces"/>
  </interface>
</node>`;

export class Service {
    constructor() {
        this.GestureLeft = () => {};
        this.GestureRight = () => {};
        this.GestureUp = () => {};
        this.GestureDown = () => {};
        this.ToggleApplications = () => {};
        this.ToggleLauncher = () => {};
        this.ToggleWorkspaces = () => {};

        this.dbus = Gio.DBusExportedObject.wrapJSObject(IFACE, this);

        const onBusAcquired = (conn) => {
            try {
                this.dbus.export(conn, '/com/System76/Cosmic');
            } catch (why) {
                console.warn(`onBusAcquired export failed: ${why}`);
            }
        };

        function onNameAcquired() { }

        function onNameLost() { }

        this.id = Gio.bus_own_name(
            Gio.BusType.SESSION,
            'com.System76.Cosmic',
            Gio.BusNameOwnerFlags.NONE,
            onBusAcquired,
            onNameAcquired,
            onNameLost
        );
    }

    destroy() {
        if (this.dbus) {
            this.dbus.unexport();
        }
        if (this.id) {
            Gio.bus_unown_name(this.id);
            this.id = null;
        }
    }
}
