# XRain

Chrome/Brave extension that adds a [Raindrop.io](https://raindrop.io/) save button to:

- X/Twitter tweets
- old Reddit posts
- Hacker News stories

Clicking the droplet saves directly to Raindrop.io with the link, title, description/note, and a single site tag. If direct API save is not configured or fails, XRain falls back to Raindrop.io's add-link page.

For X/Twitter posts, XRain can ask Gemini for a concise bookmark title before opening Raindrop. By default it uses `gemini-2.5-flash-lite` with an 8 second timeout.

XRain is an independent project and is not affiliated with, endorsed by, or sponsored by Raindrop.io, X/Twitter, Reddit, Hacker News/Y Combinator, Brave, Google, or Gemini.

## Install for Development

1. Open `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this repository folder.

## Gemini Titles

Open the extension options page to change:

- whether Gemini titles are enabled
- model name, such as `gemini-2.5-flash-lite` or `gemini-2.5-flash`
- Gemini API key
- Raindrop API token
- request timeout
- model connectivity, using the **Test model** button

Gemini requests use the official `generateContent` REST API with the `x-goog-api-key` header. If the Gemini request fails or times out, XRain falls back to the normal title.

Raindrop saves use `POST https://api.raindrop.io/rest/v1/raindrop` with a Bearer token. For personal use, create a Raindrop application in the App Management Console and copy its test token.

## Privacy and Cost

- XRain stores your Gemini API key and Raindrop API token in `chrome.storage.local`.
- When Gemini titles are enabled, X post text is sent to Google's Gemini API to generate a concise bookmark title.
- Reddit and Hacker News saves do not use Gemini.
- Direct saves send bookmark data to Raindrop.io using your Raindrop token.
- Gemini API usage may incur costs or quota usage on your Google account.
- If direct Raindrop saving fails, XRain falls back to opening Raindrop.io's add-link page with bookmark details in the URL.

Do not publish your own API keys or tokens. Public users should create and use their own Gemini API key and Raindrop token.

## Notes

- X/Twitter behavior is based on the GreasyFork userscript pattern: watch the dynamic DOM, inject beside the tweet action buttons, extract tweet metadata, and open `https://app.raindrop.io/add`.
- Reddit support targets old Reddit markup. It is enabled for `old.reddit.com` and `www.reddit.com` when the old layout is active.
- Hacker News saves the story link when present and includes the HN discussion URL in the note.
- Tags are intentionally simple: `x`, `reddit`, or `hn`.
