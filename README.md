# Data Download Portal

This is a pure static site designed for GitHub Pages. It loads one CSV in the browser, filters it by commuting zone and year range, previews the matching rows, plots one numeric metric, and lets the user download the filtered rows as a new CSV.

## Project structure

```text
data-portal/
|- index.html
|- app.js
|- style.css
|- data/
|  |- commuting_zone_norms_deviation_github.csv
|- README.md
```

## Current dataset

The project is already configured for [commuting_zone_norms_deviation_github.csv](C:\Users\jerom\Downloads\data-portal\data\commuting_zone_norms_deviation_github.csv), which has these key columns:

- `commuting_zone`: the commuting zone identifier shown to users
- `year`: a numeric year
- one or more numeric columns to plot, such as `stylenov`, `normdev_horizontal`, or `normdev_raw_index`

Example:

```csv
year;commuting_zone;stylenov;normdev_horizontal
1930;100;0;0.27629384
1931;100;0.027027028;0.41862172
1933;100;0.017857144;0.39407361
```

## How to use it

1. Keep [commuting_zone_norms_deviation_github.csv](C:\Users\jerom\Downloads\data-portal\data\commuting_zone_norms_deviation_github.csv) in the `data/` folder, or replace it with an updated version that keeps the same schema.
2. If the schema changes, update the field names and delimiter in [app.js](C:\Users\jerom\Downloads\data-portal\app.js).
3. Open a local server to test it. One easy option is:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000/`.

## Publish with GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root.
3. In GitHub, open `Settings > Pages`.
4. Under `Build and deployment`, choose `Deploy from a branch`.
5. Select the `main` branch and `/root`.

Your site will then be available at a URL like:

`https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`

## Notes

- The portal is best when the CSV is small enough to load fully in the browser.
- CSV parsing uses Papa Parse, which is safer than a hand-written parser for quoted values.
- Plotting uses Chart.js.
- Your current dataset uses `;` as the delimiter, and [app.js](C:\Users\jerom\Downloads\data-portal\app.js) is already configured for that.
- The current interface filters by commuting zone ID because the CSV contains IDs rather than human-readable zone names.
