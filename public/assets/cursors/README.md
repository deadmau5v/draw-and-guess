# Game cursor assets

Generated with the built-in imagegen tool. These are pointer artwork, not action or status icons. Original transparent artwork is kept as `*-source.png`; the small PNG files are the production CSS cursors. `hotspots.json` records the arrow/finger tip positions.

Prompt set: isolated transparent cartoon game cursors, glossy blue/yellow palette, thick navy outline, readable at 32px; default golden arrow pointing upper left; hover white pointing glove with yellow cuff. No text, borders, decorative objects or detached shadows. The pressed state reuses the hover glove's exact shape and alpha, recoloring its light glove pixels golden yellow; it uses the same dimensions and hotspot as the hover state.

To package new generated versions: `node scripts/prepare-cursors.mjs <default PNG> <pointer PNG> --pressed-from-pointer`. Update CSS hotspot coordinates if the output changes.
