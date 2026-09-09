const select = document.querySelector('#scene'), frame = document.querySelector('#game');
function load() {
  const scene = select.value;
  const route = ['potion', 'equipment', 'smith', 'catalog', 'lab', 'compendium'].includes(scene) ? 'combat' : scene;
  const url = `tooltip-review-scene.html?shot=${route}&tooltipReview=${scene}`;
  document.querySelector('#full').href = url;
  frame.src = url;
}
select.onchange = load; document.querySelector('#reset').onclick = load;
select.value = new URLSearchParams(location.search).get('scene') || 'combat';
load();
