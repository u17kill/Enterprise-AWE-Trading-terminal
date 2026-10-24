# V0.3 Portfolio Matrix Design

## Intent
Replace the lane-and-card portfolio page with the supplied full satellite matrix. Its horizontal hierarchy is strategy (进攻 / 均衡 / 防御) then editable theme columns; its vertical hierarchy is region (美国 / 中国 / 日韩台印 / 欧洲). Each cell contains independently editable tiles.

## Decisions
- Seed the matrix with the screenshot's labels and amounts. These are an editable reference transcription, not verified current holdings or live market values.
- Tile states: gray = held, yellow = watching without a position, green = considering an addition. The screenshot's blue option annotations become yellow watching tiles and retain their `put` text.
- A tile stores code or short label, optional company name, free-text position note/amount, status, region and theme column. Free text preserves entries such as `9.5k`, `2.7k–5`, and `put 115` without pretending they are share quantities or prices.
- Strategies, themes, regions, and tiles can be added, renamed or edited, and deleted. Deletion of a container requires confirmation because it removes its contained tiles.
- Save V0.3 in a new browser storage key. Keep the V1.3 storage key untouched and expose a download of that earlier data if it exists.
- Preserve the wider app navigation, with horizontal scrolling on narrower screens so matrix columns remain aligned.

## Alternatives considered
- Reuse the old lane/card model: too little structure for the screenshot's region-by-theme matrix.
- Render the screenshot as a static image: cannot edit or add entries.
- Use a new editable matrix data model: chosen to preserve the layout and each tile's meaning.

## Success
The page initially resembles the screenshot's three strategy bands, fourteen themes and four region rows; editing any item survives a reload; status colors and labels are explicit; no old private data is overwritten.
