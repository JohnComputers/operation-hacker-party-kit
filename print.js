(() => {
  "use strict";

  const CONFIG_KEY = "ghostParcel.hostConfig.v1";
  const DEFAULT_RECIPIENT = "The celebration";
  const recipientInput = document.querySelector("#print-recipient");
  const teamCountInput = document.querySelector("#print-team-count");
  const printButton = document.querySelector("[data-print-button]");
  const pageCount = document.querySelector("[data-page-count]");

  function readConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeConfig(patch) {
    const config = { ...readConfig(), ...patch };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      // Printing still works if storage is unavailable.
    }
    return config;
  }

  function cleanRecipient(value) {
    const normalized = String(value || "").replace(/\s+/g, " ").trim();
    return normalized || DEFAULT_RECIPIENT;
  }

  function applyRecipient(value) {
    const recipient = cleanRecipient(value);
    document.querySelectorAll("[data-recipient], [data-celebration-footer]").forEach((element) => {
      element.textContent = recipient;
    });
  }

  function applyTeamCount(value) {
    const teamCount = String(value) === "2" ? "2" : "3";
    const twoTeams = teamCount === "2";
    document.querySelectorAll('[data-team="bolt"]').forEach((element) => {
      element.hidden = twoTeams;
    });
    document.documentElement.dataset.teamCount = teamCount;
    pageCount.textContent = `2 US Letter pages / ${teamCount} teams`;
    printButton.textContent = `Print 2-page kit`;
    return teamCount;
  }

  function loadControls() {
    const config = readConfig();
    const recipient = cleanRecipient(config.celebrationName || config.recipientName);
    const teamCount = String(config.teamCount) === "2" ? "2" : "3";
    recipientInput.value = recipient === DEFAULT_RECIPIENT ? "" : recipient;
    teamCountInput.value = teamCount;
    applyRecipient(recipient);
    applyTeamCount(teamCount);
  }

  recipientInput.addEventListener("input", () => {
    applyRecipient(recipientInput.value);
    writeConfig({ celebrationName: recipientInput.value.trim() });
  });

  recipientInput.addEventListener("blur", () => {
    const recipient = cleanRecipient(recipientInput.value);
    recipientInput.value = recipient === DEFAULT_RECIPIENT ? "" : recipient;
    applyRecipient(recipient);
    writeConfig({ celebrationName: recipientInput.value });
  });

  teamCountInput.addEventListener("change", () => {
    const teamCount = applyTeamCount(teamCountInput.value);
    writeConfig({ teamCount: Number(teamCount) });
  });

  printButton.addEventListener("click", () => {
    applyRecipient(recipientInput.value);
    applyTeamCount(teamCountInput.value);
    window.print();
  });

  window.addEventListener("beforeprint", () => {
    applyRecipient(recipientInput.value);
    applyTeamCount(teamCountInput.value);
  });

  window.addEventListener("storage", (event) => {
    if (event.key === CONFIG_KEY) loadControls();
  });

  loadControls();
})();
