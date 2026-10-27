# Cabinet textures

Every 3D element in the cabinet scene (`src/cabinet3d.js`) loads its surface texture from a PNG in this
folder. Replace any of them at the same filename and reload the app (`Cmd+R`) to see it.

Textures are never stretched. Each one uses one of two fit modes:
- **Repeat** — the image is tiled. One copy covers a fixed size in the scene (the "Tile" column, in
  scene units; the cabinet is 700 wide). Big objects show it many times, so use a seamless image.
  Any square size works, e.g. 1024×1024. Tile sizes are in `TILE_SIZE` in `cabinet3d.js`.
- **Cover** — the image is shown once on each face and cropped to the face's shape, like CSS
  `background-size: cover`. Use the "Size" column so nothing important is cut off; keep key art in
  the middle.

| File | Element | Where it's applied | Fit | Tile / Size | Notes |
|---|---|---|---|---|---|
| `cabinet-body.png` | Main cabinet body | All outer faces of the frame/back of the cabinet | Repeat | 400 | |
| `shelf.png` | Shelf | Top surface each row of packs sits on | Repeat | 300 | |
| `cover.png` | Project cover | Front face of each shelf's swinging flap | Cover | 2048×512 (4:1) | |
| `cover-add-project.png` | "+ Add New Project" cover | Any empty slot's cover — a project's row reverts to this when deleted | Cover | 2048×512 (4:1) | |
| `pack.png` | Test plan pack | Every real test-plan "pack" box | Cover | 614×1024 (3:5) | The app tints it a different color per pack (`material.color`), so keep it light/neutral or the colors look muddy. Packs get narrower on full shelves |
| `pack-add.png` | "+ Add Test Plan" pack | The trailing grey pack at the end of each shelf | Cover | 614×1024 (3:5) | |
| `chevron.png` | Side chevron | The scroll arrows on either side of a shelf (only visible once a shelf has enough packs to need scrolling) | Cover | 512×1024 (1:2) | |
| `button-edit.png` | Edit button | The button left of the cabinet that renames a project | Cover | 512×512 | |
| `button-delete.png` | Delete button | The button left of the Edit button that deletes a project | Cover | 512×512 | |
| `trash-can.png` | Trash can | The cylindrical prop to the right of the cabinet | Repeat | 300 | Repeats 3 times around the side. The lid and bottom show the image once |
| `cardboard-box.png` | Cardboard box | The 3 stacked boxes to the left of the cabinet (all 3 share this one texture) | Cover | 1024×878 (7:6) | Used on every face, including the square tops |
| `wall.png` | Back wall | Flat backdrop behind the whole scene | Repeat | 600 | |
| `wall-left.png` | Left wall | Side wall on the left, at a right angle to the back wall | Repeat | 600 | |
| `sidewalk.png` | Sidewalk + curb | The ground plane everything rests on, and the raised lip at its front edge (shared texture) | Repeat | 300 | |
| `road.png` | Road | The street surface in front of the curb, one curb-height below the sidewalk | Repeat | 400 | |

All are loaded once via `THREE.TextureLoader` in `cabinet3d.js` and reused across every scene rebuild —
no other code changes are needed to swap in new art.
