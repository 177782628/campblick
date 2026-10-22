"use strict";
function renderMeasurementVisual(card, type, value, solarMaximum = 330) {
  const visual = card.querySelector(".measurement-visual");
  const known = typeof value === "number" && Number.isFinite(value) && (type === "temperature" || (value >= 0 &&
    (type === "solar" ? Number.isFinite(solarMaximum) && solarMaximum > 0 : value <= 100)));
  const low = known && (type === "gas" || type === "battery") && value < 20;
  card.classList.toggle("is-low", low);
  card.querySelector(".low-warning").hidden = !low;
  visual.classList.toggle("is-unknown", !known);
  visual.setAttribute("aria-label", !known ? "Noch kein verifizierter Messwert" :
    type === "solar" ? "Solarleistung: " + value.toLocaleString("de-DE") + " Watt" :
    type === "temperature" ? "Temperatur: " + value.toLocaleString("de-DE") + " Grad Celsius" :
    "Fuellstand: " + value.toLocaleString("de-DE") + " Prozent");
  visual.querySelector("[data-unknown]").style.display = known ? "none" : "";
  if (type === "solar") {
    const sun = visual.querySelector("[data-sun]");
    const ratio = known ? Math.min(value / solarMaximum, 1) : 0;
    sun.setAttribute("transform", "scale(" + (known ? 0.4 + 0.6 * ratio : 0.55) + ")");
    sun.style.display = known && value === 0 ? "none" : "";
  } else {
    const height = {gas:45, battery:48, temperature:42}[type];
    // The thermometer scale spans -10 to 50 deg C.
    const percent = type === "temperature" ? Math.min(Math.max((value + 10) / 60 * 100, 0), 100) : value;
    const filled = known ? height * percent / 100 : 0;
    const level = visual.querySelector("[data-level]");
    level.setAttribute("y", String(height - filled));
    level.setAttribute("height", String(filled));
  }
}
(() => {
  // Some iOS BLE browsers (e.g. Bluetooth Browser) stretch the page under the status bar after scrolling
  // without reporting env(safe-area-inset-top). Add the notch height only while the page fills the whole screen.
  const probe = document.createElement("div");
  probe.className = "safe-area-probe";
  document.body.append(probe);
  const iOS = /iPhone|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
  let scheduled = false;
  function updateNotch() {
    scheduled = false;
    const reported = probe.getBoundingClientRect().height;
    const portrait = innerHeight >= innerWidth;
    const screenHeight = portrait ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height);
    const height = Math.max(innerHeight, visualViewport?.height || 0);
    const fullScreen = height >= screenHeight - 2;
    const fallback = iOS && portrait && fullScreen && reported < 1 ? 59 : 0;
    document.documentElement.style.setProperty("--notch-fallback", fallback + "px");
    const info = document.getElementById("notch-diagnosis");
    if (info) info.textContent = "Bildschirm " + screenHeight + " px / Seite " + Math.round(height) +
      " px / Aussparung gemeldet " + Math.round(reported) + " px / Zusatzabstand " + fallback + " px";
  }
  const schedule = () => { if (!scheduled) { scheduled = true; requestAnimationFrame(updateNotch); } };
  for (const target of [window, window.visualViewport].filter(Boolean)) {
    target.addEventListener("resize", schedule);
    target.addEventListener("scroll", schedule, {passive:true});
  }
  addEventListener("orientationchange", schedule);
  updateNotch();
})();
(() => {
  const $ = id => document.getElementById(id);
  const types = ["gas", "battery", "temperature", "solar"];
  const brands = {gas:"Gasolina", battery:"Snettbox", temperature:"Snettbox / 12-V-Seite", solar:"Dometic SC330"};
  const storageKey = "campblick.displays.v1";
  const unnamed = "Unbenanntes Bluetooth-Geraet";
  // Snettbox streams CR-terminated JSON over the Microchip transparent UART service (verified on device FW 1.18).
  const snettbox = {service:"49535343-fe7d-4ae5-8fa9-9fafd205e455", characteristic:"49535343-1e4d-4bd9-ba61-23c647249616"};
  // Gasolina ("UTS Tank Sensor"): 8-byte record 45 LL LL BB xx 00 00 TT; LLLL/10 = fill level in percent
  // (matches the app: 0x0183 = 38.7 % shown as 39 %), BB = sensor battery %, TT = deg C.
  const gasolina = {service:"00001102-0000-1000-8000-00805f9b34fb", characteristic:"00001102-0001-1000-8000-00805f9b34fb"};
  // FEFB (Stollmann Terminal I/O) is requested in advance for the planned SC330 solar evaluation.
  const services = [snettbox.service, gasolina.service, "0000fefb-0000-1000-8000-00805f9b34fb"];
  const knownNames = {battery:[{namePrefix:"Snettbox"}], gas:[{namePrefix:"@UTS"}, {name:"UTS Tank Sensor"}], solar:[{namePrefix:"SC330"}]};
  const states = new Map();
  const diagnosis = new Map();
  let displays = [];
  let selectedId = null;
  let storageValid = true;
  let connectingAll = false;
  let needsTap = false;
  let temperature = null;
  const bluetooth = navigator.bluetooth;
  const supported = window.isSecureContext && typeof bluetooth?.requestDevice === "function";
  // null = still checking; browsers without getAvailability are treated as available.
  let bluetoothAvailable = supported && typeof bluetooth.getAvailability === "function" ? null : supported;
  function errorText(error) {
    return error instanceof Error ? error.message : String(error);
  }
  function report(message) {
    $("display-error").textContent = message;
    $("display-error").hidden = false;
  }
  function save(next) {
    if (!storageValid) {
      report("Gespeicherte Konfiguration ist ungueltig. Vor Aenderungen die Browser-Daten sichern und korrigieren.");
      return false;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      displays = next;
      $("display-error").hidden = true;
      return true;
    } catch (error) {
      report("Konfiguration nicht gespeichert: " + errorText(error));
      return false;
    }
  }
  function validDisplay(item) {
    return item && typeof item.id === "string" && item.id.length > 0 &&
      types.includes(item.type) && typeof item.name === "string" && item.name.trim().length > 0 && item.name.length <= 32 &&
      (item.deviceId === undefined || typeof item.deviceId === "string") &&
      (item.deviceName === undefined || typeof item.deviceName === "string") &&
      (item.autoConnect === undefined || typeof item.autoConnect === "boolean");
  }
  try {
    const stored = localStorage.getItem(storageKey);
    const temperatureCard = {id:"default-temperature", type:"temperature", name:"Temperatur"};
    if (stored === null) {
      save([{id:"default-gas", type:"gas", name:"Gas"}, {id:"default-battery", type:"battery", name:"Batterie"},
        temperatureCard, {id:"default-solar", type:"solar", name:"Solar"}]);
    } else {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed) || !parsed.every(validDisplay) || new Set(parsed.map(item => item.id)).size !== parsed.length) {
        throw new Error("Ungueltige Anzeigenkonfiguration");
      }
      displays = parsed;
      // One-time addition for existing setups; a later removal by the user is respected.
      if (!localStorage.getItem("campblick.temperatureAdded") && !parsed.some(item => item.type === "temperature")) {
        const next = [...parsed];
        const battery = next.findIndex(item => item.type === "battery");
        next.splice(battery < 0 ? next.length : battery + 1, 0, temperatureCard);
        save(next);
      }
    }
    localStorage.setItem("campblick.temperatureAdded", "1");
  } catch (error) {
    storageValid = false;
    report("Anzeigen konnten nicht geladen werden: " + errorText(error) + ". Gespeicherte Daten wurden nicht ueberschrieben.");
  }
  function current() { return states.get(selectedId); }
  function connected(state) { return !!state.device?.gatt?.connected; }
  function updateCamper() {
    const assigned = [...states.values()].filter(state => state.display.deviceId);
    const connecting = connectingAll || assigned.some(state => state.busy);
    // offline (grey) -> ready (black) -> connecting (driving) -> connected (green)
    const mode = connecting ? "connecting"
      : assigned.length && assigned.every(connected) ? "connected"
      : supported && bluetoothAvailable === true && assigned.length ? "ready" : "offline";
    const brand = document.querySelector(".brand");
    brand.dataset.camper = mode;
    brand.classList.toggle("is-driving", connecting);
    $("connect-all").disabled = connecting;
    $("connect-all").setAttribute("aria-busy", String(connecting));
    $("connect-all").setAttribute("aria-label", {
      offline:!supported ? "Camper grau: Web Bluetooth nicht verfuegbar"
        : bluetoothAvailable === null ? "Camper grau: Bluetooth wird geprueft"
        : bluetoothAvailable === false ? "Camper grau: Bluetooth ist ausgeschaltet"
        : "Camper grau: noch kein Geraet zugeordnet",
      ready:"Camper bereit: tippen, um alle Geraete zu verbinden",
      connecting:"Camper faehrt: Geraete werden verbunden",
      connected:"Camper gruen: alle Geraete verbunden"
    }[mode]);
  }
  // The temperature card has no device of its own; it mirrors the 12 V side sensors of a live Snettbox.
  function renderTemperature(state) {
    const live = [...states.values()].some(other => other.display.type === "battery" && other.live && connected(other));
    const format = value => Math.round(value).toLocaleString("de-DE");
    state.card.querySelector(".status").textContent = live ? "Ueber Snettbox / Live-Daten" : "Snettbox nicht verbunden";
    state.card.querySelector(".device").textContent = brands.temperature;
    state.card.querySelector(".reading-value").textContent = temperature ? format(temperature.value) + " \u00b0C" : "\u2014";
    renderMeasurementVisual(state.card, "temperature", temperature?.value ?? null);
    state.card.querySelector("dd").textContent = temperature ? temperature.values.map(format).join(" / ") + " \u00b0C" : "\u2014";
    state.card.classList.toggle("is-stale", !!temperature && !live);
    state.card.querySelector(".updated").textContent = temperature
      ? "Stand: " + new Date(temperature.time).toLocaleTimeString("de-DE") : "Noch kein Messwert";
  }
  function refreshTemperature() {
    for (const state of states.values()) if (state.display.type === "temperature") renderTemperature(state);
  }
  function update(state, status = state.status) {
    updateCamper();
    if (state.display.type === "temperature") { renderTemperature(state); return; }
    if (state.display.type === "battery") refreshTemperature();
    const isConnected = connected(state);
    state.status = status;
    state.card.querySelector(".status").textContent = status;
    state.card.querySelector(".device").textContent = state.display.deviceName || brands[state.display.type];
    state.card.classList.toggle("is-stale", !!state.values && !(isConnected && state.live));
    state.card.querySelector(".updated").textContent = state.values
      ? (isConnected && state.live ? "Live: " : "Letzter Wert: ") + new Date(state.values.time).toLocaleTimeString("de-DE")
      : "Noch kein verifizierter Messwert";
    if (selectedId === state.display.id) {
      $("device-state").textContent = status + (state.display.deviceName ? " / " + state.display.deviceName : "");
      $("choose-device").disabled = !supported || state.busy;
      $("choose-any-device").disabled = !supported || state.busy;
      $("reconnect-device").disabled = !supported || state.busy || !state.display.deviceId || isConnected;
      $("disconnect-device").disabled = state.busy || !isConnected;
      $("forget-device").disabled = state.busy || !state.display.deviceId;
    }
  }
  function clearRetry(state) {
    clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }
  function stopLive(state) {
    if (!state.live) return;
    if (state.live.listener) state.live.characteristic.removeEventListener("characteristicvaluechanged", state.live.listener);
    clearInterval(state.live.timer);
    state.live = null;
  }
  function release(state) {
    clearRetry(state);
    stopLive(state);
    if (state.device) {
      state.device.removeEventListener("gattserverdisconnected", state.onDisconnect);
      if (state.device.gatt?.connected) state.device.gatt.disconnect();
    }
    state.device = null;
  }
  function attach(state, device) {
    if (!device.gatt) throw new Error("Dieses Geraet bietet keinen erreichbaren GATT-Server.");
    if ([...states.values()].some(other => other !== state &&
      (other.device?.id === device.id || other.display.deviceId === device.id))) {
      throw new Error("Dieses Geraet ist bereits einer anderen Anzeige zugeordnet.");
    }
    release(state);
    state.device = device;
    device.addEventListener("gattserverdisconnected", state.onDisconnect);
  }
  function persistState(state, changes) {
    const next = {...state.display, ...changes};
    const saved = save(displays.map(item => item.id === next.id ? next : item));
    state.display = next;
    if (!saved) report("Zuordnung nur fuer diese Sitzung aktiv; Speichern fehlgeschlagen.");
  }
  function withTimeout(promise, ms, onTimeout = () => {}) {
    let timer;
    return Promise.race([promise, new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        onTimeout();
        reject(new Error("Zeitlimit erreicht. Geraetenaehe, Bluetooth und Hersteller-App pruefen."));
      }, ms);
    })]).finally(() => clearTimeout(timer));
  }
  function renderValues(state) {
    const level = state.values?.level ?? null;
    const power = state.values?.power ?? null;
    state.card.querySelector(".reading-value").textContent = level === null ? "\u2014" : level.toLocaleString("de-DE") + " %";
    renderMeasurementVisual(state.card, state.display.type, level);
    const powerOutput = state.card.querySelector("dd");
    if (powerOutput) {
      // Snettbox reports negative battery power while charging (verified against rising SoC/voltage and the app).
      powerOutput.textContent = power === null ? "\u2014" : Math.abs(power).toLocaleString("de-DE") + " W" +
        (power < 0 ? " (laedt)" : power > 0 ? " (entlaedt)" : "");
    }
  }
  function clearValues(state) {
    state.values = null;
    renderValues(state);
  }
  function showValues(state, values) {
    state.values = {...values, time:Date.now()};
    renderValues(state);
    update(state);
  }
  function applySnettbox(state, text) {
    let message;
    try { message = JSON.parse(text); } catch { return; }
    const root = message.SBC || message.SB;
    // Only the detailed messages (roughly every few seconds to minutes) carry the 12 V side temperatures.
    const temps = ["Tc", "T12", "T34"].map(key => root?.P?.[key]).filter(value => Number.isFinite(value) && value > -40 && value < 120);
    if (temps.length) {
      temperature = {value:Math.max(...temps), values:temps, time:Date.now()};
      refreshTemperature();
    }
    const battery = root?.B;
    if (!battery) return;
    const values = {...state.values};
    if (Number.isFinite(battery.SoC) && battery.SoC >= 0 && battery.SoC <= 100) values.level = battery.SoC;
    if (Number.isFinite(battery.P)) values.power = battery.P;
    if (values.level !== undefined || values.power !== undefined) showValues(state, values);
  }
  function applyGasolina(state, view) {
    if (!view || view.byteLength < 8 || view.getUint8(0) !== 0x45) return;
    const level = view.getUint16(1) / 10;
    if (level >= 0 && level <= 100) showValues(state, {level:Math.round(level)});
  }
  const adapters = {
    battery:{...snettbox, async start(state, characteristic) {
      const decoder = new TextDecoder();
      let buffer = "";
      state.live.listener = event => {
        buffer += decoder.decode(event.target.value, {stream:true});
        const lines = buffer.split("\r");
        buffer = lines.pop();
        if (buffer.length > 8192) buffer = "";
        for (const line of lines) if (line.trim()) applySnettbox(state, line.trim());
      };
      characteristic.addEventListener("characteristicvaluechanged", state.live.listener);
      await withTimeout(characteristic.startNotifications(), 10000);
    }},
    gas:{...gasolina, async start(state, characteristic) {
      const live = state.live;
      const read = async () => {
        if (live.reading) return;
        live.reading = true;
        try { applyGasolina(state, await withTimeout(characteristic.readValue(), 10000)); }
        catch { /* the next poll retries; a lost connection is reported by gattserverdisconnected */ }
        finally { live.reading = false; }
      };
      await read();
      if (state.live === live) live.timer = setInterval(read, 20000);
    }}
  };
  async function startLive(state) {
    const adapter = adapters[state.display.type];
    if (!adapter) return false;
    let service;
    try { service = await withTimeout(state.device.gatt.getPrimaryService(adapter.service), 10000); }
    catch (error) {
      if (error.name === "NotFoundError") return false;
      if (error.name === "SecurityError") throw new Error("Freigabe fuer den Datendienst fehlt. Bitte Geraet einmal neu auswaehlen.");
      throw error;
    }
    const characteristic = await withTimeout(service.getCharacteristic(adapter.characteristic), 10000);
    state.live = {characteristic, listener:null, timer:null};
    await adapter.start(state, characteristic);
    return true;
  }
  async function connect(state, retry = false) {
    if (state.busy || !state.device || !states.has(state.display.id)) return;
    if (state.pendingConnect) {
      update(state, "Vorheriger Verbindungsversuch laeuft noch. Bitte warten oder Bluetooth im Browser neu starten.");
      return;
    }
    clearRetry(state);
    if (!retry) state.retries = 0;
    state.busy = true;
    const device = state.device;
    const operation = ++state.operation;
    // The gas sensor sits in a shielded gas locker and advertises rarely, so allow it more time.
    const slow = state.display.type === "gas";
    update(state, slow ? "Verbindung wird aufgebaut (bis 45 s)" : "Verbindung wird aufgebaut");
    try {
      const pending = device.gatt.connect();
      state.pendingConnect = pending;
      pending.then(() => {
        state.pendingConnect = null;
        if (operation !== state.operation && device.gatt.connected) device.gatt.disconnect();
      }, () => { state.pendingConnect = null; });
      await withTimeout(pending, slow ? 45000 : 15000, () => { state.operation++; });
      if (operation !== state.operation) return;
      if (!device.gatt.connected) throw new Error("Geraet hat die Verbindung beendet.");
      let live = false;
      try { live = await startLive(state); }
      catch (error) {
        stopLive(state);
        update(state, "Verbunden / Live-Daten nicht verfuegbar: " + errorText(error));
        return;
      }
      if (operation !== state.operation) return;
      update(state, live ? "Verbunden / Live-Daten" : "Verbunden / Datenformat offen");
    } catch (error) {
      update(state, "Verbindungsfehler: " + errorText(error));
    } finally {
      state.busy = false;
      update(state);
    }
  }
  function scheduleRetry(state) {
    if (!state.display.autoConnect || !state.device || state.retries >= 2 || document.hidden) return;
    state.retries++;
    state.retryTimer = setTimeout(() => {
      state.retryTimer = null;
      if (states.has(state.display.id) && state.display.autoConnect && !document.hidden) {
        connect(state, true).then(() => {
          if (!connected(state) && !state.busy) scheduleRetry(state);
        });
      }
    }, state.retries * 3000);
  }
  function addCard(display) {
    const card = $("card-template").content.firstElementChild.cloneNode(true);
    card.classList.add(display.type);
    card.querySelector("h3").textContent = display.name;
    const value = document.createElement("span");
    value.className = "reading-value";
    value.textContent = "\u2014";
    const visual = document.createElement("span");
    visual.className = "measurement-visual";
    visual.setAttribute("role", "img");
    const art = $("visual-" + display.type).content.cloneNode(true);
    // Every card gets its own clip path ids, otherwise several gas cards would share one definition.
    for (const node of art.querySelectorAll("[id]")) {
      const id = node.id + "-" + display.id;
      for (const user of art.querySelectorAll('[clip-path="url(#' + node.id + ')"]')) user.setAttribute("clip-path", "url(#" + id + ")");
      node.id = id;
    }
    visual.append(art);
    card.querySelector(".reading").replaceChildren(visual, value);
    renderMeasurementVisual(card, display.type, null);
    const detail = {battery:"Netto-Lade-/Entladeleistung", temperature:"Einzelwerte (Tc / T12 / T34)"}[display.type];
    if (detail) {
      const row = document.createElement("div");
      const dt = document.createElement("dt");
      dt.textContent = detail;
      const dd = document.createElement("dd");
      dd.textContent = "\u2014";
      row.append(dt, dd);
      const dl = document.createElement("dl");
      dl.append(row);
      card.querySelector(".card-footer").before(dl);
    }
    const state = {display, card, device:null, busy:false, operation:0, retries:0, retryTimer:null, live:null, values:null,
      status:display.deviceId ? "Gespeichert / nicht verbunden" : "Nicht eingerichtet"};
    state.onDisconnect = () => {
      stopLive(state);
      update(state, "Getrennt / keine aktuellen Messwerte");
      scheduleRetry(state);
    };
    states.set(display.id, state);
    const button = card.querySelector(".bluetooth-button");
    button.hidden = display.type === "temperature";
    button.setAttribute("aria-label", "Bluetooth-Geraet fuer " + display.name + " verwalten");
    button.addEventListener("click", () => {
      selectedId = display.id;
      $("device-dialog-title").textContent = state.display.name + " / Bluetooth";
      update(state);
      $("device-dialog").showModal();
    });
    const remove = card.querySelector(".remove-display");
    remove.setAttribute("aria-label", display.name + ": Anzeige entfernen");
    remove.addEventListener("click", () => {
      if (state.busy) { report("Bitte den laufenden Bluetooth-Vorgang vor dem Entfernen abwarten."); return; }
      if (!confirm('Anzeige "' + state.display.name + '" wirklich entfernen?')) return;
      if (!save(displays.filter(item => item.id !== display.id))) return;
      state.operation++;
      release(state);
      states.delete(display.id);
      updateCamper();
      refreshTemperature();
      card.remove();
      $("add-display").focus();
    });
    document.querySelector(".cards").append(card);
    update(state);
  }
  function showDiagnosis(key, text) {
    diagnosis.set(key, text);
    $("reconnect-diagnosis").textContent = [...diagnosis.values()].join("\n");
  }
  function savedFilters(state) {
    const name = state.display.deviceName;
    return [...new Map([...(name && name !== unnamed ? [{name}] : []),
      ...(knownNames[state.display.type] || [])].map(filter => [JSON.stringify(filter), filter])).values()];
  }
  async function findSavedDevice(state) {
    if (state.device) return true;
    if (typeof bluetooth.getDevices !== "function") {
      showDiagnosis("browser", "getDevices wird von diesem Browser nicht unterstuetzt -> Bestaetigung pro Geraet noetig.");
      return requestSavedDevice(state);
    }
    try {
      const devices = await withTimeout(bluetooth.getDevices(), 10000);
      let device = devices.find(item => item.id === state.display.deviceId);
      let how = "Kennung";
      if (!device) {
        // iOS browsers may hand out a new device ID per session; fall back to the saved/known device name.
        const filters = savedFilters(state);
        const taken = new Set([...states.values()].filter(other => other !== state)
          .flatMap(other => [other.display.deviceId, other.device?.id]).filter(Boolean));
        device = devices.find(item => !taken.has(item.id) && item.name &&
          filters.some(f => f.name === item.name || (f.namePrefix && item.name.startsWith(f.namePrefix))));
        how = "Name";
      }
      showDiagnosis(state.display.id, state.display.name + ": getDevices liefert " + devices.length + " Geraet(e)" +
        (devices.length ? " (" + devices.map(item => item.name || "ohne Namen").join(", ") + ")" : "") +
        " -> " + (device ? "automatisch gefunden ueber " + how : "nicht gefunden, Bestaetigung noetig"));
      if (device) {
        attach(state, device);
        if (device.id !== state.display.deviceId) persistState(state, {deviceId:device.id});
        return true;
      }
    } catch (error) {
      showDiagnosis(state.display.id, state.display.name + ": getDevices-Fehler: " + errorText(error));
    }
    return requestSavedDevice(state);
  }
  // Browsers without persistent permissions (e.g. Bluetooth Browser on iOS) need a new, filtered picker per session.
  async function requestSavedDevice(state) {
    const name = state.display.deviceName;
    const filters = savedFilters(state);
    update(state, "Bitte " + (name || "Geraet") + " in der Bluetooth-Auswahl bestaetigen");
    let device;
    try {
      device = await bluetooth.requestDevice(filters.length ? {filters, optionalServices:services}
        : {acceptAllDevices:true, optionalServices:services});
    } catch (error) {
      if (error.name === "NotFoundError") { update(state, "Auswahl abgebrochen. Zum Verbinden auf den Camper tippen."); return false; }
      if (error.name === "SecurityError" || error.name === "NotAllowedError") {
        needsTap = true;
        update(state, "Zum Verbinden auf den Camper tippen.");
        return false;
      }
      throw error;
    }
    attach(state, device);
    persistState(state, {deviceId:device.id, deviceName:device.name || name});
    return true;
  }
  async function prepareSaved(state, enableAutoConnect = false) {
    if (!state || !states.has(state.display.id) || !state.display.deviceId || state.busy) return false;
    if (state.pendingConnect) {
      update(state, "Vorheriger Verbindungsversuch laeuft noch. Bitte warten oder Bluetooth im Browser neu starten.");
      return false;
    }
    if (enableAutoConnect) persistState(state, {autoConnect:true});
    if (connected(state)) return false;
    clearRetry(state);
    state.busy = true; update(state);
    try { return await findSavedDevice(state); }
    catch (error) { update(state, "Wiederverbindung nicht moeglich: " + errorText(error)); return false; }
    finally { state.busy = false; update(state); }
  }
  // Name filters make browsers check the advertised name; Nuviu omits name-only devices from its "all devices" list.
  async function chooseDevice(all) {
    const state = current();
    if (!state || state.busy || !supported) return;
    const filters = knownNames[state.display.type];
    state.busy = true;
    clearRetry(state);
    update(state, "Bitte Geraet in der Bluetooth-Auswahl waehlen");
    try {
      // requestDevice must run directly inside the click, before awaiting any other work.
      const device = await bluetooth.requestDevice(all || !filters ? {acceptAllDevices:true, optionalServices:services}
        : {filters, optionalServices:services});
      attach(state, device);
      persistState(state, {deviceId:device.id, deviceName:device.name || unnamed, autoConnect:true});
      clearValues(state);
      update(state, "Geraet ausgewaehlt");
    } catch (error) {
      update(state, error.name === "NotFoundError"
        ? "Auswahl abgebrochen oder kein Geraet gefunden" + (all ? "" : ". Sonst \"Alle Geraete anzeigen\" verwenden.")
        : "Geraeteauswahl fehlgeschlagen: " + errorText(error));
      return;
    } finally {
      state.busy = false;
      update(state);
    }
    await connect(state);
  }
  $("choose-device").addEventListener("click", () => chooseDevice(false));
  $("choose-any-device").addEventListener("click", () => chooseDevice(true));
  $("reconnect-device").addEventListener("click", async () => {
    const state = current();
    try { if (await prepareSaved(state, true)) await connect(state); }
    catch (error) { report("Wiederverbindung fehlgeschlagen: " + errorText(error)); }
  });
  $("disconnect-device").addEventListener("click", () => {
    const state = current();
    if (!state || state.busy) return;
    persistState(state, {autoConnect:false});
    state.operation++;
    // Keep the device object so the next camper tap reconnects without a new picker.
    clearRetry(state);
    stopLive(state);
    if (connected(state)) state.device.gatt.disconnect();
    update(state, "Getrennt / automatisch verbinden pausiert");
  });
  $("forget-device").addEventListener("click", () => {
    const state = current();
    if (!state || state.busy || !confirm("Gespeicherte Geraetezuordnung wirklich loeschen?")) return;
    const next = {id:state.display.id, type:state.display.type, name:state.display.name};
    if (!save(displays.map(item => item.id === next.id ? next : item))) return;
    state.display = next;
    state.operation++;
    release(state);
    clearValues(state);
    update(state, "Nicht eingerichtet");
  });
  const camperName = $("camper-name");
  const nameError = text => { $("name-error").textContent = text; $("name-error").hidden = false; };
  try { camperName.value = localStorage.getItem("campblick.camperName") || "FIETE"; }
  catch (error) { nameError("Name nicht geladen: " + errorText(error)); }
  camperName.addEventListener("change", () => {
    const name = camperName.value.trim();
    if (!name) { nameError("Bitte einen Namen eintragen."); return; }
    try {
      localStorage.setItem("campblick.camperName", name); camperName.value = name; $("name-error").hidden = true;
    } catch (error) { nameError("Name nicht gespeichert: " + errorText(error)); }
  });
  camperName.addEventListener("keydown", event => { if (event.key === "Enter") camperName.blur(); });
  $("add-display").addEventListener("click", () => {
    $("display-form").reset(); $("display-name").setCustomValidity(""); $("add-dialog").showModal();
  });
  $("cancel-display").addEventListener("click", () => $("add-dialog").close());
  $("display-name").addEventListener("input", () => $("display-name").setCustomValidity(""));
  $("display-form").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("display-name").value.trim();
    if (!name) { $("display-name").setCustomValidity("Bitte einen Namen eintragen."); $("display-name").reportValidity(); return; }
    const display = {id:crypto.randomUUID(), type:$("display-type").value, name};
    if (save([...displays, display])) { addCard(display); $("add-dialog").close(); }
  });
  displays.forEach(addCard);
  async function connectAll(manual = false) {
    if (connectingAll) return;
    const status = $("quick-start-status");
    const showStatus = text => { status.textContent = text; status.hidden = false; };
    if (!supported) {
      if (manual) showStatus("Web Bluetooth ist in diesem Browser nicht verfuegbar.");
      return;
    }
    const assigned = [...states.values()].filter(state => state.display.deviceId && (manual || state.display.autoConnect));
    if (!assigned.length) {
      if (manual) showStatus("Bitte zuerst ueber Geraet eine Bluetooth-Zuordnung einrichten.");
      return;
    }
    connectingAll = true;
    needsTap = false;
    updateCamper();
    showStatus("Zugeordnete Bluetooth-Geraete werden verbunden ...");
    try {
      // Confirm all pickers first (they need the user's taps), then connect in parallel so a slow sensor blocks nothing.
      const ready = [];
      for (const state of assigned) {
        if (await prepareSaved(state, manual)) ready.push(state);
      }
      await Promise.all(ready.map(state => connect(state)));
      const remaining = assigned.filter(state => states.has(state.display.id) && state.display.deviceId);
      const count = remaining.filter(connected).length;
      showStatus(!remaining.length ? "Keine zugeordneten Geraete mehr vorhanden."
        : count === remaining.length ? "Alle " + count + " zugeordneten Geraete sind verbunden."
        : count + " von " + remaining.length + " Geraeten verbunden. " +
          (needsTap ? "Zum Verbinden der uebrigen auf den Camper tippen." : "Details unter Geraet."));
    } finally {
      connectingAll = false;
      updateCamper();
    }
  }
  $("connect-all").addEventListener("click", () => {
    connectAll(true).catch(error => report("Quick-Start fehlgeschlagen: " + errorText(error)));
  });
  // Back in the foreground: reconnect devices already approved in this session; no picker, so no tap is needed.
  let resumeTimer = null;
  function resumeConnections(source) {
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => {
      if (document.hidden || connectingAll) return;
      const waiting = [...states.values()].filter(state => state.device && state.display.autoConnect &&
        !connected(state) && !state.busy && !state.pendingConnect);
      if (!waiting.length) return;
      showDiagnosis("resume", "Zurueck im Vordergrund (" + source + "): " + waiting.length + " Geraet(e) werden ohne Auswahl neu verbunden.");
      waiting.forEach(state => connect(state));
    }, 800);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) resumeConnections("Seite sichtbar"); });
  if (supported && typeof bluetooth.addEventListener === "function") {
    bluetooth.addEventListener("backgroundstatechanged", event => {
      // Bluefy-specific event; its payload is undocumented, so a value of true is read as "went to background".
      const background = event?.isInBackground ?? event?.background ?? event?.value ?? event?.detail;
      if (background !== true) resumeConnections("Bluefy");
    });
  }
  $("environment-status").textContent = !supported
    ? "Web Bluetooth ist in diesem Kontext nicht verfuegbar. Einen kompatiblen Bluetooth-Browser verwenden."
    : "Snettbox: Ladestand und Leistung live. Temperatur: hoechster der drei Sensoren auf der 12-V-Seite der Snettbox (Tc, T12, T34); wird nur mit den ausfuehrlichen Snettbox-Meldungen aktualisiert, daher die Zeitangabe \"Stand\". Gasolina (\"UTS Tank Sensor\"): Fuellstand alle 20 Sekunden, mit der App abgeglichen (39 %). SC330: Datenformat noch offen. Hersteller-Apps vorher schliessen, da die Geraete meist nur eine Verbindung gleichzeitig erlauben. Kommt der Browser wieder in den Vordergrund, verbinden sich bereits bestaetigte Geraete automatisch neu.";
  // No automatic pickers on open: everything starts with one tap on the camper.
  if (bluetoothAvailable === null) {
    bluetooth.getAvailability().then(available => { bluetoothAvailable = available; }, () => { bluetoothAvailable = true; })
      .finally(updateCamper);
    bluetooth.addEventListener?.("availabilitychanged", event => { bluetoothAvailable = !!event.value; updateCamper(); });
  }
  updateCamper();
})();
