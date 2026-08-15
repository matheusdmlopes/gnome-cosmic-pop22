## Agent skills

### Issue tracker

Issues and specs live as local markdown files under `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical roles, each label string equal to its name, recorded as the `Status:` line in the issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.

---

## Diretrizes técnicas: GNOME Shell 48 e ecossistema Pop COSMIC

**Ambiente de desenvolvimento:** Debian 13 (trixie) com GNOME Shell 48.7,
que é a versão real na máquina do Matheus. Não presuma Pop!_OS nem GNOME 42.

### 1. Padrões de migração para ESM (GNOME 45+)

- **Imports:** exclusivamente sintaxe ESM (`import * as Main from 'resource:///org/gnome/shell/ui/main.js';`, `import Gio from 'gi://Gio';`).
- **Ciclo de vida da extensão:**
  - `extension.js`: estender a classe `Extension` de `resource:///org/gnome/shell/extensions/extension.js` com métodos `enable()` e `disable()`.
  - `prefs.js`: estender `ExtensionPreferences` de `resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js` usando `fillPreferencesWindow(window)` com widgets nativos GTK4 e Libadwaita (`Adw.PreferencesPage`, `Adw.PreferencesGroup`, `Adw.SwitchRow`, `Adw.SpinRow`, `Adw.ComboRow`).
- **GSettings em `metadata.json`:** sempre declarar `"settings-schema": "<schema-id>"` para evitar erro de `schema_id: undefined` em `this.getSettings()`.
- **Laters do compositor:** substituir `Meta.later_add(...)` por `global.compositor.get_laters().add(Meta.LaterType.BEFORE_REDRAW, () => { ... return GLib.SOURCE_REMOVE; })`.

### 2. Injeção dinâmica em classes não exportadas

No GNOME 48, classes internas de layout (como `ControlsManagerLayout`) não são exportadas no escopo do módulo. Para aplicar override em protótipo de classe não exportada, capture o protótipo dinamicamente a partir da instância ativa no Shell:

```js
const proto = Object.getPrototypeOf(Main.overview._overview._controls.layout_manager);
```

### 3. Gerenciamento automático de atalhos de teclado

Ao alterar o layout de workspaces para vertical, registrar temporariamente os atalhos em `org.gnome.desktop.wm.keybindings` (`<Super>Page_Up`, `<Super>Page_Down`) durante o `enable()`. Salvar os arrays originais do usuário em memória e restaurá-los integralmente no `disable()`.

### 4. Mapa do ecossistema Pop COSMIC

| Componente | Responsabilidade |
|:--|:--|
| `cosmic-workspaces` | visão geral vertical, miniaturas laterais, atalhos verticais |
| `pop-cosmic` | barra superior (botões Workspaces e Applications), interceptador da tecla Super |
| `pop-shell` | tiling window manager em mosaico |
| `dash-to-dock` | substitui o `cosmic-dock` legado |
| `ding` | ícones de desktop |
| `cosmic-settings` | app independente em Libadwaita para centralizar as preferências, sem forkar o `gnome-control-center` |

---

## Nota sobre carregamento

No `agy` CLI em modo `-p`, este arquivo **não** entra automaticamente como rule de
sistema: o agente o lê quando trabalha nos arquivos do repositório. As regras que
precisam valer sempre, em qualquer projeto, estão em `~/.gemini/GEMINI.md`.
