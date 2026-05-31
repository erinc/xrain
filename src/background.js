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

function getSyncStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.sync.get(keys, resolve);
  });
}

function getLocalStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, resolve);
  });
}

function withTimeout(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeoutId)
  };
}

function cleanTitle(value) {
  const lines = (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.find((line) => !/^```/.test(line)) || value;

  return title
    .replace(/^(title|bookmark title)\s*:\s*/i, "")
    .replace(/^[-*]\s*/, "")
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractGeminiText(data) {
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("") || "";
}

function responseExcerpt(data) {
  return JSON.stringify(data).replace(/\s+/g, " ").slice(0, 360);
}

async function getSettings() {
  return {
    ...DEFAULT_SETTINGS,
    ...(await getSyncStorage(DEFAULT_SETTINGS)),
    ...(await getLocalStorage(DEFAULT_SECRET_SETTINGS))
  };
}

function geminiUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent`;
}

async function summarizeTweetTitle(tweetText, overrideSettings = null) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(overrideSettings || (await getSettings()))
  };

  if (!settings.llmEnabled || !tweetText) {
    return null;
  }

  if (!settings.geminiApiKey) {
    throw new Error("Gemini API key is required");
  }

  const timeout = withTimeout(Number(settings.llmTimeoutMs) || DEFAULT_SETTINGS.llmTimeoutMs);

  try {
    const response = await fetch(geminiUrl(settings.llmModel), {
      method: "POST",
      signal: timeout.signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.geminiApiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Create a concise Raindrop.io bookmark title for this X post. Return only the title, no quotes, no markdown. Keep it under 90 characters.\n\n${tweetText}`
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 32,
          thinkingConfig: {
            thinkingBudget: 0
          }
        }
      })
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = data ? responseExcerpt(data) : response.statusText;
      throw new Error(
        [`Gemini request failed with HTTP ${response.status}`, detail].filter(Boolean).join(": ")
      );
    }

    const title = cleanTitle(extractGeminiText(data));

    if (!title || title.length < 4) {
      throw new Error(`Gemini response did not include a usable title: ${responseExcerpt(data)}`);
    }

    return title.slice(0, 120);
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error(`Gemini request timed out after ${settings.llmTimeoutMs}ms`);
    }

    throw error;
  } finally {
    timeout.clear();
  }
}

async function handleSummarize(message) {
  try {
    const title = await summarizeTweetTitle(message.tweetText);
    return { title, error: null };
  } catch (error) {
    return { title: null, error: error.message };
  }
}

async function handleTest(message) {
  const settings = {
    ...(await getSettings()),
    ...message.settings
  };
  const title = await summarizeTweetTitle(
    "Open source maintainers are quietly becoming infrastructure operators.",
    settings
  );

  return {
    title,
    model: settings.llmModel
  };
}

async function saveRaindrop(item, overrideSettings = null) {
  const settings = {
    ...(await getSettings()),
    ...(overrideSettings || {})
  };

  if (!settings.raindropToken) {
    throw new Error("Raindrop API token is required");
  }

  const response = await fetch("https://api.raindrop.io/rest/v1/raindrop", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.raindropToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      link: item.link,
      title: item.title,
      excerpt: item.description || "",
      note: item.note || item.description || "",
      tags: item.tags || []
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.result === false) {
    const detail = data ? responseExcerpt(data) : response.statusText;
    throw new Error(
      [`Raindrop save failed with HTTP ${response.status}`, detail].filter(Boolean).join(": ")
    );
  }

  return data;
}

async function handleSaveRaindrop(message) {
  try {
    const data = await saveRaindrop(message.item);
    return { ok: true, id: data?.item?._id || null };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  try {
    if (message?.type === "ping") {
      sendResponse({ ok: true });
      return false;
    }

    if (message?.type === "summarizeTweetTitle") {
      handleSummarize(message).then(sendResponse);
      return true;
    }

    if (message?.type === "testLlm") {
      handleTest(message)
        .then((result) => {
          sendResponse({ ok: true, ...result });
        })
        .catch((error) => {
          sendResponse({ ok: false, error: error.message });
        });
      return true;
    }

    if (message?.type === "saveRaindrop") {
      handleSaveRaindrop(message).then(sendResponse);
      return true;
    }

    return false;
  } catch (error) {
    sendResponse({ ok: false, error: error.message });
    return true;
  }
});
