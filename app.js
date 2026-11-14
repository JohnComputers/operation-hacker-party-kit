(() => {
  "use strict";

  const CONFIG_KEY = "ghostParcel.hostConfig.v1";
  const GAME_KEY = "ghostParcel.gameState.v1";
  const CONFIG_VERSION = 1;
  const GAME_VERSION = 1;

  const DEFAULT_CONFIG = Object.freeze({
    version: CONFIG_VERSION,
    celebrationName: "the celebration",
    prizeLocation: "outside, under the table",
    teamCount: 3,
    photos: Object.freeze({ a: null, b: null, c: null }),
  });

  const ROUTES = Object.freeze({
    hawk: Object.freeze({
      key: "hawk",
      name: "Hawk",
      tracking: "GP1201",
      parcel: "H714",
      pin: "4628",
      word: "NORTH",
      photo: "a",
    }),
    wolf: Object.freeze({
      key: "wolf",
      name: "Wolf",
      tracking: "GP1202",
      parcel: "W381",
      pin: "7193",
      word: "SOUTH",
      photo: "b",
    }),
    bolt: Object.freeze({
      key: "bolt",
      name: "Bolt",
      tracking: "GP1203",
      parcel: "B526",
      pin: "2815",
      word: "RADAR",
      photo: "c",
    }),
  });

  const SCENES = Object.freeze({
    a: Object.freeze({
      key: "a",
      delivery: "Delivery A",
      place: "chair",
      source: "assets/delivery-chair.svg",
      alt: "Delivery A evidence illustration showing a chair and a parcel marker",
    }),
    b: Object.freeze({
      key: "b",
      delivery: "Delivery B",
      place: "planter",
      source: "assets/delivery-planter.svg",
      alt: "Delivery B evidence illustration showing a planter and a parcel marker",
    }),
    c: Object.freeze({
      key: "c",
      delivery: "Delivery C",
      place: "mat",
      source: "assets/delivery-mat.svg",
      alt: "Delivery C evidence illustration showing a door mat and a parcel marker",
    }),
  });

  const DEFAULT_GAME = Object.freeze({
    version: GAME_VERSION,
    step: 0,
    teamKey: null,
    photoMatched: false,
    attempts: Object.freeze({ pin: 0, photo: 0, word: 0 }),
  });

  const stage = document.querySelector("[data-game-stage]");
  const progressItems = Array.from(document.querySelectorAll("[data-game-progress] [data-step]"));
  const restartButton = document.querySelector("[data-restart]");
  const settingsForm = document.querySelector("[data-settings-form]");
  const settingsStatus = document.querySelector("[data-settings-status]");
  const imageDialog = document.querySelector("[data-image-dialog]");
  const dialogImage = document.querySelector("[data-dialog-image]");
  const dialogCaption = document.querySelector("[data-dialog-caption]");

  let config = loadConfig();
  let game = loadGame(config);
  let pendingPhotos = { ...config.photos };
  const pendingUploads = new Set();

  document.documentElement.classList.add("js");

  function make(tagName, className, text) {
    const element = document.createElement(tagName);
    if (className) element.className = className;
    if (text !== undefined && text !== null) element.textContent = String(text);
    return element;
  }

  function append(parent, ...children) {
    for (const child of children.flat()) {
      if (child) parent.append(child);
    }
    return parent;
  }

  function makeButton(text, className = "button button-primary") {
    const button = make("button", className, text);
    button.type = "button";
    return button;
  }

  function cloneDefaultConfig() {
    return {
      version: CONFIG_VERSION,
      celebrationName: DEFAULT_CONFIG.celebrationName,
      prizeLocation: DEFAULT_CONFIG.prizeLocation,
      teamCount: DEFAULT_CONFIG.teamCount,
      photos: { a: null, b: null, c: null },
    };
  }

  function cloneDefaultGame() {
    return {
      version: GAME_VERSION,
      step: 0,
      teamKey: null,
      photoMatched: false,
      attempts: { pin: 0, photo: 0, word: 0 },
    };
  }

  function cleanText(value, fallback, maximumLength) {
    if (typeof value !== "string") return fallback;
    const cleaned = value
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximumLength);
    return cleaned || fallback;
  }

  function isAllowedPhoto(value) {
    if (value === null || value === "" || value === undefined) return true;
    if (typeof value !== "string" || value.length > 1500000) return false;
    return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value);
  }

  function normalizeConfig(value, strict = false) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      if (strict) throw new Error("The file does not contain a Ghost Parcel setup.");
      return cloneDefaultConfig();
    }

    if (strict && value.version !== CONFIG_VERSION) {
      throw new Error("This setup file uses an unsupported version.");
    }

    const rawTeamCount = Number(value.teamCount);
    if (strict && rawTeamCount !== 2 && rawTeamCount !== 3) {
      throw new Error("Active teams must be set to 2 or 3.");
    }

    if (strict && typeof value.celebrationName !== "string") {
      throw new Error("The celebration name is missing.");
    }
    if (strict && typeof value.prizeLocation !== "string") {
      throw new Error("The final hiding place is missing.");
    }
    if (strict && (!value.celebrationName.trim() || value.celebrationName.trim().length > 40)) {
      throw new Error("The celebration name must contain 1 to 40 characters.");
    }
    if (strict && (!value.prizeLocation.trim() || value.prizeLocation.trim().length > 90)) {
      throw new Error("The final hiding place must contain 1 to 90 characters.");
    }

    const rawPhotos = value.photos && typeof value.photos === "object" ? value.photos : {};
    const photos = { a: null, b: null, c: null };
    let photoCharacters = 0;

    for (const key of Object.keys(photos)) {
      const candidate = rawPhotos[key] ?? null;
      if (!isAllowedPhoto(candidate)) {
        if (strict) throw new Error(`The ${key.toUpperCase()} evidence photo is not a supported local image.`);
        continue;
      }
      photos[key] = candidate || null;
      photoCharacters += photos[key] ? photos[key].length : 0;
    }

    if (strict && photoCharacters > 4200000) {
      throw new Error("The setup contains too much image data for browser storage.");
    }

    return {
      version: CONFIG_VERSION,
      celebrationName: cleanText(value.celebrationName, DEFAULT_CONFIG.celebrationName, 40),
      prizeLocation: cleanText(value.prizeLocation, DEFAULT_CONFIG.prizeLocation, 90),
      teamCount: rawTeamCount === 2 ? 2 : 3,
      photos,
    };
  }

  function activeRouteKeys(forConfig = config) {
    return forConfig.teamCount === 2 ? ["hawk", "wolf"] : ["hawk", "wolf", "bolt"];
  }

  function normalizeGame(value, forConfig = config) {
    const fresh = cloneDefaultGame();
    if (!value || typeof value !== "object" || Array.isArray(value)) return fresh;

    const step = Number(value.step);
    const teamKey = typeof value.teamKey === "string" ? value.teamKey.toLowerCase() : null;
    if (!Number.isInteger(step) || step < 0 || step > 5) return fresh;
    if (step > 0 && (!teamKey || !activeRouteKeys(forConfig).includes(teamKey))) return fresh;
    if (teamKey && !activeRouteKeys(forConfig).includes(teamKey)) return fresh;

    const attempts = value.attempts && typeof value.attempts === "object" ? value.attempts : {};
    return {
      version: GAME_VERSION,
      step,
      teamKey,
      photoMatched: step === 3 && Boolean(value.photoMatched),
      attempts: {
        pin: safeAttemptNumber(attempts.pin),
        photo: safeAttemptNumber(attempts.photo),
        word: safeAttemptNumber(attempts.word),
      },
    };
  }

  function safeAttemptNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number < 1000 ? number : 0;
  }

  function loadConfig() {
    try {
      const saved = localStorage.getItem(CONFIG_KEY);
      return saved ? normalizeConfig(JSON.parse(saved)) : cloneDefaultConfig();
    } catch (error) {
      console.warn("Ghost Parcel could not read its local setup.", error);
      return cloneDefaultConfig();
    }
  }

  function loadGame(forConfig) {
    try {
      const saved = sessionStorage.getItem(GAME_KEY);
      return saved ? normalizeGame(JSON.parse(saved), forConfig) : cloneDefaultGame();
    } catch (error) {
      console.warn("Ghost Parcel could not restore mission progress.", error);
      return cloneDefaultGame();
    }
  }

  function saveGame() {
    try {
      sessionStorage.setItem(GAME_KEY, JSON.stringify(game));
      return true;
    } catch (error) {
      console.warn("Ghost Parcel could not save mission progress.", error);
      return false;
    }
  }

  function storeConfig(candidate) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(candidate));
      return { saved: true, message: "" };
    } catch (error) {
      const isQuotaError =
        error &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
          error.code === 22 ||
          error.code === 1014);
      return {
        saved: false,
        message: isQuotaError
          ? "Setup is active in this tab, but the photos are too large for browser storage. Use built-in images or smaller photos before reloading."
          : "Setup is active in this tab, but this browser blocked local storage. It will be lost when the page closes.",
      };
    }
  }

  function setSettingsStatus(message, kind = "") {
    if (!settingsStatus) return;
    settingsStatus.textContent = message;
    settingsStatus.classList.toggle("is-error", kind === "error");
    settingsStatus.classList.toggle("is-success", kind === "success");
  }

  function setTerminalMessage(element, message, kind = "") {
    element.textContent = message;
    element.classList.toggle("is-error", kind === "error");
    element.classList.toggle("is-success", kind === "success");
    if (kind === "error") element.setAttribute("role", "alert");
    else element.setAttribute("role", "status");
  }

  function updateProgress() {
    for (const item of progressItems) {
      const index = Number(item.dataset.step);
      const isActive = index === game.step;
      item.classList.toggle("is-active", isActive);
      item.classList.toggle("is-complete", index < game.step);
      if (isActive) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    }
    if (restartButton) restartButton.hidden = game.step === 0 && !game.teamKey;
  }

  function moveTo(stepNumber, updates = {}) {
    game = normalizeGame({ ...game, ...updates, step: stepNumber }, config);
    saveGame();
    renderGame(true);
  }

  function resetGame(askFirst = true) {
    if (askFirst && game.step > 0) {
      const confirmed = window.confirm("Restart this mission on this device? Current progress will be cleared.");
      if (!confirmed) return;
    }
    game = cloneDefaultGame();
    try {
      sessionStorage.removeItem(GAME_KEY);
    } catch (error) {
      console.warn("Ghost Parcel could not clear saved mission progress.", error);
    }
    renderGame(true);
  }

  function createTerminalIntro(labelText, headingText, bodyText) {
    const card = make("div", "terminal-card");
    const label = make("p", "terminal-label", labelText);
    const heading = make("h3", "terminal-title", headingText);
    append(card, label, heading);
    if (bodyText) card.append(make("p", "terminal-copy", bodyText));
    return card;
  }

  function createField(labelText, input) {
    const wrapper = make("label", "terminal-field");
    const label = make("span", "terminal-field-label", labelText);
    append(wrapper, label, input);
    return wrapper;
  }

  function createTerminalForm() {
    const form = make("form", "terminal-form");
    form.noValidate = true;
    return form;
  }

  function createTerminalMessage() {
    const message = make("p", "terminal-message");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    return message;
  }

  function renderTrackScreen() {
    const card = createTerminalIntro(
      "Screen 01 / Track a parcel",
      "Ghost Parcel Service",
      "Enter the tracking number printed on your team's customer receipt."
    );
    const form = createTerminalForm();
    const input = make("input", "terminal-input terminal-input-code");
    input.id = "mission-tracking";
    input.name = "tracking";
    input.type = "text";
    input.inputMode = "text";
    input.autocomplete = "off";
    input.autocapitalize = "characters";
    input.spellcheck = false;
    input.maxLength = 12;
    input.placeholder = "GP____";
    input.setAttribute("aria-describedby", "tracking-help");

    const help = make("p", "terminal-help", "Use a fictional Ghost Parcel number only.");
    help.id = "tracking-help";
    const submit = makeButton("Track parcel", "button button-primary terminal-submit");
    submit.type = "submit";
    const message = createTerminalMessage();

    append(form, createField("Tracking number", input), help, submit, message);
    card.append(form);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim().toUpperCase().replace(/\s+/g, "");
      const route = Object.values(ROUTES).find((candidate) => candidate.tracking === value);
      if (!route) {
        setTerminalMessage(message, "Tracking number not found. Check every letter and digit on the receipt.", "error");
        input.focus();
        input.select();
        return;
      }
      if (!activeRouteKeys().includes(route.key)) {
        setTerminalMessage(message, `${route.name} is not active in this host setup. Ask the host which receipt to use.`, "error");
        input.focus();
        input.select();
        return;
      }
      game = {
        ...cloneDefaultGame(),
        step: 1,
        teamKey: route.key,
      };
      saveGame();
      renderGame(true);
    });

    return card;
  }

  function renderInterceptScreen(route) {
    const card = createTerminalIntro(
      "Screen 02 / Delivery intercepted",
      "Delivery location deleted",
      `Tracking ${route.tracking} was delivered. Signed for by Ghost.`
    );
    card.classList.add("terminal-card-alert");
    const notice = make("div", "ghost-message");
    notice.setAttribute("aria-label", "Message from Ghost");
    append(
      notice,
      make("p", "terminal-label", "Incoming message / Ghost"),
      make("blockquote", "ghost-quote", "Looking for the goods? I erased the address. Let's see who can get it back.")
    );
    const button = makeButton("Recover delivery record", "button button-primary terminal-submit");
    button.addEventListener("click", () => moveTo(2));
    append(card, notice, button);
    return card;
  }

  function renderPinScreen(route) {
    const card = createTerminalIntro(
      "Screen 03 / Driver portal",
      "Driver verification required",
      `Route ${route.tracking} is locked. Enter the four-digit driver PIN.`
    );
    const form = createTerminalForm();
    const input = make("input", "terminal-input terminal-input-pin");
    input.id = "mission-pin";
    input.name = "pin";
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.maxLength = 4;
    input.pattern = "[0-9]{4}";
    input.placeholder = "0000";

    const submit = makeButton("Unlock archive", "button button-primary terminal-submit");
    submit.type = "submit";
    const forgot = makeButton("Forgot PIN?", "text-button terminal-forgot");
    forgot.setAttribute("aria-expanded", "false");
    forgot.setAttribute("aria-controls", "pin-clue");
    const clue = make("div", "terminal-clue");
    clue.id = "pin-clue";
    clue.hidden = true;
    append(
      clue,
      make("p", "terminal-label", "Recovery clue"),
      make("p", "", "Unfold your receipt. Find the arrow beneath the barcode. Start there and read the four digits in that direction.")
    );
    const message = createTerminalMessage();

    forgot.addEventListener("click", () => {
      clue.hidden = !clue.hidden;
      forgot.setAttribute("aria-expanded", String(!clue.hidden));
      if (!clue.hidden) clue.focus?.();
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!/^\d{4}$/.test(value)) {
        setTerminalMessage(message, "Enter exactly four digits.", "error");
        input.focus();
        input.select();
        return;
      }
      if (value !== route.pin) {
        game.attempts.pin += 1;
        saveGame();
        setTerminalMessage(message, "PIN rejected. Recheck the arrow direction on the unfolded receipt and try again.", "error");
        input.focus();
        input.select();
        return;
      }
      moveTo(3, { photoMatched: false });
    });

    append(form, createField("Four-digit PIN", input), submit, forgot, clue, message);
    card.append(form);
    return card;
  }

  function sceneSource(sceneKey) {
    return config.photos[sceneKey] || SCENES[sceneKey].source;
  }

  function openImageDialog(sceneKey) {
    if (!imageDialog || !dialogImage || !dialogCaption) return;
    const scene = SCENES[sceneKey];
    dialogImage.src = sceneSource(sceneKey);
    dialogImage.alt = scene.alt;
    dialogCaption.textContent = `${scene.delivery} / evidence archive`;
    if (typeof imageDialog.showModal === "function") imageDialog.showModal();
    else imageDialog.setAttribute("open", "");
  }

  function renderMatchedPhotoScreen(route) {
    const card = createTerminalIntro(
      "Screen 04 / Archive match",
      "Parcel match confirmed",
      `${route.name} parcel ${route.parcel} matches ${SCENES[route.photo].delivery}.`
    );
    card.classList.add("terminal-card-success");
    const instruction = make("div", "match-instruction");
    append(
      instruction,
      make("p", "terminal-label", "Field instruction"),
      make("p", "match-copy", "Find this spot in the search area. Open only your team's envelope and bring it back to your laptop.")
    );
    const continueButton = makeButton("Envelope recovered - continue", "button button-primary terminal-submit");
    continueButton.addEventListener("click", () => moveTo(4, { photoMatched: false }));
    append(card, instruction, continueButton);
    return card;
  }

  function renderPhotoScreen(route) {
    if (game.photoMatched) return renderMatchedPhotoScreen(route);

    const card = createTerminalIntro(
      "Screen 04 / Photo archive",
      "Match the parcel ID",
      `Inspect each delivery image. Select the one containing parcel ID ${route.parcel}.`
    );
    const grid = make("div", "photo-grid");
    const message = createTerminalMessage();

    for (const scene of Object.values(SCENES)) {
      const article = make("article", "photo-card");
      const frame = make("div", "photo-frame");
      const image = make("img", "photo-image");
      image.src = sceneSource(scene.key);
      image.alt = scene.alt;
      image.loading = "lazy";
      image.decoding = "async";
      const heading = make("h4", "photo-title", scene.delivery);
      const meta = make("p", "photo-meta", "Evidence image / tap to inspect");
      const actions = make("div", "photo-actions");
      const select = makeButton(`Select ${scene.delivery}`, "button button-small photo-select");
      const zoom = makeButton("Zoom", "text-button photo-zoom");
      select.dataset.photoChoice = scene.key;
      zoom.dataset.photoZoom = scene.key;

      zoom.addEventListener("click", () => openImageDialog(scene.key));
      select.addEventListener("click", () => {
        if (scene.key !== route.photo) {
          game.attempts.photo += 1;
          saveGame();
          setTerminalMessage(message, "That image does not match every character in your parcel ID. Look again.", "error");
          return;
        }
        game.photoMatched = true;
        saveGame();
        renderGame(true);
      });

      append(frame, image);
      append(actions, select, zoom);
      append(article, frame, heading, meta, actions);
      grid.append(article);
    }

    append(card, grid, message);
    return card;
  }

  function normalizePuzzleWord(value) {
    return value.replace(/\s+/g, "").toUpperCase();
  }

  function renderRestoreScreen(route) {
    const card = createTerminalIntro(
      "Screen 05 / Restore location",
      "Repair the backup label",
      "Fit the five pieces together so the diagonal line runs from corner to corner. Enter the repaired word."
    );
    const form = createTerminalForm();
    const input = make("input", "terminal-input terminal-input-code");
    input.id = "mission-word";
    input.name = "word";
    input.type = "text";
    input.autocomplete = "off";
    input.autocapitalize = "characters";
    input.spellcheck = false;
    input.maxLength = 20;
    input.placeholder = "_ _ _ _ _";

    const submit = makeButton("Restore location", "button button-primary terminal-submit");
    submit.type = "submit";
    const message = createTerminalMessage();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = normalizePuzzleWord(input.value);
      if (!value) {
        setTerminalMessage(message, "Enter the word from the repaired label.", "error");
        input.focus();
        return;
      }
      if (value !== route.word) {
        game.attempts.word += 1;
        saveGame();
        setTerminalMessage(message, "Location word rejected. Check the outside edges and diagonal line, then try again.", "error");
        input.focus();
        input.select();
        return;
      }
      moveTo(5);
    });

    append(form, createField("Recovered word", input), submit, message);
    card.append(form);
    return card;
  }

  function sentenceWithPeriod(value) {
    return /[.!?]$/.test(value) ? value : `${value}.`;
  }

  function renderGrantedScreen(route) {
    const card = createTerminalIntro("Screen 06 / Mission complete", "Access granted");
    card.classList.add("terminal-card-granted");
    card.setAttribute("aria-live", "assertive");

    const team = make("p", "granted-team", `Team ${route.name}`);
    const celebration = make("p", "granted-celebration", `Delivery recovered for ${config.celebrationName}.`);
    const reveal = make("div", "location-reveal");
    append(
      reveal,
      make("p", "terminal-label", "Recovered destination"),
      make("p", "location-copy", `Ghost hid the goods ${sentenceWithPeriod(config.prizeLocation)}`)
    );
    const instruction = make(
      "p",
      "terminal-copy granted-instruction",
      "Raise your hands, leave this screen visible, and wait for the host."
    );
    const again = makeButton("Restart this device", "button button-small granted-restart");
    again.addEventListener("click", () => resetGame(true));

    const celebrationBits = make("div", "celebration-bits");
    celebrationBits.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 12; index += 1) celebrationBits.append(make("span", ""));

    append(card, celebrationBits, team, celebration, reveal, instruction, again);
    return card;
  }

  function renderGame(shouldFocus = false) {
    if (!stage) return;
    game = normalizeGame(game, config);
    updateProgress();
    stage.setAttribute("aria-live", "polite");
    stage.setAttribute("aria-atomic", "true");

    let screen;
    const route = game.teamKey ? ROUTES[game.teamKey] : null;
    if (game.step === 0 || !route) screen = renderTrackScreen();
    else if (game.step === 1) screen = renderInterceptScreen(route);
    else if (game.step === 2) screen = renderPinScreen(route);
    else if (game.step === 3) screen = renderPhotoScreen(route);
    else if (game.step === 4) screen = renderRestoreScreen(route);
    else screen = renderGrantedScreen(route);

    stage.replaceChildren(screen);
    if (shouldFocus) {
      window.requestAnimationFrame(() => {
        stage.focus({ preventScroll: true });
      });
    }
  }

  function fillSettingsForm() {
    if (!settingsForm) return;
    settingsForm.elements.celebrationName.value = config.celebrationName;
    settingsForm.elements.prizeLocation.value = config.prizeLocation;
    settingsForm.elements.teamCount.value = String(config.teamCount);
    updatePhotoFieldStates();
  }

  function updatePhotoFieldStates() {
    if (!settingsForm) return;
    for (const input of settingsForm.querySelectorAll("[data-scene-upload]")) {
      const key = input.dataset.sceneUpload;
      const label = input.closest("label");
      if (!label) continue;
      let note = label.querySelector("[data-photo-state]");
      if (!note) {
        note = make("small", "file-state");
        note.dataset.photoState = "";
        label.append(note);
      }
      note.textContent = pendingUploads.has(key)
        ? "Optimizing..."
        : pendingPhotos[key]
          ? "Custom photo ready"
          : "Using built-in image";
    }

    const submit = settingsForm.querySelector('button[type="submit"]');
    if (submit) submit.disabled = pendingUploads.size > 0;
  }

  function updateBriefing() {
    const briefing = document.querySelector("[data-briefing-copy]");
    if (!briefing) return;
    briefing.textContent = `“Agents, Ghost signed for a delivery meant for ${config.celebrationName} and erased the address. Each team has a shipping receipt and a laptop. Search the porch only when your screen gives you a location. Bring back only your team's envelope. Keep your answers quiet. When your screen says ACCESS GRANTED, raise your hands, leave it on screen, and wait for me. Turn over your receipts. Your mission starts now.”`;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("The selected image could not be opened."));
      };
      image.src = objectUrl;
    });
  }

  function drawResizedImage(image, maximumDimension) {
    const naturalWidth = image.naturalWidth || image.width;
    const naturalHeight = image.naturalHeight || image.height;
    const scale = Math.min(1, maximumDimension / Math.max(naturalWidth, naturalHeight));
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser cannot prepare the image.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return canvas;
  }

  function encodeCanvas(canvas, targetCharacters = 900000) {
    const webpTest = canvas.toDataURL("image/webp", 0.8);
    const mimeType = webpTest.startsWith("data:image/webp") ? "image/webp" : "image/jpeg";
    const qualities = [0.82, 0.74, 0.66, 0.58, 0.5];
    let result = webpTest;
    for (const quality of qualities) {
      result = canvas.toDataURL(mimeType, quality);
      if (result.length <= targetCharacters) break;
    }
    return result;
  }

  async function compressImage(file) {
    if (!file || !file.type.startsWith("image/")) {
      throw new Error("Choose a JPEG, PNG, WebP, HEIC, or another image file your browser can open.");
    }
    if (file.size > 20 * 1024 * 1024) {
      throw new Error("That photo is larger than 20 MB. Choose a smaller image.");
    }

    const image = await loadImageFromFile(file);
    let canvas = drawResizedImage(image, 1200);
    let result = encodeCanvas(canvas);
    if (result.length > 1000000) {
      canvas = drawResizedImage(image, 900);
      result = encodeCanvas(canvas, 750000);
    }
    if (!isAllowedPhoto(result)) {
      throw new Error("The optimized image is still too large. Choose a smaller photo.");
    }
    return result;
  }

  function installPhotoResetButton() {
    if (!settingsForm) return;
    const fieldset = settingsForm.querySelector(".photo-fields");
    if (!fieldset || fieldset.querySelector("[data-clear-photos]")) return;
    const button = makeButton("Use all built-in images", "text-button clear-photos");
    button.dataset.clearPhotos = "";
    button.addEventListener("click", () => {
      pendingPhotos = { a: null, b: null, c: null };
      for (const input of settingsForm.querySelectorAll("[data-scene-upload]")) input.value = "";
      updatePhotoFieldStates();
      setSettingsStatus("Built-in evidence images selected. Choose Save setup to keep this change.");
    });
    fieldset.append(button);
  }

  function installSettings() {
    if (!settingsForm) return;
    fillSettingsForm();
    installPhotoResetButton();

    for (const input of settingsForm.querySelectorAll("[data-scene-upload]")) {
      input.addEventListener("change", async () => {
        const key = input.dataset.sceneUpload;
        const file = input.files && input.files[0];
        if (!file) return;
        pendingUploads.add(key);
        updatePhotoFieldStates();
        setSettingsStatus(`Optimizing ${SCENES[key].delivery} on this device...`);
        try {
          pendingPhotos[key] = await compressImage(file);
          setSettingsStatus(`${SCENES[key].delivery} is ready. Choose Save setup to keep it.`, "success");
        } catch (error) {
          input.value = "";
          setSettingsStatus(error.message || "That image could not be prepared.", "error");
        } finally {
          pendingUploads.delete(key);
          updatePhotoFieldStates();
        }
      });
    }

    settingsForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (pendingUploads.size) {
        setSettingsStatus("Wait for the evidence photos to finish optimizing.", "error");
        return;
      }
      const candidate = normalizeConfig({
        version: CONFIG_VERSION,
        celebrationName: settingsForm.elements.celebrationName.value,
        prizeLocation: settingsForm.elements.prizeLocation.value,
        teamCount: Number(settingsForm.elements.teamCount.value),
        photos: { ...pendingPhotos },
      });
      const result = storeConfig(candidate);
      config = candidate;
      pendingPhotos = { ...config.photos };
      const normalizedGame = normalizeGame(game, config);
      const gameWasReset = game.teamKey && !normalizedGame.teamKey;
      game = normalizedGame;
      saveGame();
      fillSettingsForm();
      updateBriefing();
      renderGame(false);
      if (result.saved) {
        setSettingsStatus(gameWasReset ? "Setup saved. The inactive team mission was reset." : "Setup saved on this browser.", "success");
      } else {
        setSettingsStatus(result.message, "error");
      }
    });

    const exportButton = document.querySelector("[data-export-settings]");
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        const payload = JSON.stringify(config, null, 2);
        const blob = new Blob([payload], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const slug = config.celebrationName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 36) || "party";
        link.href = url;
        link.download = `ghost-parcel-${slug}-setup.json`;
        document.body.append(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setSettingsStatus("Setup exported. Import this file on each team device.", "success");
      });
    }

    const importInput = document.querySelector("[data-import-settings]");
    if (importInput) {
      importInput.addEventListener("change", async () => {
        const file = importInput.files && importInput.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          setSettingsStatus("That setup file is larger than 5 MB and cannot be imported.", "error");
          importInput.value = "";
          return;
        }
        try {
          const parsed = JSON.parse(await file.text());
          const imported = normalizeConfig(parsed, true);
          const result = storeConfig(imported);
          config = imported;
          pendingPhotos = { ...config.photos };
          game = normalizeGame(game, config);
          saveGame();
          fillSettingsForm();
          updateBriefing();
          renderGame(false);
          setSettingsStatus(result.saved ? "Setup imported and saved on this browser." : result.message, result.saved ? "success" : "error");
        } catch (error) {
          setSettingsStatus(error.message || "That file is not a valid Ghost Parcel setup.", "error");
        } finally {
          importInput.value = "";
        }
      });
    }
  }

  async function copyText(value) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textArea = make("textarea", "sr-only");
    textArea.value = value;
    textArea.setAttribute("readonly", "");
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand("copy");
    textArea.remove();
    if (!copied) throw new Error("Copy is unavailable in this browser.");
  }

  function installCopyBriefing() {
    const button = document.querySelector("[data-copy-briefing]");
    const briefing = document.querySelector("[data-briefing-copy]");
    if (!button || !briefing) return;
    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        await copyText(briefing.textContent.trim());
        button.textContent = "Briefing copied";
      } catch (error) {
        button.textContent = "Select and copy the briefing";
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 2200);
    });
  }

  function installNavigation() {
    const header = document.querySelector("[data-site-header]");
    const toggle = document.querySelector("[data-nav-toggle]");
    const nav = document.getElementById("primary-nav");
    if (!header || !toggle || !nav) return;

    const toggleLabel = toggle.querySelector(".sr-only");
    const setOpen = (isOpen) => {
      header.classList.toggle("is-open", isOpen);
      nav.classList.toggle("is-open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
      if (toggleLabel) toggleLabel.textContent = isOpen ? "Close navigation" : "Open navigation";
    };

    toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
    for (const link of nav.querySelectorAll("a")) link.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
        setOpen(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", () => {
      if (window.innerWidth > 800) setOpen(false);
    });
    window.addEventListener(
      "scroll",
      () => header.classList.toggle("is-scrolled", window.scrollY > 12),
      { passive: true }
    );
  }

  function installReveals() {
    const elements = Array.from(document.querySelectorAll(".reveal"));
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      for (const element of elements) element.classList.add("is-visible");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -7% 0px" }
    );
    for (const element of elements) observer.observe(element);
  }

  function installDialog() {
    if (!imageDialog) return;
    const close = imageDialog.querySelector("[data-dialog-close]");
    if (close) close.addEventListener("click", () => imageDialog.close?.() || imageDialog.removeAttribute("open"));
    imageDialog.addEventListener("click", (event) => {
      if (event.target === imageDialog) imageDialog.close?.() || imageDialog.removeAttribute("open");
    });
  }

  if (restartButton) restartButton.addEventListener("click", () => resetGame(true));

  window.addEventListener("storage", (event) => {
    if (event.key !== CONFIG_KEY || !event.newValue) return;
    try {
      config = normalizeConfig(JSON.parse(event.newValue));
      pendingPhotos = { ...config.photos };
      game = normalizeGame(game, config);
      fillSettingsForm();
      updateBriefing();
      renderGame(false);
    } catch (error) {
      console.warn("Ghost Parcel ignored an invalid setup from another tab.", error);
    }
  });

  installNavigation();
  installReveals();
  installDialog();
  installSettings();
  installCopyBriefing();
  updateBriefing();
  renderGame(false);
})();
