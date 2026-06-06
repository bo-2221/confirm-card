/**
 * confirm-card - Confirmation popup wrapper for Home Assistant
 *
 * Wraps any HA card and shows a confirmation dialog before executing an action.
 * Entity and service are auto-detected from the inner card config.
 *
 * Usage:
 *   type: custom:confirm-card
 *   card:
 *     type: custom:button-card
 *     entity: switch.dyson
 *     tap_action:
 *       action: none
 *     ...
 *   popup:
 *     message: Wirklich schalten?
 *     confirm_text: Ja
 *     cancel_text: Abbrechen
 *     # on_confirm and disabled_states are auto-detected from card.entity
 */

// ── Styles (einmalig) ──────────────────────────────────────────────────────

let _stylesInjected = false;

function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.id = '__confirm_card_style__';
  style.textContent = `
    #__confirm_card_modal__::backdrop {
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
    #__confirm_card_modal__ {
      border: none !important;
      outline: none !important;
    }
    #__confirm_card_modal__ button:focus,
    #__confirm_card_modal__ button:focus-visible {
      outline: none !important;
      box-shadow: none !important;
    }
    @keyframes confirmSlideUp {
      from { opacity:0; transform:translateY(30px) scale(0.96); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    #__confirm_card_modal__ button:active {
      opacity: 0.7;
      transform: scale(0.96);
    }
  `;
  document.head.appendChild(style);
}

// ── Modal ──────────────────────────────────────────────────────────────────

function createModal() {
  injectStyles();
  removeModal();
  const modal = document.createElement('dialog');
  modal.id = '__confirm_card_modal__';
  modal.style.cssText = `
    background:transparent;border:none;outline:none;padding:0;
    max-width:100vw;max-height:100vh;width:100%;height:100%;
    display:flex;align-items:center;justify-content:center;overflow:visible;
  `;
  return modal;
}

function removeModal() {
  const el = document.getElementById('__confirm_card_modal__');
  if (el) { try { el.close(); } catch(e) {} el.remove(); }
}

// ── Confirm Dialog ─────────────────────────────────────────────────────────

