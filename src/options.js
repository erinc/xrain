"use strict";

const DEFAULT_SETTINGS = {
  llmEnabled: true,
  llmModel: "gemini-2.5-flash-lite",
  llmTimeoutMs: 8000
};

const DEFAULT_SECRET_SETTINGS = {
  geminiApiKey: "",
  raindropToken: ""
};

const fields = {
  llmEnabled: document.querySelector("#llmEnabled"),
  llmModel: document.querySelector("#llmModel"),
  geminiApiKey: document.querySelector("#geminiApiKey"),
  raindropToken: document.querySelector("#raindropToken"),
  llmTimeoutMs: document.querySelector("#llmTimeoutMs")
};

function load() {
  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    fields.llmEnabled.checked = Boolean(settings.llmEnabled);
    fields.llmModel.value = settings.llmModel;
    fields.llmTimeoutMs.value = settings.llmTimeoutMs;
  });

  chrome.storage.local.get(DEFAULT_SECRET_SETTINGS, (settings) => {
    fields.geminiApiKey.value = settings.geminiApiKey;
    fields.raindropToken.value = settings.raindropToken;
  });
}

function currentSettings() {
  return {
    llmEnabled: fields.llmEnabled.checked,
    llmModel: fields.llmModel.value.trim() || DEFAULT_SETTINGS.llmModel,
    geminiApiKey: fields.geminiApiKey.value.trim(),
    raindropToken: fields.raindropToken.value.trim(),
    llmTimeoutMs: Number(fields.llmTimeoutMs.value) || DEFAULT_SETTINGS.llmTimeoutMs
  };
}

function setStatus(message) {
  document.querySelector("#status").textContent = message;
}

function testModel() {
  setStatus("Checking extension worker...");

  chrome.runtime.sendMessage({ type: "ping" }, (pingResponse) => {
    if (chrome.runtime.lastError) {
      setStatus(`Worker failed: ${chrome.runtime.lastError.message}`);
      return;
    }

    if (!pingResponse?.ok) {
      setStatus("Worker failed: no ping response");
      return;
    }

    setStatus("Testing Gemini...");

    chrome.runtime.sendMessage(
      {
        type: "testLlm",
        settings: currentSettings()
      },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatus(`Test failed: ${chrome.runtime.lastError.message}`);
          return;
        }

        if (!response?.ok) {
          setStatus(`Test failed: ${response?.error || "No response from extension worker"}`);
          return;
        }

        setStatus(`Test passed: ${response.title}`);
      }
    );
  });
}

function checkWorker() {
  chrome.runtime.sendMessage({ type: "ping" }, (_response) => {
    if (chrome.runtime.lastError) {
      setStatus(`Worker failed: ${chrome.runtime.lastError.message}. Reload the extension.`);
    }
  });
}

function save() {
  const settings = currentSettings();
  const { geminiApiKey, raindropToken, ...syncSettings } = settings;

  chrome.storage.sync.set(syncSettings, () => {
    if (chrome.runtime.lastError) {
      setStatus(`Save failed: ${chrome.runtime.lastError.message}`);
      return;
    }

    chrome.storage.local.set({ geminiApiKey, raindropToken }, () => {
      if (chrome.runtime.lastError) {
        setStatus(`Save failed: ${chrome.runtime.lastError.message}`);
        return;
      }

      setStatus("Saved");
      setTimeout(() => {
        setStatus("");
      }, 1400);
    });
  });
}

document.querySelector("#save").addEventListener("click", save);
document.querySelector("#test").addEventListener("click", testModel);
load();
checkWorker();
