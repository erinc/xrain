(function () {
  "use strict";

  const MARKER = "data-xrain-raindrop-button";
  const RAINDROP_ADD_URL = "https://app.raindrop.io/add";
  const RAINDROP_ICON = [
    '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"',
    ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
    '<path d="M12 3.25c3.25 3.8 6 7.15 6 10.5a6 6 0 0 1-12 0c0-3.35 2.75-6.7 6-10.5Z"/>',
    '<path d="M9.25 14.25a2.75 2.75 0 0 0 2.75 2.75"/>',
    "</svg>"
  ].join("");

  const MAX_TITLE_LENGTH = 255;
  const BUTTON_LABEL = "Save to Raindrop.io";
  const BUTTON_STATE_RESET_MS = 1400;
  const TOAST_HIDE_MS = 2400;
  let toastElement = null;
  let toastTimer = null;

  function absoluteUrl(value) {
    if (!value) {
      return null;
    }

    try {
      return new URL(value, window.location.href).toString();
    } catch (_error) {
      return null;
    }
  }

  function cleanText(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function toast(message, tone = "default", persist = false) {
    if (!toastElement) {
      toastElement = document.createElement("div");
      toastElement.className = "xrain-toast";
      toastElement.setAttribute("role", "status");
      document.documentElement.appendChild(toastElement);
    }

    window.clearTimeout(toastTimer);
    toastElement.textContent = message;
    toastElement.dataset.xrainTone = tone;
    toastElement.dataset.xrainVisible = "true";

    if (!persist) {
      toastTimer = window.setTimeout(() => {
        toastElement.dataset.xrainVisible = "false";
      }, TOAST_HIDE_MS);
    }
  }

  function truncate(value, maxLength) {
    if (!value || value.length <= maxLength) {
      return value;
    }

    if (maxLength <= 3) {
      return value.slice(0, maxLength);
    }

    return `${value.slice(0, maxLength - 3).trim()}...`;
  }

  function buildRaindropUrl({ link, title, description, note, tags }) {
    if (!link || !title) {
      return null;
    }

    const params = new URLSearchParams();
    params.set("link", link);
    params.set("title", truncate(title, MAX_TITLE_LENGTH));

    if (description) {
      params.set("description", description);
    }

    if (note || description) {
      params.set("note", note || description);
    }

    if (tags && tags.length) {
      params.set("tags", tags.filter(Boolean).join(","));
    }

    return `${RAINDROP_ADD_URL}?${params.toString()}`;
  }

  function openRaindrop(item) {
    const url = buildRaindropUrl(item);

    if (!url) {
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  function askForTweetTitle(tweetText) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage || !tweetText) {
      return Promise.resolve(null);
    }

    return chrome.runtime
      .sendMessage({
        type: "summarizeTweetTitle",
        tweetText
      })
      .then((response) => {
        if (response?.error) {
          console.warn("XRain Gemini title failed:", response.error);
        }

        return cleanText(response?.title);
      })
      .catch(() => null);
  }

  function saveToRaindrop(item) {
    if (typeof chrome === "undefined" || !chrome.runtime?.sendMessage) {
      return Promise.resolve({ ok: false, error: "Extension worker is unavailable" });
    }

    return chrome.runtime
      .sendMessage({
        type: "saveRaindrop",
        item: {
          link: item.link,
          title: truncate(item.title, MAX_TITLE_LENGTH),
          description: item.description || "",
          note: item.note || item.description || "",
          tags: item.tags || []
        }
      })
      .catch((error) => ({ ok: false, error: error.message }));
  }

  function appendHandleToTitle(title, handle) {
    if (!title || !handle) {
      return title;
    }

    if (title.toLowerCase().includes(handle.toLowerCase())) {
      return title;
    }

    return truncate(`${title} ${handle}`, MAX_TITLE_LENGTH);
  }

  function setButtonState(button, state, label) {
    if (!button) {
      return;
    }

    button.dataset.xrainState = state;
    button.setAttribute("aria-label", label);
    button.title = label;
  }

  function resetButtonState(button, label = BUTTON_LABEL) {
    window.setTimeout(() => {
      setButtonState(button, "idle", label);
      button.disabled = false;
    }, BUTTON_STATE_RESET_MS);
  }

  async function openTweetInRaindrop(tweet, button) {
    if (button?.disabled) {
      return;
    }

    setButtonState(button, "loading", "Generating title with Gemini...");
    button.disabled = true;
    toast("Generating title...", "default", true);

    const data = getTweetData(tweet);
    const generatedTitle = await askForTweetTitle(data.description);

    if (generatedTitle) {
      data.title = appendHandleToTitle(generatedTitle, data.authorHandle);
    }

    setButtonState(button, "loading", "Saving to Raindrop.io...");
    toast("Saving to Raindrop...", "default", true);
    const saved = await saveToRaindrop(data);

    if (saved.ok) {
      setButtonState(button, "success", "Saved to Raindrop.io");
      toast("Saved to Raindrop", "success");
    } else {
      console.warn("XRain Raindrop API save failed:", saved.error);
      setButtonState(button, "fallback", "Opening Raindrop.io fallback...");
      toast("Could not save directly. Opening Raindrop...", "fallback");
      openRaindrop(data);
    }

    resetButtonState(button, "Save tweet to Raindrop.io");
  }

  function makeButton(className, label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `xrain-button ${className}`;
    button.setAttribute(MARKER, "true");
    button.setAttribute("aria-label", label);
    button.title = label;
    button.innerHTML = RAINDROP_ICON;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(button);
    });
    return button;
  }

  function makeTextButton(className, label, text, onClick) {
    const button = document.createElement("a");
    button.href = "#";
    button.className = `xrain-button ${className}`;
    button.setAttribute(MARKER, "true");
    button.setAttribute("aria-label", label);
    button.title = label;
    button.textContent = text;
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onClick(button);
    });
    return button;
  }

  function openItemInRaindrop(item, button, label) {
    if (button?.dataset.xrainBusy === "true") {
      return;
    }

    button.dataset.xrainBusy = "true";
    setButtonState(button, "loading", "Saving to Raindrop.io...");
    toast("Saving to Raindrop...", "default", true);
    saveToRaindrop(item).then((saved) => {
      if (saved.ok) {
        setButtonState(button, "success", "Saved to Raindrop.io");
        toast("Saved to Raindrop", "success");
      } else {
        console.warn("XRain Raindrop API save failed:", saved.error);
        setButtonState(button, "fallback", "Opening Raindrop.io fallback...");
        toast("Could not save directly. Opening Raindrop...", "fallback");
        openRaindrop(item);
      }

      button.dataset.xrainBusy = "false";
      resetButtonState(button, label);
    });
  }

  function getTweetData(tweet) {
    const statusLink = tweet.querySelector('a[href*="/status/"]');
    const link = absoluteUrl(statusLink && statusLink.getAttribute("href"));
    const text = cleanText(tweet.querySelector('[data-testid="tweetText"]')?.innerText);
    const userNameContainer = tweet.querySelector('[data-testid="User-Name"]');
    const userNameText = cleanText(userNameContainer?.innerText);
    const handleMatch = userNameText.match(/@[A-Za-z0-9_]+/);
    const handle = handleMatch ? handleMatch[0] : "";
    const displayName = cleanText(
      userNameContainer?.querySelector('a[role="link"] span span')?.innerText
    );
    const host = window.location.hostname.includes("x.com") ? "x.com" : "twitter.com";
    const platform = host === "x.com" ? "X" : "Twitter";
    const author = cleanText([displayName, handle && `(${handle})`].filter(Boolean).join(" "));
    const prefix = author ? `${author} on ${platform}` : platform;
    const title = text ? `${prefix}: "${text}"` : `${prefix} post`;

    return {
      link,
      title,
      description: text,
      authorHandle: handle,
      tags: ["x"]
    };
  }

  function addTwitterButtons() {
    document
      .querySelectorAll('article[data-testid="tweet"]')
      .forEach((tweet) => {
        if (tweet.querySelector(`[${MARKER}]`)) {
          return;
        }

        const bookmark = tweet.querySelector(
          'button[data-testid="bookmark"], button[data-testid="removeBookmark"]'
        );
        const host = bookmark?.parentElement;

        if (!host || !host.parentElement) {
          return;
        }

        const wrapper = host.cloneNode(false);
        const row = host.parentElement;
        wrapper.appendChild(
          makeButton("xrain-button--x", "Save tweet to Raindrop.io", (button) => {
            openTweetInRaindrop(tweet, button);
          })
        );
        row.appendChild(wrapper);
      });
  }

  function redditPermalink(post) {
    const comments = post.querySelector('a.comments[href]');
    const titleLink = post.querySelector('a.title[href]');
    return absoluteUrl(comments?.getAttribute("href") || titleLink?.getAttribute("href"));
  }

  function redditPostBody(post) {
    const expando = post.querySelector(".expando .usertext-body");
    const bodyText = cleanText(expando?.innerText);

    if (!bodyText || /^loading/i.test(bodyText)) {
      return "";
    }

    return truncate(bodyText, 500);
  }

  function redditPostData(post) {
    const titleLink = post.querySelector('a.title[href]');
    const subreddit = cleanText(post.getAttribute("data-subreddit"));
    const title = cleanText(titleLink?.innerText || post.querySelector(".title")?.innerText);
    const url = redditPermalink(post);
    const note = redditPostBody(post);

    return {
      link: url,
      title: subreddit ? `${title} - r/${subreddit}` : title,
      description: note,
      note,
      tags: ["reddit"]
    };
  }

  function addRedditButtons() {
    document.querySelectorAll(".thing.link").forEach((post) => {
      if (post.querySelector(`[${MARKER}]`)) {
        return;
      }

      const list = post.querySelector(".entry .flat-list.buttons");

      if (!list) {
        return;
      }

      const item = document.createElement("li");
      item.appendChild(
        makeTextButton(
          "xrain-button--reddit",
          "Save Reddit post to Raindrop.io",
          "raindrop",
          (button) => {
            openItemInRaindrop(redditPostData(post), button, "Save Reddit post to Raindrop.io");
          }
        )
      );
      list.appendChild(item);
    });
  }

  function hackerNewsPostData(row) {
    const titleLink = row.querySelector(".titleline > a[href], .storylink[href]");
    const subtext = row.nextElementSibling;
    const commentsLink = subtext?.querySelector('a[href*="item?id="]');
    const title = cleanText(titleLink?.innerText);
    const storyUrl = absoluteUrl(titleLink?.getAttribute("href"));
    const commentsUrl = absoluteUrl(commentsLink?.getAttribute("href"));
    const link = storyUrl || commentsUrl;

    return {
      link,
      title: title ? `${title} - Hacker News` : "Hacker News post",
      description: "",
      note: commentsUrl ? `HN discussion: ${commentsUrl}` : "",
      tags: ["hn"]
    };
  }

  function addHackerNewsButtons() {
    document.querySelectorAll("tr.athing").forEach((row) => {
      const subtext = row.nextElementSibling;

      if (subtext?.querySelector(`[${MARKER}]`)) {
        return;
      }

      const subline = subtext?.querySelector(".subline");

      if (!subline) {
        return;
      }

      const button = makeTextButton(
        "xrain-button--hn",
        "Save Hacker News post to Raindrop.io",
        "raindrop",
        (buttonElement) => {
          openItemInRaindrop(
            hackerNewsPostData(row),
            buttonElement,
            "Save Hacker News post to Raindrop.io"
          );
        }
      );
      const hideLink = Array.from(subline.querySelectorAll("a")).find(
        (link) => cleanText(link.textContent) === "hide"
      );

      if (hideLink) {
        hideLink.after(" | ", button);
      } else {
        subline.append(" | ", button);
      }
    });
  }

  function run() {
    const host = window.location.hostname;

    if (host === "x.com" || host.endsWith(".twitter.com") || host === "twitter.com") {
      addTwitterButtons();
      return;
    }

    if (host === "old.reddit.com" || host === "www.reddit.com") {
      addRedditButtons();
      return;
    }

    if (host === "news.ycombinator.com") {
      addHackerNewsButtons();
    }
  }

  let scheduled = false;

  function scheduleRun() {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  }

  const observer = new MutationObserver(scheduleRun);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  scheduleRun();
})();
