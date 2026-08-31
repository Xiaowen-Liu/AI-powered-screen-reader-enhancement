# Cognitive Layer AI

A Chrome extension prototype that helps screen-reader users understand and navigate unfamiliar web pages. It adds on-device page summaries, section-level cues, and clearer labels for ambiguous controls without requiring a page author to modify their site.

## Why I built it

Many pages are technically accessible yet still cognitively expensive to navigate with a screen reader: long pages lack a quick overview, headings do not explain what follows, and links such as "Learn more" provide too little context.

Cognitive Layer AI explores a product direction: add an optional, user-controlled interpretation layer on top of the existing page rather than replacing the user's assistive technology.

## What it does

- Generates a short page overview from the page's main content.
- Creates concise summaries for sections identified by headings.
- Finds vague links and buttons, then proposes contextual ARIA labels.
- Announces progress and results through a persistent ARIA live region.
- Presents generated summaries visibly in the page as well as to screen readers.

## Product decisions

- **User-controlled augmentation:** the extension only runs its actions when the user selects them from the popup.
- **Progress is accessible:** every long-running action reports state through a live region, so a user is not left waiting silently.
- **Content is scoped:** page extraction prefers `main` or `article` and limits text length before summarization.
- **Context before automation:** labels use nearby headings, parent content, existing text, and URLs rather than changing every element indiscriminately.

## Technical implementation

The extension uses Chrome Extension Manifest V3 with a content script injected into matching pages.

```
popup action
  -> chrome.runtime message
    -> content script
      -> Chrome built-in Summarizer or Language Model API
      -> accessible page augmentation and live announcements
```

Key implementation details:

- `content.js` creates and maintains a `role="status"` live region for announcements.
- Page and section summaries use the Chrome built-in `Summarizer` API when available.
- Ambiguous controls are detected from their visible text and receive generated `aria-label` values only when they do not already have one.
- Each generated section summary is inserted after its associated heading with `role="note"`.

## Stack

- Chrome Extension Manifest V3
- JavaScript, HTML, CSS
- Chrome built-in AI APIs: `Summarizer` and `LanguageModel`
- ARIA live regions and semantic HTML

## Run locally

1. Clone this repository.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Select **Load unpacked** and choose this repository folder.
5. Open a web page, select the extension icon, and choose an available action.

This is an experimental prototype. The Chrome built-in AI APIs require a compatible Chrome version and may need to be enabled or downloaded in the browser before they are available.

## My contribution

I designed and implemented the interaction model and Chrome extension prototype, including page-content extraction, accessible live announcements, section summarization, contextual control labeling, and the popup-to-content-script message flow.

## Next steps

- Add automated accessibility tests for generated UI.
- Replace raw generated HTML insertion with safe DOM text nodes.
- Evaluate the experience with screen-reader users and iterate on cue timing, verbosity, and label quality.
- Add a small test corpus of representative pages and regression checks for generated labels.
