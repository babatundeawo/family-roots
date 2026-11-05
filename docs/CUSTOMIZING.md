# Customising Family Roots

All edits happen on GitHub in the browser: open a file, click the pencil icon, change it, then **Commit changes**. The robot rebuilds and publishes the site.

| I want to change... | Edit this file |
|---|---|
| Brand colours (light and dark) | `design/palette.json`. Edit the light colours; the dark ones follow automatically. The build warns you if any text would be hard to read. |
| App name and description | `design/site.json` |
| The headline and landing text | `src/index.html` |
| Spacing, fonts sizes, component looks | `src/styles/main.css` |
| What each screen does | `src/app/main.js` |
| The icon | the files in `public/icons/` and `public/favicon.svg` (replace with your own PNGs at the same sizes) |
| Who can do what with the data | `firestore.rules` (then publish them, see FIREBASE_SETUP.md Step 3) |

## Colours
Each colour in `design/palette.json` is a hex code like `#6B4226`. Change `primary` for the main brand colour. After you commit, open the **Actions** tab: if a colour pair is too faint to read, the run prints a warning telling you which one.

## Try the screens without Firebase
A test build on pretend data exists for checking the screens. It is built only by the automatic **Checks** run and is never published.