function showConfirm(popup, onConfirm) {
  const message     = popup.message      || 'Bist du sicher?';
  const confirmText = popup.confirm_text || 'Bestätigen';
  const cancelText  = popup.cancel_text  || 'Abbrechen';

  // Farben aus Config oder Dark-Default
  const c = popup.colors || {};
  const dialogBg     = c.dialog_bg     || '#363638';
  const msgColor     = c.message_color || '#aaaaaa';
  const cancelBg     = c.cancel_bg     || '#28282A';
  const cancelColor  = c.cancel_color  || '#ECDFCC';
  const confirmBg    = c.confirm_bg    || '#ECDFCC';
  const confirmColor = c.confirm_color || '#28282A';
  const titleColor = c.title_color || (dialogBg === '#ECDFCC' ? '#28282A' : '#ffffff');

  const modal = createModal();
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    background:${dialogBg};border-radius:24px;
    width:calc(100% - 48px);max-width:320px;
    padding:24px 24px 24px;
    display:flex;flex-direction:column;align-items:center;gap:16px;
    box-shadow:0 24px 80px rgba(0,0,0,0.6);
    box-sizing:border-box;text-align:center;
    animation:confirmSlideUp 0.25s cubic-bezier(0.34,1.56,0.64,1);
  `;

  dialog.innerHTML = `
    ${popup.title
      ? `<div style="font-size:22px;font-weight:700;color:${titleColor};letter-spacing:0.3px;">${popup.title}</div>`
      : ''}
    <div style="font-size:14px;color:${msgColor};line-height:1.6;">${message}</div>
    <div style="display:flex;gap:10px;width:100%;margin-top:4px;">
      <button id="__confirm_cancel__" style="
        flex:1;padding:14px;background:${cancelBg};color:${cancelColor};
        border:none;border-radius:14px;font-size:14px;font-weight:500;
        cursor:pointer;-webkit-tap-highlight-color:transparent;
      ">${cancelText}</button>
      <button id="__confirm_ok__" style="
        flex:1;padding:14px;background:${confirmBg};color:${confirmColor};
        border:none;border-radius:14px;font-size:14px;font-weight:600;
        cursor:pointer;-webkit-tap-highlight-color:transparent;
      ">${confirmText}</button>
    </div>
  `;

  modal.appendChild(dialog);
  document.body.appendChild(modal);
  modal.showModal();
  modal.focus();

  const close = () => removeModal();
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  dialog.querySelector('#__confirm_cancel__').addEventListener('click', () => {
    dispatchHaptic('selection'); close();
  });
  dialog.querySelector('#__confirm_ok__').addEventListener('click', () => {
    dispatchHaptic('success'); close(); onConfirm();
  });

  dispatchHaptic('selection');
}

// ── Action & Haptic ────────────────────────────────────────────────────────

function dispatchHaptic(type) {
  window.dispatchEvent(new CustomEvent('haptic', { detail: type }));
}

function executeAction(action, hass) {
  if (!action || !hass) return;
  if (action.action === 'call-service' || action.action === 'perform-action') {
    const [domain, svc] = (action.service || action.perform_action).split('.');
    hass.callService(domain, svc, action.service_data || action.data || {}, action.target || {});
  } else if (action.action === 'navigate') {
    window.history.pushState(null, '', action.navigation_path);
    window.dispatchEvent(new Event('location-changed', { bubbles: true, composed: true }));
  } else if (action.action === 'toggle') {
    const entityId = action.entity_id || action.target?.entity_id;
    if (entityId) hass.callService(entityId.split('.')[0], 'toggle', {}, { entity_id: entityId });
  } else if (action.action === 'url') {
    window.open(action.url_path);
  }
}

function autoAction(entityId) {
  if (!entityId) return null;
  const domain = entityId.split('.')[0];
  const serviceMap = {
    switch:        'switch.toggle',
    light:         'light.toggle',
    input_boolean: 'input_boolean.toggle',
    cover:         'cover.toggle',
    fan:           'fan.toggle',
    lock:          'lock.toggle',
    button:        'button.press',
    scene:         'scene.turn_on',
    script:        'script.turn_on',
  };
  const service = serviceMap[domain] || `${domain}.toggle`;
  const [d, s] = service.split('.');
  return { action: 'call-service', service: `${d}.${s}`, target: { entity_id: entityId } };
}

// ── ConfirmCard Element ────────────────────────────────────────────────────

class ConfirmCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config  = null;
    this._hass    = null;
    this._innerCard = null;
    this._hassQueue = null;
  }

  set hass(hass) {
    this._hass = hass;
    if (this._innerCard) {
      this._innerCard.hass = hass;
    } else {
      this._hassQueue = hass;
    }
    this._updateCursor();
  }

  get hass() { return this._hass; }

  static getConfigElement() { return document.createElement('confirm-card-editor'); }
  static getStubConfig() {
    return {
      card: { type: 'button', name: 'Gerät', icon: 'mdi:power' },
      popup: {
        title: 'Bestätigung',
        message: 'Soll das Gerät wirklich geschaltet werden?',
        confirm_text: 'Schalten',
        cancel_text: 'Abbrechen',
        colors: {
          dialog_bg: '#363638', title_color: '#ECDFCC', message_color: '#aaaaaa',
          cancel_bg: '#28282A', cancel_color: '#ECDFCC',
          confirm_bg: '#ECDFCC', confirm_color: '#28282A',
        },
      },
    };
  }

  set config(c) { this.setConfig(c); }

  static getConfigElement() { return document.createElement('confirm-card-editor'); }
  static getStubConfig() { return { card: { type: 'button', entity: '', tap_action: { action: 'none' } }, popup: { message: 'Bist du sicher?', confirm_text: 'Bestätigen', cancel_text: 'Abbrechen' } }; }


  static getConfigElement() {
    return document.createElement('confirm-card-editor');
  }

  static getStubConfig() {
    return {
      card: { type: 'button', entity: '', tap_action: { action: 'none' } },
      popup: { message: 'Bist du sicher?', confirm_text: 'Bestätigen', cancel_text: 'Abbrechen' },
    };
  }


  setConfig(config) {
    if (!config.card)  throw new Error('[confirm-card] "card" is required.');
    if (!config.popup) throw new Error('[confirm-card] "popup" is required.');

    const entityId = config.entity || config.card?.entity || null;
    const popup = { ...config.popup };

    if (!popup.on_confirm && entityId) {
      popup.on_confirm = autoAction(entityId);
    }
    if (!popup.disabled_states) {
      popup.disabled_states = ['unavailable', 'unknown'];
    }

    // tap_action:none immer intern setzen – Nutzer muss es nicht angeben
    const card = { ...config.card, tap_action: { action: 'none' } };
    this._config = { ...config, popup, card };

    if (!this.shadowRoot.querySelector('style')) {
      this.shadowRoot.innerHTML = `<style>:host{display:block;position:relative;min-height:56px;}</style>`;
    }
    this._buildInnerCard();
  }

  getCardSize() {
    return this._innerCard?.getCardSize ? this._innerCard.getCardSize() : 1;
  }

  _isPreviewMode() {
    if (!this._hass) return true;
    if (this.closest('hui-card-preview, hui-dialog-edit-card')) return true;
    return false;
  }

  _renderPreview() {
    const p = this._config?.popup || {};
    const c = p.colors || {};
    const bg     = c.dialog_bg     || '#363638';
    const title  = c.title_color   || '#ECDFCC';
    const msg    = c.message_color || '#aaaaaa';
    const canBg  = c.cancel_bg     || '#28282A';
    const canCol = c.cancel_color  || '#ECDFCC';
    const conBg  = c.confirm_bg    || '#ECDFCC';
    const conCol = c.confirm_color || '#28282A';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; }
        .preview { background:${bg}; border-radius:20px; padding:20px; display:flex; flex-direction:column; align-items:center; gap:12px; text-align:center; }
        .preview-title { font-size:16px; font-weight:700; color:${title}; }
        .preview-msg { font-size:12px; color:${msg}; line-height:1.5; }
        .preview-btns { display:flex; gap:8px; width:100%; }
        .preview-btns button { flex:1; padding:10px; border:none; border-radius:12px; font-size:12px; font-weight:600; cursor:default; }
        .btn-cancel { background:${canBg}; color:${canCol}; }
        .btn-confirm { background:${conBg}; color:${conCol}; }
        .preview-label { font-size:10px; color:${msg}; opacity:0.6; margin-top:-4px; }
      </style>
      <div class="preview">
        ${p.title ? `<div class="preview-title">${p.title}</div>` : ''}
        <div class="preview-msg">${p.message || 'Bist du sicher?'}</div>
        <div class="preview-btns">
          <button class="btn-cancel">${p.cancel_text || 'Abbrechen'}</button>
          <button class="btn-confirm">${p.confirm_text || 'Bestätigen'}</button>
        </div>
        <div class="preview-label">Confirm Card – Vorschau</div>
      </div>`;
  }

  async _buildInnerCard() {
    // Vorschau anzeigen wenn keine Entity oder im Preview-Modus
    const entityId = this._config?.entity || this._config?.card?.entity;
    if (!entityId || this._isPreviewMode()) {
      this._renderPreview();
      // Wenn Entity später gesetzt wird, neu aufbauen
      if (!entityId) return;
    }

    try {
      const helpers = await window.loadCardHelpers();
      const card = helpers.createCardElement(this._config.card);
      const hass = this._hassQueue || this._hass;
      if (hass) card.hass = hass;
      this._hassQueue = null;
      this._innerCard = card;
      this.shadowRoot.innerHTML = `
        <style>
          :host { display:block; position:relative; }
          .blocker { position:absolute; top:0; left:0; right:0; bottom:0; z-index:100; -webkit-tap-highlight-color:transparent; }
        </style>
      `;
      this.shadowRoot.appendChild(card);
    } catch(e) {
      console.error('[confirm-card]', e);
    }

    // Blocker immer erstellen
    const blocker = document.createElement('div');
    blocker.className = 'blocker';
    this._updateCursor(blocker);

    let startX = 0, startY = 0, moved = false;

    blocker.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      moved = false;
    }, { passive: true });

    blocker.addEventListener('touchmove', (e) => {
      if (Math.abs(e.touches[0].clientX - startX) > 8 ||
          Math.abs(e.touches[0].clientY - startY) > 8) moved = true;
    }, { passive: true });

    const trigger = (e) => {
      if (this._isEditMode()) return;
      e.stopPropagation(); e.preventDefault();
      this._trigger();
    };

    blocker.addEventListener('touchend', (e) => { if (!moved) trigger(e); }, { passive: false });
    blocker.addEventListener('click', trigger);
    this.shadowRoot.appendChild(blocker);
  }

  _trigger() {
    const { popup } = this._config;
    const entityId = this._config.entity || this._config.card?.entity;

    if (entityId && this._hass && popup.disabled_states) {
      const state = this._hass.states[entityId]?.state;
      if (popup.disabled_states.includes(state)) return;
    }

    showConfirm(popup, () => executeAction(popup.on_confirm, this._hass));
  }

  _isEditMode() {
    if (this._hass?.editMode) return true;
    if (this.closest('hui-card-preview, hui-dialog-edit-card, bubble-pop-up')) return true;
    for (const d of document.querySelectorAll('hui-dialog-edit-card')) {
      if (d.shadowRoot?.querySelector('ha-dialog[open]') || d.hasAttribute('open')) return true;
    }
    return false;
  }

  _updateCursor(blocker) {
    const el = blocker || this.shadowRoot?.querySelector('.blocker');
    if (!el) return;
    const entityId = this._config?.entity || this._config?.card?.entity;
    const states = this._config?.popup?.disabled_states || ['unavailable', 'unknown'];
    if (entityId && this._hass) {
      const state = this._hass.states[entityId]?.state;
      el.style.cursor = states.includes(state) ? 'default' : 'pointer';
    } else {
      el.style.cursor = 'pointer';
    }
  }
}

