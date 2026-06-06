# Confirm Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)
[![GitHub release](https://img.shields.io/github/release/bo-2221/confirm-card.svg)](https://github.com/bo-2221/confirm-card/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A custom card for [Home Assistant](https://www.home-assistant.io/) that wraps any card and shows a **confirmation popup** before executing an action — preventing accidental triggers.

---

## Preview

### Popup – Dark & Light Theme

<p align="center">
  <img src="https://raw.githubusercontent.com/bo-2221/confirm-card/main/assets/popup-dark.png" alt="Dark Theme" width="320"/>
  &nbsp;&nbsp;&nbsp;
  <img src="https://raw.githubusercontent.com/bo-2221/confirm-card/main/assets/popup-light.png" alt="Light Theme" width="320"/>
</p>

### Visual Editor

<p align="center">
  <img src="https://raw.githubusercontent.com/bo-2221/confirm-card/main/assets/editor.png" alt="Visual Editor" width="700"/>
</p>

### Card on Dashboard (Pill Style)

<p align="center">
  <img src="https://raw.githubusercontent.com/bo-2221/confirm-card/main/assets/card-pill.png" alt="Pill Style Card" width="400"/>
</p>

---

## Features

- 🎨 **Visual editor** – configure everything without writing YAML
- 🔘 **Card presets** – Button, Light, Tile and custom Pill Style
- 🌙 **Dark & light themes** with 7 individual color pickers
- ⚙️ **Auto-detection** of entity, service and disabled states
- 📝 **Custom YAML support** for advanced card styling
- 🔄 **Bidirectional sync** between UI fields and YAML editor
- 📱 **iOS compatible** – works with touch events
- ✅ **Works with any HA card type**

---

## Installation

### HACS (recommended)

1. Open HACS in Home Assistant
2. Go to **Frontend** → three dots → **Custom repositories**
3. Add `https://github.com/bo-2221/confirm-card` as category **Lovelace**
4. Click **Install**
5. Reload your browser

### Manual

1. Download `confirm-card.js` from the [latest release](https://github.com/bo-2221/confirm-card/releases)
2. Copy it to `/config/www/confirm-card/confirm-card.js`
3. Add as resource in Home Assistant:
   - **Settings** → **Dashboards** → **Resources** → **Add Resource**
   - URL: `/local/confirm-card/confirm-card.js`
   - Type: **JavaScript module**

---

## Usage

### Simple button

```yaml
type: custom:confirm-card
card:
  type: button
  entity: switch.my_device
popup:
  message: Are you sure?
  confirm_text: Yes
  cancel_text: Cancel
```

### With title and custom colors

```yaml
type: custom:confirm-card
card:
  type: button
  entity: switch.my_device
  name: Dyson
  icon: mdi:power-plug
popup:
  title: Confirm
  message: Do you really want to toggle the Dyson?
  confirm_text: Toggle
  cancel_text: Cancel
  colors:
    dialog_bg: "#363638"
    title_color: "#ECDFCC"
    message_color: "#aaaaaa"
    cancel_bg: "#28282A"
    cancel_color: "#ECDFCC"
    confirm_bg: "#ECDFCC"
    confirm_color: "#28282A"
```

### Light card

```yaml
type: custom:confirm-card
card:
  type: light
  entity: light.living_room
popup:
  message: Toggle the living room light?
  confirm_text: Toggle
  cancel_text: Cancel
```

### Custom card (advanced)

```yaml
type: custom:confirm-card
card:
  type: custom:button-card
  entity: switch.my_device
  name: My Device
  styles:
    card:
      - height: 56px
      - border-radius: 75px
      - background: "#28282A"
popup:
  message: Are you sure?
  confirm_text: Yes
  cancel_text: No
```

---

## Configuration

### Card options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `card` | object | ✅ | Any HA card configuration |
| `popup` | object | ✅ | Popup configuration |

### Popup options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `message` | string | `Bist du sicher?` | Popup message text |
| `title` | string | — | Optional title |
| `confirm_text` | string | `Bestätigen` | Confirm button text |
| `cancel_text` | string | `Abbrechen` | Cancel button text |
| `colors` | object | Dark theme | Custom colors |
| `disabled_states` | list | `[unavailable, unknown]` | States that disable the popup |

### Color options

| Option | Default | Description |
|--------|---------|-------------|
| `dialog_bg` | `#363638` | Dialog background |
| `title_color` | `#ECDFCC` | Title text color |
| `message_color` | `#aaaaaa` | Message text color |
| `cancel_bg` | `#28282A` | Cancel button background |
| `cancel_color` | `#ECDFCC` | Cancel button text color |
| `confirm_bg` | `#ECDFCC` | Confirm button background |
| `confirm_color` | `#28282A` | Confirm button text color |

---

## License

MIT © [bo-2221](https://github.com/bo-2221)
