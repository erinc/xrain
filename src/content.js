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

  function truncate(value, maxLength) {
    if (!value || value.length <= maxLength) {
      return value;
    }

    if (maxLength <= 3) {
      return value.slice(0, maxLength);
    }

    return `${value.slice(0, maxLength - 3).trim()}...`;
  }

  function buildRaindropUrl({ link, title, description, tags }) {
    if (!link || !title) {
      return null;
    }

    const params = new URLSearchParams();
    params.set("link", link);
    params.set("title", truncate(title, MAX_TITLE_LENGTH));

    if (description) {
      params.set("description", description);
      params.set("note", description);
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
      onClick();
    });
    return button;
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
        wrapper.appendChild(
          makeButton("xrain-button--x", "Save tweet to Raindrop.io", () => {
            openRaindrop(getTweetData(tweet));
          })
        );
        host.parentElement.insertBefore(wrapper, host.nextSibling);
      });
  }

  function redditPermalink(post) {
    const comments = post.querySelector('a.comments[href]');
    const titleLink = post.querySelector('a.title[href]');
    return absoluteUrl(comments?.getAttribute("href") || titleLink?.getAttribute("href"));
  }

  function redditPostData(post) {
    const titleLink = post.querySelector('a.title[href]');
    const subreddit = cleanText(post.getAttribute("data-subreddit"));
    const author = cleanText(post.getAttribute("data-author"));
    const title = cleanText(titleLink?.innerText || post.querySelector(".title")?.innerText);
    const url = redditPermalink(post);
    const externalUrl = absoluteUrl(titleLink?.getAttribute("href"));
    const descriptionParts = [];

    if (externalUrl && externalUrl !== url) {
      descriptionParts.push(`Linked URL: ${externalUrl}`);
    }

    if (author) {
      descriptionParts.push(`Author: u/${author}`);
    }

    return {
      link: url,
      title: subreddit ? `${title} - r/${subreddit}` : title,
      description: descriptionParts.join("\n"),
      tags: ["reddit"]
    };
  }

  function addRedditButtons() {
    document.querySelectorAll(".thing.link").forEach((post) => {
      if (post.querySelector(`[${MARKER}]`)) {
        return;
      }

      const list = post.querySelector(".entry .flat-list.buttons");
      const firstItem = list?.querySelector("li");

      if (!list || !firstItem) {
        return;
      }

      const item = document.createElement("li");
      item.appendChild(
        makeButton("xrain-button--reddit", "Save Reddit post to Raindrop.io", () => {
          openRaindrop(redditPostData(post));
        })
      );
      list.insertBefore(item, firstItem.nextSibling);
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
    const description = commentsUrl && commentsUrl !== link ? `HN discussion: ${commentsUrl}` : "";

    return {
      link,
      title: title ? `${title} - Hacker News` : "Hacker News post",
      description,
      tags: ["hn"]
    };
  }

  function addHackerNewsButtons() {
    document.querySelectorAll("tr.athing").forEach((row) => {
      if (row.querySelector(`[${MARKER}]`)) {
        return;
      }

      const titleCell = row.querySelector("td.title:last-child");

      if (!titleCell) {
        return;
      }

      const spacer = document.createTextNode(" ");
      const button = makeButton("xrain-button--hn", "Save Hacker News post to Raindrop.io", () => {
        openRaindrop(hackerNewsPostData(row));
      });
      const wrapper = document.createElement("span");
      wrapper.className = "xrain-hn-cell";
      wrapper.append(spacer, button);
      titleCell.appendChild(wrapper);
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