customElements.define('confirm-card', ConfirmCard);

console.info(
  '%c  CONFIRM CARD  %c\n%c  Bestätigungs-Popup für Home Assistant  %c\n%c  v1.0.0  %c',
  ['background:#363638','color:#ECDFCC','font-size:16px','font-weight:700','letter-spacing:1px','padding:10px 87px 6px','border-radius:20px 20px 0 0'].join(';'),
  '',
  ['background:#363638','color:#aaaaaa','font-size:11px','padding:4px 28px 8px'].join(';'),
  '',
  ['background:#ECDFCC','color:#28282A','font-size:12px','font-weight:700','padding:6px 128px','border-radius:0 0 20px 20px','letter-spacing:0.5px'].join(';'),
  ''
);
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'confirm-card',
  name: 'Confirm Card',
  description: 'Zeigt ein Bestätigungs-Popup bevor eine Aktion ausgeführt wird. Mit visuelem Editor und anpassbarem Design.',
  preview: true,
});

// ── Card Editor ────────────────────────────────────────────────────────────

const THEMES = {
  dark: {
    dialog_bg:      '#363638',
    title_color:    '#ECDFCC',
    message_color:  '#aaaaaa',
    cancel_bg:      '#28282A',
    cancel_color:   '#ECDFCC',
    confirm_bg:     '#ECDFCC',
    confirm_color:  '#28282A',
  },
  light: {
    dialog_bg:      '#ECDFCC',
    title_color:    '#28282A',
    message_color:  '#555555',
    cancel_bg:      '#d4c4a8',
    cancel_color:   '#28282A',
    confirm_bg:     '#28282A',
    confirm_color:  '#ECDFCC',
  },
};

const SERVICE_MAP_ED = {
  switch:'switch.toggle', light:'light.toggle', input_boolean:'input_boolean.toggle',
  cover:'cover.toggle', fan:'fan.toggle', lock:'lock.toggle',
  button:'button.press', scene:'scene.turn_on', script:'script.turn_on',
};
// Pill-Style Template (Dyson Style)
const PILL_TEMPLATE = (entity, name, icon) => ({
  type: 'custom:button-card',
  entity,
  name: name || '',
  icon: icon || 'mdi:power-plug',
  tap_action: { action: 'none' },
  extra_styles: ':host{--button-card-ripple-color:transparent!important;--ha-ripple-color:transparent!important;-webkit-tap-highlight-color:transparent!important;overflow:hidden}',
  state: [
    { value: 'off', icon: icon ? icon + '-off' : 'mdi:power-plug-off', styles: { icon: [{'color':'#ECDFCC'},{'opacity':'0.6'}], img_cell: [{'background':'#3a3b3d'}] } },
    { value: 'unavailable', icon: icon ? icon + '-off' : 'mdi:power-plug-off', styles: { card: [{'background':'#C62828'},{'pointer-events':'none'}], icon: [{'color':'#ECDFCC'},{'opacity':'0.6'}], img_cell: [{'background':'#3a3b3d'}], name: [{'color':'#ECDFCC'}] } },
  ],
  styles: {
    card: [{'height':'56px'},{'border-radius':'75px'},{'padding':'4px 20px 4px 4px'},{'background':'#28282A'}],
    grid: [{'grid-template-columns':'57px 1fr'},{'grid-template-areas':'"i n" "i state"'}],
    icon: [{'width':'24px'},{'color':'#28282A'}],
    img_cell: [{'justify-self':'start'},{'width':'48px'},{'height':'48px'},{'border-radius':'50%'},{'background':'#ECDFCC'}],
    name: [{'justify-self':'start'},{'font-size':'14px'},{'color':'#ECDFCC'},{'padding-top':'8px'},{'font-weight':'500'}],
    custom_fields: { state: [{'justify-self':'start'},{'font-size':'13px'},{'padding-bottom':'6px'},{'color':'#ECDFCC'},{'opacity':'0.7'}] },
  },
  custom_fields: { state: '[[[if(entity.state==="on")return`<span>Ein</span>`;if(entity.state==="unavailable")return`<span>Nicht verfügbar</span>`;return`<span>Aus</span>`;]]]' },
});

const getAutoSvc = id => { if(!id) return ''; const d=id.split('.')[0]; return SERVICE_MAP_ED[d]||`${d}.toggle`; };

const DOMAIN_FILTER = {
  button: ['switch', 'input_boolean'],
  light:  ['light'],
  tile:   [],
};

