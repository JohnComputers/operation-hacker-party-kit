# Ghost Parcel

A completely free, browser-based party mission for two or three teams. Print the evidence, hide three envelopes, and let players race through a six-step tracking mystery.

**Live site:** https://johncomputers.github.io/operation-hacker-party-kit/

## What is included

- A complete host guide and 15-25 minute runbook
- The six-screen Hawk, Wolf, and Bolt team mission
- Printer-ready receipts, dispatch notes, labels, and parcel signs
- Optional evidence-photo customization stored only in the browser
- Setup export/import for moving a mission between team devices
- Responsive, keyboard-friendly design with no external dependencies

## Free and private by design

This project has no server, accounts, ads, analytics, cookies, API keys, or paid services. Names, hiding places, progress, and optional photos remain in the visitor's browser. The source is available under the MIT License.

The public version uses a generic celebration name. Do not put a child's full name or private location into a public repository; personalize those details through the on-page Host Desk instead.

## Run locally

No build step is required. From this directory, start any static file server, for example:

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

Opening `index.html` directly also works for most features, but a local server gives the closest match to GitHub Pages.

## Publish on GitHub Pages

The site is intentionally buildless. Publish the repository's `main` branch from the repository root and keep `.nojekyll` in place. Every relative asset path works from a GitHub project-pages URL.

## Party setup

1. Open **Print the kit** and print the active team materials single-sided on US Letter paper.
2. Fold each receipt's barcode panel back, then cut each five-letter label into strips.
3. Put each team's shuffled label pieces and dispatch note into its labeled envelope.
4. Hide Hawk under a chair, Wolf behind a planter, and Bolt under a mat.
5. Use the built-in illustrations or add your own evidence photos in the Host Desk.
6. Test every route, restart each device, place receipts face down, and read the briefing.

## Browser data

- `localStorage` holds host configuration and optional compressed photos.
- `sessionStorage` holds a team's current progress for that tab.
- **Restart mission** clears only the current team run.
- Clearing the site's browser data removes all saved configuration and progress.

## Accessibility

The site supports keyboard navigation, visible focus states, semantic forms, reduced-motion preferences, and high-contrast print output. If you spot an accessibility issue, please open an issue or send a pull request.

## License

MIT. Use it, adapt it, and share it.
