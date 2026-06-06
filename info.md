# Confirm Card

Wraps any Home Assistant card and shows a **confirmation popup** before executing an action.

## Features

- 🎨 Visual editor with presets (Button, Light, Tile, Pill Style)
- 🌙 Dark & light theme with 7 individual color pickers
- ⚙️ Auto-detects entity and service
- 📝 Custom YAML support for advanced card styling
- 📱 iOS compatible
- ✅ Works with any HA card type

## Installation via HACS

1. Add this repository as a custom repository in HACS
2. Install „Confirm Card"
3. Add as resource in Home Assistant

## Usage

```yaml
type: custom:confirm-card
card:
  type: button
  entity: switch.my_device
popup:
  title: Confirm
  message: Are you sure?
  confirm_text: Yes
  cancel_text: Cancel
```