// jsyaml von CDN laden falls nicht verfügbar
function loadJsYaml() {
  if (window.jsyaml) return Promise.resolve(window.jsyaml);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js';
    s.onload  = () => resolve(window.jsyaml);
    s.onerror = () => reject(new Error('jsyaml konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}
const tryParseYaml = s => { try { return window.jsyaml?.load(s)||null; } catch(e) { return null; } };
const tryDumpYaml  = o => {
  try {
    if (window.jsyaml) return window.jsyaml.dump(o, {
      indent: 2,
      lineWidth: -1,       // kein Zeilenumbruch
      noRefs: true,        // keine YAML-Referenzen
      flowLevel: -1,       // immer Block-Stil, keine eckigen Klammern
      quotingType: '"',    // doppelte Anführungszeichen wenn nötig
      forceQuotes: false,  // nur wenn unbedingt nötig
    });
    return JSON.stringify(o, null, 2);
  } catch(e) { return ''; }
};
async function parseYamlAsync(str) {
  try {
    const yaml = await loadJsYaml();
    return yaml.load(str);
  } catch(e) { return null; }
}

class ConfirmCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode:'open' });
    this._config = {};
    this._hass   = null;
    this._mode   = 'button';
    this._customYaml   = '';
    this._useCustomYaml = false;
    this._yamlStatus = '';
    this._savedCustomYaml = '';
    this._nameTimer = null;
    this._ignoreNextSetConfig = false;
    this._editorName = '';
    this._editorIcon = '';
    this._presetEntity = '';
    this._savedEntities = {};
    this._cardStyle = 'standard'; // 'standard' | 'pill'
    this._expectedEntity = undefined; // Erzwingt was der Picker zeigen soll
    this._customStates = ['unavailable','unknown'];
  }

  set hass(hass) {
    this._hass = hass;
    this.shadowRoot.querySelectorAll('ha-entity-picker').forEach(el => el.hass = hass);
  }

  setConfig(config) {
    // Wenn durch eigenes _fireChanged ausgelöst → _customYaml NICHT überschreiben
    if (this._ignoreNextSetConfig) {
      this._ignoreNextSetConfig = false;
      this._config = JSON.parse(JSON.stringify(config));
      if (this._config.card) this._config.card.tap_action = { action: 'none' };
      return;
    }

    const prevMode   = this._mode;
    const prevCustom = this._useCustomYaml;
    const isFirstRender = !this.shadowRoot.querySelector('.sec');

    this._config = JSON.parse(JSON.stringify(config));
    const t = config.card?.type || 'button';

    const SIMPLE_KEYS = new Set(['type','entity','tap_action','name','icon']);
    const cardKeys = Object.keys(config.card || {});
    const isSimple = ['button','light','tile'].includes(t) && cardKeys.every(k => SIMPLE_KEYS.has(k));

    // Name und Icon immer beim ersten Render laden
    if (isFirstRender) {
      this._editorName = config.card?.name || '';
      this._editorIcon = config.card?.icon || '';
      this._cardStyle = config.card?.type === 'custom:button-card' ? 'pill' : 'standard';
    }

    if (isSimple) {
      this._mode = t;
      this._useCustomYaml = false;
    } else {
      this._mode = ['button','light','tile'].includes(t) ? t : 'button';
      this._useCustomYaml = true;
      // Beim ersten Laden oder bei externen Änderungen (YAML-Editor): neu laden
      if (!this._customYaml || isFirstRender) {
        this._customYaml = '';
        this._yamlStatus = '';
        this._pendingCard = config.card || {};
      } else {
        // Externe Änderung: YAML und Textarea aktualisieren
        this._pendingCard = config.card || {};
        loadJsYaml().then(yaml => {
          const dumped = yaml.dump(config.card, { indent:2, lineWidth:-1, noRefs:true, flowLevel:-1, quotingType:'"', forceQuotes:false });
          this._customYaml = dumped;
          this._savedCustomYaml = dumped;
          const ta = this.shadowRoot.querySelector('#f-yaml');
          const st = this.shadowRoot.querySelector('#yaml-status');
          if (ta) ta.value = dumped;
          if (st) { st.textContent = '✓ YAML aus YAML-Editor übernommen'; st.style.color = 'var(--success-color,#4CAF50)'; }
        });
      }
    }

    this._customStates = config.popup?.disabled_states || ['unavailable','unknown'];

    if (isFirstRender || this._mode !== prevMode || this._useCustomYaml !== prevCustom) {
      this._render();
      if (this._useCustomYaml && this._pendingCard) {
        loadJsYaml().then(yaml => {
          const dumped = yaml.dump(this._pendingCard, { indent:2, lineWidth:-1, noRefs:true, flowLevel:-1, quotingType:'"', forceQuotes:false });
          this._customYaml = dumped;
          this._pendingCard = null;
          const ta = this.shadowRoot.querySelector('#f-yaml');
          const st = this.shadowRoot.querySelector('#yaml-status');
          if (ta) ta.value = dumped;
          if (st) { st.textContent = '✓ YAML geladen'; st.style.color = 'var(--success-color,#4CAF50)'; }
        }).catch(() => {
          const st = this.shadowRoot.querySelector('#yaml-status');
          if (st) { st.textContent = '⚠ YAML manuell einfügen'; st.style.color = 'var(--warning-color,#FF9800)'; }
        });
      }
    }
  }



  _render() {
    const sr   = this.shadowRoot;
    const p    = this._config.popup || {};
    const card = this._config.card  || {};
    const eid  = this._config.entity || card.entity || '';

    sr.innerHTML = `<style>
      :host{display:block;font-family:var(--primary-font-family,sans-serif);color:var(--primary-text-color)}
      .sec{padding:12px 0;border-bottom:1px solid var(--divider-color,#e0e0e0)}
      .sec:last-child{border-bottom:none}
      .lbl{font-size:11px;font-weight:600;color:var(--secondary-text-color);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
      .row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .field{margin-bottom:10px;display:flex;flex-direction:column;gap:4px}
      .field label{font-size:12px;color:var(--secondary-text-color)}
      .field input{padding:8px 10px;border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;font-size:13px;background:var(--input-fill-color,#f5f5f5);color:var(--primary-text-color);width:100%;box-sizing:border-box;font-family:inherit}
      .field textarea{padding:8px 10px;border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;font-size:12px;background:var(--input-fill-color,#f5f5f5);color:var(--primary-text-color);width:100%;box-sizing:border-box;font-family:var(--code-font-family,monospace);min-height:356px !important;resize:vertical;line-height:1.6}
      .type-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}
      .tb{padding:10px 4px;border:1px solid #3b3c3e;border-radius:8px;background:#3b3c3e;font-size:11px;color:#ECDFCC;cursor:pointer;text-align:center;display:flex;flex-direction:column;align-items:center;gap:5px;font-weight:500}
      .tb ha-icon{--mdc-icon-size:20px;color:#ECDFCC}
      .tb.on{border-color:#ECDFCC;background:#ECDFCC;color:#28282A;font-weight:600}
      .tb.on ha-icon{color:#28282A}
      .state-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
      .state-row input{flex:1;padding:7px 10px;border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;font-size:13px;background:var(--input-fill-color,#f5f5f5);color:var(--primary-text-color)}
      .rm{padding:4px 8px;border:none;background:none;cursor:pointer;color:var(--error-color,#e53935);font-size:16px}
      .add{font-size:13px;color:var(--primary-color,#5b3de8);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;padding:4px 0;margin-top:2px}

      .hint{font-size:11px;color:var(--secondary-text-color);margin-top:3px;line-height:1.5}
      .custom-area{width:100%;min-height:356px;padding:10px;border:1px solid var(--divider-color,#e0e0e0);border-radius:6px;font-family:var(--code-font-family,monospace);font-size:12px;background:var(--input-fill-color,#f5f5f5);color:var(--primary-text-color);resize:vertical;box-sizing:border-box;line-height:1.6}
      .toggle-wrap{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .toggle-label{font-size:13px;color:var(--secondary-text-color)}
      .toggle-sw{position:relative;width:38px;height:22px;flex-shrink:0}
      .toggle-sw input{opacity:0;width:0;height:0;position:absolute}
      .toggle-track{position:absolute;inset:0;border-radius:11px;background:var(--divider-color,#ccc);cursor:pointer;transition:background 0.2s}
      .toggle-sw input:checked + .toggle-track{background:var(--primary-color,#5b3de8)}
      .toggle-track::after{content:'';position:absolute;width:16px;height:16px;border-radius:50%;background:white;top:3px;left:3px;transition:transform 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.3)}
      .toggle-sw input:checked + .toggle-track::after{transform:translateX(16px)}
      #ep-wrap ha-entity-picker{display:block;width:100%}
    </style>

    <div class="sec">
      <div class="lbl">Karten-Typ</div>
      <div class="type-grid" style="grid-template-columns:repeat(3,1fr)">
        <div class="tb ${this._mode==='button'?'on':''}" data-mode="button"><ha-icon icon="mdi:toggle-switch"></ha-icon>Schalter</div>
        <div class="tb ${this._mode==='light' ?'on':''}" data-mode="light"><ha-icon icon="mdi:lightbulb"></ha-icon>Licht</div>
        <div class="tb ${this._mode==='tile'  ?'on':''}" data-mode="tile"><ha-icon icon="mdi:view-dashboard"></ha-icon>Tile</div>
      </div>

      <div class="lbl" style="margin-top:12px;margin-bottom:8px">Karten-Stil</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">

        <label style="display:flex;align-items:center;gap:8px;padding:10px;border:1px solid ${this._cardStyle==='standard'?'#ECDFCC':'var(--divider-color,#e0e0e0)'};border-radius:8px;cursor:pointer;background:${this._cardStyle==='standard'?'#ECDFCC':'#3b3c3e'}">
          <input type="radio" name="card-style" value="standard" ${this._cardStyle==='standard'?'checked':''} style="accent-color:#28282A" />
          <span style="font-size:12px;font-weight:500;color:${this._cardStyle==='standard'?'#28282A':'#ECDFCC'}">Standard</span>
        </label>

        <label style="display:flex;flex-direction:column;gap:6px;padding:10px;border:1px solid ${this._cardStyle==='pill'?'#ECDFCC':'var(--divider-color,#e0e0e0)'};border-radius:8px;cursor:pointer;background:${this._cardStyle==='pill'?'#ECDFCC':'#3b3c3e'}">
          <div style="display:flex;align-items:center;gap:8px">
            <input type="radio" name="card-style" value="pill" ${this._cardStyle==='pill'?'checked':''} style="accent-color:#28282A" />
            <span style="font-size:12px;font-weight:500;color:${this._cardStyle==='pill'?'#28282A':'#ECDFCC'}">Pill Style</span>
          </div>
          <!-- Mini Vorschau Pill -->
          <div style="background:#28282A;border-radius:28px;padding:4px 10px 4px 4px;display:flex;align-items:center;gap:6px;pointer-events:none">
            <div style="width:24px;height:24px;border-radius:50%;background:#ECDFCC;display:flex;align-items:center;justify-content:center;flex-shrink:0">
              <ha-icon icon="mdi:power-plug" style="--mdc-icon-size:14px;color:#28282A"></ha-icon>
            </div>
            <div>
              <div style="font-size:9px;color:#ECDFCC;font-weight:500;line-height:1.2">${this._editorName||'Gerät'}</div>
              <div style="font-size:8px;color:#ECDFCC;opacity:0.7">Aus</div>
            </div>
          </div>
        </label>

      </div>
    </div>

    ${this._mode!=='custom' ? `
      <div class="sec">
        <div class="lbl">Entität</div>
        <div class="field" id="ep-wrap"></div>
        <div id="entity-hint" class="hint" style="margin-top:-4px;display:block">
          ${(()=>{
            if (!eid) return '<span style="color:var(--warning-color,#FF9800)">⚠ Bitte ' + (this._mode==='light'?'eine Lampe':'einen Schalter') + ' auswählen</span>';
            const d = eid.split('.')[0];
            const valid = DOMAIN_FILTER[this._mode] || [];
            if (valid.length > 0 && !valid.includes(d)) return '<span style="color:var(--error-color,#e53935)">⚠ <b>' + eid + '</b> ist ' + (this._mode==='light'?'keine Lampe':'kein Schalter') + ' – bitte passende Entität wählen</span>';
            return '';
          })()}
        </div>
        <div class="row">
          <div class="field">
            <label>Name</label>
            <input id="f-name" type="text" value="${this._editorName}" placeholder="Optional" />
          </div>
          <div class="field">
            <label>Icon</label>
            <input id="f-icon" type="text" value="${this._editorIcon}" placeholder="mdi:home" />
          </div>
        </div>
      </div>
    ` : ''}

    <div class="sec">
      <div class="lbl">Bestätigungs-Popup</div>
      <div class="field">
        <label>Nachricht</label>
        <input id="f-msg" type="text" value="${p.message||''}" placeholder="Bist du sicher?" />
      </div>
      <div class="row">
        <div class="field">
          <label>Bestätigen-Text</label>
          <input id="f-ok" type="text" value="${p.confirm_text||'Bestätigen'}" />
        </div>
        <div class="field">
          <label>Abbrechen-Text</label>
          <input id="f-no" type="text" value="${p.cancel_text||'Abbrechen'}" />
        </div>
      </div>
      <div class="field">
        <label>Titel (optional)</label>
        <input id="f-title" type="text" value="${p.title||''}" placeholder="Leer lassen für keinen Titel" />
      </div>
    </div>

    <div class="sec">
      <div class="lbl">Design</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="tb ${(this._config.popup?.colors?.dialog_bg||'#363638')==='#363638'?'on':''}" data-theme="dark" style="flex:1;padding:10px 8px">Dunkel</button>
        <button class="tb ${(this._config.popup?.colors?.dialog_bg||'#363638')==='#ECDFCC'?'on':''}" data-theme="light" style="flex:1;padding:10px 8px">Hell</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${[
          ['dialog_bg',     'Dialog Hintergrund'],
          ['title_color',   'Titel Farbe'],
          ['message_color', 'Nachricht Farbe'],
          ['cancel_bg',     'Abbrechen Hintergrund'],
          ['cancel_color',  'Abbrechen Schrift'],
          ['confirm_bg',    'Bestätigen Hintergrund'],
          ['confirm_color', 'Bestätigen Schrift'],
        ].map(([key,label]) => {
          const c = this._config.popup?.colors || THEMES.dark;
          const val = c[key] || THEMES.dark[key];
          return '<div style="display:flex;align-items:center;gap:8px">'
            + '<input type="color" data-color="' + key + '" value="' + val + '" style="width:36px;height:32px;border:none;border-radius:6px;cursor:pointer;padding:2px;flex-shrink:0">'
            + '<label style="font-size:12px;color:var(--secondary-text-color)">' + label + '</label>'
            + '</div>';
        }).join('')}
      </div>
    </div>


    <div class="sec">
      <div class="lbl">Aktion</div>
      <div class="field">
        <label>Service</label>
        <input id="f-svc" type="text" value="${p.on_confirm?.service||getAutoSvc(eid)}" />
        <div class="hint">Wird automatisch aus der Entity erkannt. Nur bei Bedarf ändern.</div>
      </div>
      <div class="lbl" style="margin-top:8px">Gesperrte States</div>
      <div id="state-list">
        ${this._customStates.map((s,i)=>`
          <div class="state-row">
            <input data-si="${i}" type="text" value="${s}" />
            <button class="rm" data-rm="${i}">✕</button>
          </div>`).join('')}
      </div>
      <button class="add" id="add-state"><ha-icon icon="mdi:plus" style="--mdc-icon-size:16px"></ha-icon> State hinzufügen</button>
    </div>

    <div class="sec">
      <div class="lbl">Eigener Code (optional)</div>
      <div class="toggle-wrap">
        <span class="toggle-label">Eigene Karte verwenden</span>
        <label class="toggle-sw">
          <input type="checkbox" id="toggle-custom" ${this._useCustomYaml?'checked':''} />
          <span class="toggle-track"></span>
        </label>
      </div>
      ${this._useCustomYaml ? `
        <div class="field">
          <textarea id="f-yaml" class="custom-area" placeholder="type: custom:button-card&#10;name: Mein Gerät&#10;entity: switch.example&#10;styles:&#10;  card:&#10;    - background: '#28282A'&#10;...">${this._customYaml}</textarea>
          <div id="yaml-status" class="hint" style="margin-top:6px">${this._yamlStatus||'Tipp: Alle Keys auf Einrückebene 0 (keine führenden Leerzeichen).'}</div>
        </div>
      ` : `
        <div class="hint">Aktiviere den Schalter um eine eigene Karte mit Custom-Styling zu verwenden.</div>
      `}
    </div>`;

    // Entity Picker separat injizieren (bleibt HA-nativ)
    const epWrap = sr.querySelector('#ep-wrap');
    if (epWrap) {
      const ep = document.createElement('ha-entity-picker');
      ep.hass  = this._hass;
      ep.label = 'Entität';
      ep.style.width = '100%';
      ep.addEventListener('value-changed', e => {
        this._entityChanged(e.detail.value);
        const hint = this.shadowRoot.querySelector('#entity-hint');
        if (hint) {
          const v = e.detail.value || '';
          const d = v.split('.')[0];
          const valid = DOMAIN_FILTER[this._mode] || [];
          if (!v) hint.innerHTML = '<span style="color:var(--warning-color,#FF9800)">⚠ Bitte ' + (this._mode==='light'?'eine Lampe':'einen Schalter') + ' auswählen</span>';
          else if (valid.length > 0 && !valid.includes(d)) hint.innerHTML = '<span style="color:var(--error-color,#e53935)">⚠ <b>' + v + '</b> ist ' + (this._mode==='light'?'keine Lampe':'kein Schalter') + ' – bitte passende Entität wählen</span>';
          else hint.innerHTML = '';
        }
      });
      // Properties VOR appendChild setzen → Picker rendert sofort korrekt, kein Jump
      const domains = DOMAIN_FILTER[this._mode] || [];
      if (domains.length > 0) ep.includeDomains = domains;
      if (eid) ep.value = eid;
      epWrap.appendChild(ep);
    }

    this._listen();

    // System-Theme automatisch anwenden wenn noch keine Farben gesetzt
    if (!this._config.popup?.colors) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const autoTheme = prefersDark ? THEMES.dark : THEMES.light;
      this._config.popup = { ...this._config.popup, colors: { ...autoTheme } };
      Object.entries(autoTheme).forEach(([key, val]) => {
        const inp = this.shadowRoot.querySelector('[data-color="' + key + '"]');
        if (inp) inp.value = val;
      });
      // Aktiven Button markieren
      const themeKey = prefersDark ? 'dark' : 'light';
      this.shadowRoot.querySelectorAll('.tb[data-theme]').forEach(b => {
        b.classList.toggle('on', b.dataset.theme === themeKey);
      });
    }

    setTimeout(() => {
      const ta = this.shadowRoot.querySelector('#f-yaml');
      if (ta) { ta.style.minHeight = '356px'; ta.style.height = 'auto'; }
    }, 50);
  }

  _listen() {
    const sr = this.shadowRoot;
    const on = (id, fn) => { const el=sr.querySelector(id); if(el) el.addEventListener('input', e => fn(e.target.value)); };

    // Karten-Typ
    sr.querySelectorAll('.tb[data-mode]').forEach(b => b.addEventListener('click', () => this._setMode(b.dataset.mode)));

    // Stil-Auswahl
    sr.querySelectorAll('[name="card-style"]').forEach(r => r.addEventListener('change', () => {
      this._cardStyle = r.value;
      this._applyCardStyle();
      this._render();
    }));

    // Theme Presets
    sr.querySelectorAll('.tb[data-theme]').forEach(btn => btn.addEventListener('click', () => {
      const theme = THEMES[btn.dataset.theme];
      this._updatePopup({ colors: { ...theme } });
      Object.entries(theme).forEach(([key, val]) => {
        const inp = sr.querySelector('[data-color="' + key + '"]');
        if (inp) inp.value = val;
      });
      sr.querySelectorAll('.tb[data-theme]').forEach(b => b.classList.toggle('on', b === btn));
    }));

    // Individuelle Farbwähler
    sr.querySelectorAll('[data-color]').forEach(inp => inp.addEventListener('input', () => {
      const colors = { ...(this._config.popup?.colors || THEMES.dark), [inp.dataset.color]: inp.value };
      this._updatePopup({ colors });
    }));

    // Eigener Code Toggle
    const toggleCustom = sr.querySelector('#toggle-custom');
    if (toggleCustom) toggleCustom.addEventListener('change', async () => {
      this._useCustomYaml = toggleCustom.checked;
      // Entity aus Config oder direkt aus YAML-Text (Fallback wenn jsyaml nicht geladen)
      // Preset-Entity bevorzugen (gespeichert vor Custom-YAML Aktivierung)
      let eid = this._presetEntity || this._config.entity || this._config.card?.entity || '';
      if (!eid && this._customYaml) {
        const m = this._customYaml.match(/^entity:\s*(.+)$/m);
        if (m) eid = m[1].trim().replace(/['"]/g, '');
      }
      this._presetEntity = ''; // Reset nach Verwendung

      if (!this._useCustomYaml) {
        // Preset-Karte – Custom YAML in _savedCustomYaml sichern
        if (this._customYaml) this._savedCustomYaml = this._customYaml;
        // Entity nur übernehmen wenn sie zur aktuellen Domain passt
        const eidDomain = eid.split('.')[0];
        const validDomains = DOMAIN_FILTER[this._mode] || [];
        const entityOk = validDomains.length === 0 || validDomains.includes(eidDomain);
        const safeEid = entityOk ? eid : '';
        this._config.card = { type: this._mode, entity: safeEid, tap_action: { action: 'none' } };
        this._fireChanged();
        this._render();
      } else {
        // Aktuelle Preset-Entity sichern bevor Custom YAML sie überschreibt
        this._presetEntity = this._config.entity || this._config.card?.entity || '';
        // YAML wiederherstellen: aus _savedCustomYaml oder _customYaml
        const yaml = this._savedCustomYaml || this._customYaml || '';
        this._customYaml = yaml;
        this._render();
        // Nach render: Textarea befüllen und async parsen
        await new Promise(r => setTimeout(r, 50));
        const ta = this.shadowRoot.querySelector('#f-yaml');
        if (ta && yaml) {
          ta.value = yaml;
          ta.style.minHeight = '356px';
          try {
            const jsyaml = await loadJsYaml();
            const parsed = jsyaml.load(yaml);
            if (parsed && typeof parsed === 'object') {
              this._config.card = { ...parsed, tap_action: { action: 'none' } };
              this._yamlStatus = '✓ YAML wiederhergestellt';
              const st = this.shadowRoot.querySelector('#yaml-status');
              if (st) { st.textContent = this._yamlStatus; st.style.color = 'var(--success-color,#4CAF50)'; }
              this._fireChanged();
            }
          } catch(e) {
            const st = this.shadowRoot.querySelector('#yaml-status');
            if (st) { st.textContent = '⚠ YAML Fehler: ' + e.message; st.style.color = 'var(--error-color,#e53935)'; }
          }
        }
      }
    });

    // Custom YAML Textarea – Tab/Shift+Tab Einrückung
    const ya = sr.querySelector('#f-yaml');
    if (ya) ya.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const start = ya.selectionStart;
      const end   = ya.selectionEnd;
      const val   = ya.value;
      const lines = val.substring(start, end).split('\n');

      if (e.shiftKey) {
        const unindented = lines.map(l => l.startsWith('  ') ? l.slice(2) : l.startsWith(' ') ? l.slice(1) : l);
        const newVal = val.substring(0, start) + unindented.join('\n') + val.substring(end);
        ya.value = newVal;
        ya.selectionStart = start;
        ya.selectionEnd   = end - (lines.length - unindented.filter((_,i) => lines[i] !== unindented[i]).length);
      } else {
        // Tab: 2 Leerzeichen einfügen
        if (start === end) {
          ya.value = val.substring(0, start) + '  ' + val.substring(end);
          ya.selectionStart = ya.selectionEnd = start + 2;
        } else {
          const indented = lines.map(l => '  ' + l).join('\n');
          ya.value = val.substring(0, start) + indented + val.substring(end);
          ya.selectionStart = start;
          ya.selectionEnd   = start + indented.length;
        }
      }
      ya.dispatchEvent(new Event('input'));
    });
    if (ya) ya.addEventListener('input', async () => {
      this._customYaml = ya.value;
      const statusEl = this.shadowRoot.querySelector('#yaml-status');
      if (!ya.value.trim()) {
        this._yamlStatus = '';
        if (statusEl) statusEl.textContent = 'Tipp: Alle Keys auf Einrückebene 0 (keine führenden Leerzeichen).';
        if (statusEl) statusEl.style.color = '';
        return;
      }
      try {
        const parsed = await parseYamlAsync(ya.value);
        if (parsed && typeof parsed === 'object') {
          this._config.card = { ...parsed, tap_action: { action: 'none' } };
          this._yamlStatus = '✓ YAML gültig – Karte wird übernommen';
          if (statusEl) { statusEl.textContent = this._yamlStatus; statusEl.style.color = 'var(--success-color, #4CAF50)'; }

          // YAML → UI Felder synchronisieren (Rückweg)
          const sr = this.shadowRoot;
          if (parsed.name !== undefined) {
            this._editorName = parsed.name;
            const fName = sr.querySelector('#f-name');
            if (fName && fName !== document.activeElement) fName.value = parsed.name;
          }
          if (parsed.icon !== undefined) {
            this._editorIcon = parsed.icon;
            const fIcon = sr.querySelector('#f-icon');
            if (fIcon && fIcon !== document.activeElement) fIcon.value = parsed.icon;
          }
          if (parsed.entity) {
            const ep = sr.querySelector('ha-entity-picker');
            if (ep && ep.value !== parsed.entity) ep.value = parsed.entity;
            const hint = sr.querySelector('#entity-hint');
            if (hint) {
              const d = parsed.entity.split('.')[0];
              const valid = DOMAIN_FILTER[this._mode] || [];
              if (valid.length > 0 && !valid.includes(d))
                hint.innerHTML = '<span style="color:var(--error-color,#e53935)">⚠ <b>' + parsed.entity + '</b> passt nicht zur Kategorie</span>';
              else hint.innerHTML = '';
            }
          }
          this._fireChanged();
        } else {
          this._yamlStatus = '⚠ Ungültiges YAML – bitte prüfen';
          if (statusEl) { statusEl.textContent = this._yamlStatus; statusEl.style.color = 'var(--error-color, #e53935)'; }
        }
      } catch(e) {
        this._yamlStatus = `⚠ YAML Fehler: ${e.message}`;
        if (statusEl) { statusEl.textContent = this._yamlStatus; statusEl.style.color = 'var(--error-color, #e53935)'; }
      }
    });

    // Felder
    on('#f-name',  v => this._updateCard({ name: v }));
    on('#f-icon',  v => this._updateCard({ icon: v }));
    on('#f-msg',   v => this._updatePopup({ message: v }));
    on('#f-ok',    v => this._updatePopup({ confirm_text: v }));
    on('#f-no',    v => this._updatePopup({ cancel_text: v }));
    on('#f-title', v => this._updatePopup({ title: v||undefined }));
    on('#f-svc',   v => {
      const eid = this._config.entity || this._config.card?.entity || '';
      this._updatePopup({ on_confirm: { action:'call-service', service:v, target:{ entity_id:eid } } });
    });



    // States
    sr.querySelectorAll('[data-si]').forEach(inp =>
      inp.addEventListener('input', () => {
        this._customStates[+inp.dataset.si] = inp.value;
        this._updatePopup({ disabled_states:[...this._customStates] });
      })
    );
    sr.querySelectorAll('[data-rm]').forEach(btn =>
      btn.addEventListener('click', () => {
        this._customStates.splice(+btn.dataset.rm, 1);
        this._updatePopup({ disabled_states:[...this._customStates] });
        this._render();
      })
    );
    const add = sr.querySelector('#add-state');
    if (add) add.addEventListener('click', () => {
      this._customStates.push('');
      this._updatePopup({ disabled_states:[...this._customStates] });
      this._render();
    });
  }

  _applyCardStyle() {
    const eid  = this._config.entity || this._config.card?.entity || '';
    const name = this._editorName || '';
    const icon = this._editorIcon || '';
    if (this._cardStyle === 'pill') {
      this._config.card = { ...PILL_TEMPLATE(eid, name, icon), tap_action: { action: 'none' } };
      this._useCustomYaml = true;
      loadJsYaml().then(yaml => {
        this._customYaml = yaml.dump(this._config.card, { indent:2, lineWidth:-1, noRefs:true, flowLevel:-1 });
        this._savedCustomYaml = this._customYaml;
      });
    } else {
      this._useCustomYaml = false;
      this._config.card = { type: this._mode, entity: eid, tap_action: { action: 'none' },
        ...(name ? { name } : {}), ...(icon ? { icon } : {}) };
    }
    this._fireChanged();
  }

  _setMode(mode) {
    const prevMode = this._mode;
    this._mode = mode;

    if (this._useCustomYaml && this._customYaml) {
      const parsed = tryParseYaml(this._customYaml);
      if (parsed) this._config.card = { ...parsed, tap_action: { action: 'none' } };
      this._fireChanged();
      this._render();
      return;
    }

    // Aktuelle Entity des alten Modus speichern
    const currentEid = this._config.entity || this._config.card?.entity || '';
    if (currentEid) this._savedEntities[prevMode] = currentEid;

    // Entity des neuen Modus wiederherstellen falls vorhanden
    const restoredEid = this._savedEntities[mode] || currentEid;

    const name = this._editorName || '';
    const icon = this._editorIcon || '';
    if (this._cardStyle === 'pill') {
      this._config.card = { ...PILL_TEMPLATE(restoredEid, name, icon), tap_action: { action: 'none' } };
    } else {
      this._config.card = { type: mode, entity: restoredEid, tap_action: { action: 'none' },
        ...(name ? { name } : {}), ...(icon ? { icon } : {}) };
    }
    this._fireChanged();
    this._render();
  }

  _entityChanged(eid) {
    this._config.popup = { ...this._config.popup };
    if (this._useCustomYaml) {
      this._syncToCustomYaml('entity', eid);
    } else {
      this._config.card = { ...this._config.card, entity: eid };
    }
    this._fireChanged();
  }


  _syncToCustomYaml(key, value) {
    if (!this._useCustomYaml || !this._customYaml) return;
    const lines = this._customYaml.split('\n');
    // Top-Level Key finden (kein führendes Leerzeichen)
    const idx = lines.findIndex(l => l.startsWith(key + ':') || l.startsWith(key + ' :'));
    if (idx < 0) return;
    // Anführungszeichen vom alten Wert übernehmen falls vorhanden
    const oldLine = lines[idx];
    const hasQuotes = oldLine.includes('"') || oldLine.includes("'");
    lines[idx] = hasQuotes ? `${key}: "${value}"` : `${key}: ${value}`;
    this._customYaml = lines.join('\n');
    const ta = this.shadowRoot.querySelector('#f-yaml');
    if (ta) ta.value = this._customYaml;
  }

  _updateCard(p) {
    if ('name' in p) this._editorName = p.name;
    if ('icon' in p) this._editorIcon = p.icon;
    this._config.card = { ...this._config.card, ...p };
    if (this._useCustomYaml) {
      for (const [key, value] of Object.entries(p)) {
        if (typeof value === 'string') this._syncToCustomYaml(key, value);
      }
    }
    this._fireChanged();
  }
  _updatePopup(p) { this._config.popup = { ...this._config.popup, ...p }; this._fireChanged(); }

  _fireChanged() {
    this._ignoreNextSetConfig = true;
    const out = JSON.parse(JSON.stringify(this._config));
    if (out.card?.tap_action?.action === 'none') delete out.card.tap_action;
    if (out.popup?.on_confirm) delete out.popup.on_confirm;
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail:{ config: out },
      bubbles:true, composed:true,
    }));
  }
}

customElements.define('confirm-card-editor', ConfirmCardEditor);