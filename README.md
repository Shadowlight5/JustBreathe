# Just Breathe

A small, calm web app that guides you through one of five breathing patterns, chosen
from a picker, to help you settle before a stressful moment. A soft circle grows and
shrinks with your breath, a thin ring around it fills through each step of the breath,
and the screen tells you what to do and counts down each step. There is one main button:
Start, which becomes Stop.

It is a Progressive Web App, so you can add it to your phone's home screen and, once it
has loaded over HTTPS, it works with no internet connection. There is no account, no
tracking, no server code, and nothing is sent anywhere.

## Run it on your computer

You need Python 3 (already installed on a Mac).

```sh
python3 -m http.server 8000
# or: npm start
```

Then open http://localhost:8000 in your browser.

## Try it on your phone (same Wi-Fi)

1. Keep the server above running.
2. Find your Mac's local address: `ipconfig getifaddr en0` (for example `192.168.1.20`).
3. On your phone, open `http://<that address>:8000`.

## Add it to your home screen

- **iPhone (Safari):** open the page, tap the Share button, then "Add to Home Screen",
  then "Add".
- **Android (Chrome):** open the page, tap the three-dot menu, then "Add to Home screen"
  or "Install app".

## Important: offline mode needs HTTPS

Browsers only allow service workers (the part that makes the app work offline and fully
installable) on HTTPS pages or on `localhost`. When you open the app on your phone over
plain `http://<your-ip>:8000`, it runs fine, but offline caching will not switch on.

The simplest fix is to put this folder on any free static host that gives you HTTPS, such
as GitHub Pages, Netlify, or Cloudflare Pages. There is no backend to set up; the hosts
just serve these files. Open the HTTPS address on your phone, add it to the home screen,
and it will keep working with no connection.

## Tests

```sh
npm test          # unit tests for the breathing timing (node --test, no installs)
npm run smoke     # headless browser check; needs the server running on port 8000
```

The smoke test drives a local headless Chromium over the DevTools Protocol. Set
`CHROME_PATH` if your Chromium binary is somewhere other than the default in
`tools/smoke.js`.

## Patterns

Tap "Change" under the circle to pick a pattern. Your choice is remembered on this device.

- **Slow exhale** (4 in and 6 out, the default): six slow breaths a minute with a longer
  out-breath, the rate with the strongest evidence for settling heart rate and anxiety
  within minutes.
- **Coherent breathing** (5 in and 5 out): the same slow rate with even breaths, the most
  studied pacing for raising heart rate variability.
- **Physiological sigh** (two in through the nose, one long out through the mouth): the
  double inhale reopens the lungs and the long exhale drops arousal within a breath or two.
- **Box breathing** (4 in, hold 4, 4 out, hold 4): equal sides like a square, used by the
  military to steady focus under pressure.
- **4-7-8** (4 in, hold 7, 8 out): Dr Weil's wind-down pattern for settling before sleep.
  It stops itself after four breaths, because the long hold can leave you lightheaded at
  first.

To add a pattern, add an entry to `PATTERNS` in `js/patterns.js`. Each phase has a label,
a length in whole seconds, and the circle size it moves from and to (0 is smallest, 1 is
largest). Each phase must start at the size the previous one ended at, and the last must
end where the first starts. Add `cycles: N` to make a pattern stop after N breaths. Then
bump the cache name in `sw.js` (see below) and run `npm test`.

This app is not medical advice. If you feel dizzy or lightheaded, stop and breathe normally.

### Sources

- Balban 2023 https://doi.org/10.1016/j.xcrm.2022.100895
- Magnon 2021 https://doi.org/10.1038/s41598-021-98736-9
- Marchant 2025 https://pubmed.ncbi.nlm.nih.gov/39864026/
- Steffen 2017 https://doi.org/10.3389/fpubh.2017.00222
- Zaccaro 2018 https://doi.org/10.3389/fnhum.2018.00353
- Fincham 2023 https://doi.org/10.1038/s41598-022-27247-y
- Cleveland Clinic https://health.clevelandclinic.org/box-breathing-benefits
- HPRC https://hprc-online.org/mental-fitness/stress/tactical-breathing-military
- Univ. of Arizona (Weil, 4-7-8) https://awcim.arizona.edu/content/CLH00048.html
- Stanford Medicine https://med.stanford.edu/news/insights/2023/02/cyclic-sighing-can-help-breathe-away-anxiety.html
- HeartMath https://www.heartmath.com/quick-coherence-technique/

## Updating the app

Whenever you change any file, bump the `CACHE` name in `sw.js` (for example
`just-breathe-v1` to `just-breathe-v2`). Otherwise installed copies keep serving the old
cached files. After bumping `CACHE`, the new version takes effect the next time the app
is opened after all its tabs (or the home-screen app) have been closed.

## Regenerating the icons

```sh
python3 tools/make-icons.py
```
