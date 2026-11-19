const dialog = document.querySelector('.lightbox');
const photos = [...document.querySelectorAll('.gallery a')];
const display = dialog.querySelector('img');
const caption = dialog.querySelector('figcaption');
const counter = dialog.querySelector('.photo-count');
const previous = dialog.querySelector('[data-photo="previous"]');
const next = dialog.querySelector('[data-photo="next"]');
const close = dialog.querySelector('[data-photo="close"]');
let current = 0;
let opener;

function show(index) {
  current = (index + photos.length) % photos.length;
  const photo = photos[current];
  display.src = photo.href;
  caption.textContent = photo.querySelector('img').alt;
  counter.textContent = `${current + 1} / ${photos.length}`;
}

if (typeof dialog.showModal === 'function') {
  previous.hidden = next.hidden = photos.length < 2;
  photos.forEach((photo, index) => photo.addEventListener('click', event => {
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    opener = photo;
    show(index);
    dialog.showModal();
    close.focus();
  }));
  previous.addEventListener('click', () => show(current - 1));
  next.addEventListener('click', () => show(current + 1));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => opener?.focus());
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  });
}
