const closeBtn = document.getElementById('closeBtn');
const previewImg = document.getElementById('previewImg');

window.api.onBaselinePreviewInit(({ imageUrl }) => {
  previewImg.src = imageUrl;
});

closeBtn.addEventListener('click', () => window.close());

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.close();
});
