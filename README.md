# XRain

Chrome/Brave extension that adds a Raindrop.io save button to:

- X/Twitter tweets
- old Reddit posts
- Hacker News stories

Clicking the droplet opens Raindrop.io's add-link page with the link, title, description/note, and a single site tag prefilled.

## Install for Development

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## Notes

- X/Twitter behavior is based on the GreasyFork userscript pattern: watch the dynamic DOM, inject beside the tweet action buttons, extract tweet metadata, and open `https://app.raindrop.io/add`.
- Reddit support targets old Reddit markup. It is enabled for `old.reddit.com` and `www.reddit.com` when the old layout is active.
- Hacker News saves the story link when present and includes the HN discussion URL in the note.
- Tags are intentionally simple: `x`, `reddit`, or `hn`.
