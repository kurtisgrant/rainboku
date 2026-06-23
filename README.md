# Rainboku

Rainboku is a daily colour-based Sudoku puzzle for mobile browsers. Numbers are replaced by a nine-colour rainbow palette, with a radial colour picker, saved progress, local stats, result sharing, and a continuous colour-name reference bar.

Each local calendar day deterministically generates the same Easy, Medium, and Hard puzzles from date-derived seeds. The app is fully static and runs on GitHub Pages without a backend.

## Play

https://kurtisgrant.github.io/rainboku/

## Development

Serve the repo root with any static server:

```sh
python -m http.server 8091
```

Then open `http://127.0.0.1:8091/`.
