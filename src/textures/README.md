# Cabinet textures

Every 3D element in the cabinet scene (`src/cabinet3d.js`) loads its surface texture from a PNG in this
folder. Each file currently ships as a placeholder — a flat color matching the element's current look,
with a bold label baked in so you can tell which file is which just by opening it, plus corner tick marks
so you can tell if it's been flipped or rotated. Replace any of them with real artwork at the same
filename (any resolution works; texture is stretched to fit) and reload the app (`Cmd+R`, or click the
window then use the app menu / refresh) to see it.

| File | Element | Where it's applied | Notes |
|---|---|---|---|
| `cabinet-body.png` | Main cabinet body | All outer faces of the frame/back of the cabinet | One texture wraps all sides |
| `shelf.png` | Shelf | Top surface each row of packs sits on | |
| `cover.png` | Project cover | Front face of each shelf's swinging flap | |
| `cover-add-project.png` | "+ Add New Project" cover | The dark cover at the top of the stack | |
| `pack.png` | Test plan pack | Every real test-plan "pack" box | Deliberately near-white/neutral — the app tints it a different color per pack (`material.color`), so keep this one light/neutral or the per-pack colors will look muddy |
| `pack-add.png` | "+ Add Test Plan" pack | The trailing grey pack at the end of each shelf | |
| `chevron.png` | Side chevron | The scroll arrows on either side of a shelf (only visible once a shelf has enough packs to need scrolling) | |
| `button-edit.png` | Edit button | The button to the left of the cabinet that renames a project | |
| `button-delete.png` | Delete button | The button to the right of the cabinet that deletes a project | |
| `trash-can.png` | Trash can | The cylindrical prop to the right of the cabinet | |
| `cardboard-box.png` | Cardboard box | The 3 stacked boxes to the left of the cabinet (all 3 share this one texture) | |

All are loaded once via `THREE.TextureLoader` in `cabinet3d.js` and reused across every scene rebuild —
no other code changes are needed to swap in new art.
