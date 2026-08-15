# 0004 - GSettings Schema Resolution with Local Directory Fallback

To eliminate the need for root privileges (`sudo`) during development and allow the suite to run in user space, `pop-settings` implements a resilient GSettings schema loading pattern. If a schema is not installed in global system paths (`/usr/share/glib-2.0/schemas`), the application falls back to local directories (`~/.local/share/glib-2.0/schemas` or internal compiled schemas), preventing PyGObject runtime crashes.
