# Cabinet textures

Every 3D element in the cabinet scene (`src/cabinet3d.js`) loads its surface texture from a PNG in this
folder. Each file currently ships as a placeholder — a flat color matching the element's current look,
with a bold label baked in so you can tell which file is which just by opening it, plus corner tick marks
so you can tell if it's been flipped or rotated. Replace any of them with real artwork at the same
filename (any resolution works; texture is stretched to fit) and reload the app (`Cmd+R`, or click the
window then use the app menu / refresh) to see it.

"Size" is a suggestion that matches the shape of the main visible face, so the art is not stretched.

| File | Element | Where it's applied | Size (px) | Notes |
|---|---|---|---|---|
| `cabinet-body.png` | Main cabinet body | All outer faces of the frame/back of the cabinet | 1024×1024 | One texture wraps all sides |
| `shelf.png` | Shelf | Top surface each row of packs sits on | 2048×136 (15:1) | |
| `cover.png` | Project cover | Front face of each shelf's swinging flap | 2048×512 (4:1) | |
| `cover-add-project.png` | "+ Add New Project" cover | Any empty slot's cover — a project's row reverts to this when deleted | 2048×512 (4:1) | |
| `pack.png` | Test plan pack | Every real test-plan "pack" box | 614×1024 (3:5) | Deliberately near-white/neutral — the app tints it a different color per pack (`material.color`), so keep this one light/neutral or the per-pack colors will look muddy. Packs get narrower on full shelves, so keep key art in the middle |
| `pack-add.png` | "+ Add Test Plan" pack | The trailing grey pack at the end of each shelf | 614×1024 (3:5) | |
| `chevron.png` | Side chevron | The scroll arrows on either side of a shelf (only visible once a shelf has enough packs to need scrolling) | 512×1024 (1:2) | |
| `button-edit.png` | Edit button | The button to the left of the cabinet that renames a project | 512×512 | |
| `button-delete.png` | Delete button | The button left of the Edit button that deletes a project | 512×512 | |
| `trash-can.png` | Trash can | The cylindrical prop to the right of the cabinet | 2048×796 (2.6:1) | Wraps once around the side; the lid and bottom also use it |
| `cardboard-box.png` | Cardboard box | The 3 stacked boxes to the left of the cabinet (all 3 share this one texture) | 1024×878 (7:6) | Used on every face, including the square tops |
| `wall.png` | Back wall | Flat backdrop behind the whole scene | 2048×1582 (1.3:1) | |
| `wall-left.png` | Left wall | Side wall on the left, at a right angle to the back wall | 1024×1872 (1:1.8) | Left edge of the image is at the street, right edge meets the back wall. Ships as a copy of `wall.png` |
| `sidewalk.png` | Sidewalk + curb | The ground plane everything rests on, and the raised lip at its front edge (shared texture) | 2048×838 (2.4:1) | |
| `road.png` | Road | The street surface in front of the curb, one curb-height below the sidewalk | 2048×1117 (1.8:1) | |

All are loaded once via `THREE.TextureLoader` in `cabinet3d.js` and reused across every scene rebuild —
no other code changes are needed to swap in new art.
