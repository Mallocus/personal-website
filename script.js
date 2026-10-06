const revealEls = document.querySelectorAll('.reveal');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15 }
);

revealEls.forEach((el) => observer.observe(el));


/* ---------- minecraft capes ----------
   one data file per edition; each has { owned: [ids], capes: [...] }
   data/capes.js    -> window.CAPE_DATA     (java/bedrock; textures in capes/)
   data/dungeons.js -> window.DUNGEONS_DATA (minecraft dungeons; images in dungeons/)
   data/dungeons2.js -> window.DUNGEONS2_DATA (minecraft dungeons II; images in dungeons2/) */
(function initCapes() {
  const list = document.getElementById('cape-list');
  const summary = document.getElementById('cape-summary');
  if (!list || !document.getElementById('cape-edition')) return;

  const editions = {
    minecraft: window.CAPE_DATA,
    dungeons: window.DUNGEONS_DATA,
    dungeons2: window.DUNGEONS2_DATA,
  };

  // a cape either has a "texture" (skin-format file, front face is cropped
  // out) or an "image" (a ready-made picture, used as-is)
  function card(c, owned) {
    const own = owned.has(c.id);
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cape-card' + (own ? '' : ' missing');
    el.dataset.id = c.id;
    el.setAttribute('aria-expanded', 'false');
    let pic;
    if (c.image) {
      pic = new Image();
      pic.alt = '';
      pic.loading = 'lazy';
      pic.src = c.image;
    } else {
      pic = document.createElement('canvas');
      pic.width = 10;
      pic.height = 16;
      const img = new Image();
      img.onload = () => pic.getContext('2d').drawImage(img, 1, 1, 10, 16, 0, 0, 10, 16);
      img.src = c.texture;
    }
    const name = document.createElement('span');
    name.className = 'cape-name';
    name.textContent = c.name;
    const state = document.createElement('span');
    state.className = 'sr-only';
    state.textContent = own ? ' (owned)' : ' (missing)';
    name.append(state);
    el.append(pic, name);
    return el;
  }

  function group(tag, title, items, owned) {
    const g = document.createElement(tag);
    g.className = 'cape-group';
    const head = document.createElement(tag === 'details' ? 'summary' : 'h3');
    head.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'cape-grid';
    items.forEach((c) => grid.appendChild(card(c, owned)));
    g.append(head, grid);
    return g;
  }

  const bucket = (items) => {
    const out = {};
    items.forEach((c) => (out[c.category] ||= []).push(c));
    return out;
  };

  let capeById = {};
  let ownedNow = new Set();

  function render(key) {
    const data = editions[key];
    closePanel();
    list.textContent = '';
    if (!data) {
      summary.textContent = '';
      return;
    }
    const { capes } = data;
    const owned = new Set(data.owned || []);
    capeById = Object.fromEntries(capes.map((c) => [c.id, c]));
    ownedNow = owned;
    // the unobtainable ones don't count towards the total
    const gettable = capes.filter((c) => !c.unobtainable);
    const have = gettable.filter((c) => owned.has(c.id)).length;
    summary.textContent = `${have} of ${gettable.length} collected`;

    Object.entries(bucket(capes.filter((c) => !c.unobtainable))).forEach(([cat, items]) =>
      list.appendChild(group('div', cat, items, owned))
    );

    // 1-of-1 / staff / near-impossible capes: a collapsed dropdown, split by category
    const hard = capes.filter((c) => c.unobtainable);
    if (hard.length) {
      const count = hard.filter((c) => owned.has(c.id)).length;
      const box = document.createElement('details');
      box.className = 'cape-unobtainable';
      const sum = document.createElement('summary');
      sum.textContent = `Unobtainable (${count} / ${hard.length})`;
      box.appendChild(sum);
      Object.entries(bucket(hard)).forEach(([cat, items]) =>
        box.appendChild(group('div', cat, items, owned))
      );
      list.appendChild(box);
    }

    // enter with the site's scroll-reveal (rise + fade), one group after another
    [...list.children].forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-order', i);
      observer.observe(el);
    });
  }

  // ---- cape detail panel ----
  // opens inline under the clicked cape's row. optional per-cape fields:
  //   how: "how to get it", history: "...", owners: { count, source, asOf }
  const panel = document.createElement('div');
  panel.className = 'cape-panel';
  panel.id = 'cape-panel';
  panel.setAttribute('role', 'region');
  panel.innerHTML = `
    <span class="cape-panel-notch" aria-hidden="true"></span>
    <div class="cape-panel-inner">
      <div class="cape-panel-pic"></div>
      <div class="cape-panel-body">
        <div class="cape-panel-head">
          <h4 class="cape-panel-name"></h4>
          <button type="button" class="cape-panel-close" aria-label="Close cape details">close</button>
        </div>
        <p class="cape-panel-status"></p>
        <dl class="cape-panel-facts"></dl>
      </div>
    </div>`;
  const pPic = panel.querySelector('.cape-panel-pic');
  const pName = panel.querySelector('.cape-panel-name');
  const pStatus = panel.querySelector('.cape-panel-status');
  const pFacts = panel.querySelector('.cape-panel-facts');
  let openCard = null;

  const none = 'not written yet';
  function ownersText(o) {
    if (!o) return none;
    if (typeof o === 'string') return o;
    if (o.count == null) return o.note || none;
    const note = [o.source, o.asOf].filter(Boolean).join(', ');
    return `about ${Number(o.count).toLocaleString('en-US')} accounts${note ? ` (${note})` : ''}`;
  }

  function fill(card) {
    const c = capeById[card.dataset.id];
    const own = ownedNow.has(c.id);
    pPic.textContent = '';
    const src = card.querySelector('canvas, img');
    const big = src.cloneNode(true);
    if (big.tagName === 'CANVAS') big.getContext('2d').drawImage(src, 0, 0);
    big.removeAttribute('loading');
    pPic.classList.toggle('missing', !own);
    pPic.appendChild(big);
    pName.textContent = c.name;
    pStatus.textContent = own ? 'you have this one' : "you don't have this one";
    pStatus.classList.toggle('have', own);
    panel.setAttribute('aria-label', `${c.name} details`);
    pFacts.textContent = '';
    [
      ['how to get it', c.how],
      ['history', c.history],
      ['owners', ownersText(c.owners)],
    ].forEach(([k, v]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = k;
      dd.textContent = v || none;
      if (!v || v === none) dd.className = 'empty';
      row.append(dt, dd);
      pFacts.appendChild(row);
    });
  }

  // the panel sits after the last card that shares the clicked card's row
  function place(card) {
    let last = card;
    let next = card.nextElementSibling;
    while (
      next &&
      next !== panel &&
      next.classList.contains('cape-card') &&
      Math.abs(next.offsetTop - card.offsetTop) < 4
    ) {
      last = next;
      next = next.nextElementSibling;
    }
    if (last.nextElementSibling !== panel) last.after(panel);
    const pr = panel.getBoundingClientRect();
    const cr = card.getBoundingClientRect();
    panel.style.setProperty('--notch-x', `${cr.left + cr.width / 2 - pr.left}px`);
  }

  function setOpen(card) {
    if (openCard) {
      openCard.classList.remove('selected');
      openCard.setAttribute('aria-expanded', 'false');
    }
    openCard = card;
    if (card) {
      card.classList.add('selected');
      card.setAttribute('aria-expanded', 'true');
      card.setAttribute('aria-controls', 'cape-panel');
    }
  }

  // simple on purpose: one panel, closing and opening are instant
  function closePanel() {
    setOpen(null);
    panel.remove();
  }

  function openPanel(card) {
    setOpen(card);
    fill(card);
    place(card);
  }

  list.addEventListener('click', (e) => {
    const card = e.target.closest('.cape-card');
    if (!card) return;
    if (card === openCard) closePanel();
    else openPanel(card);
  });

  function closeAndRefocus() {
    const was = openCard;
    closePanel();
    if (was) was.focus();
  }

  panel.querySelector('.cape-panel-close').addEventListener('click', closeAndRefocus);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openCard) closeAndRefocus();
  });
  window.addEventListener('resize', () => {
    if (openCard && panel.isConnected) place(openCard);
  });

  // ---- edition switch: fade out, swap, glide the height, fade in ----
  const stage = document.createElement('div');
  stage.className = 'cape-stage';
  list.parentNode.insertBefore(stage, list);
  stage.append(summary, list);

  const edition = document.getElementById('cape-edition');
  const links = [...document.querySelectorAll('.cape-edition-link')];
  const names = { minecraft: 'java', dungeons: 'dungeons', dungeons2: 'dungeons II' };
  let current = 'minecraft';
  let busy = false;

  // text leaves upward, then comes back up from below (same rise as .reveal)
  function enter(el) {
    el.classList.add('swap-in');
    void el.offsetWidth;
    el.classList.remove('swap-in');
  }

  function swapText(el, text, delay) {
    el.classList.add('swap-out');
    setTimeout(() => {
      el.textContent = text;
      el.classList.remove('swap-out');
      enter(el);
    }, delay);
  }

  function switchTo(key) {
    if (key === current || busy) return;
    busy = true;
    current = key;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = reduce ? 0 : 220;
    swapText(edition, names[key], t);
    links.forEach((l) => {
      const on = l.dataset.edition === key;
      l.classList.toggle('active', on);
      l.setAttribute('aria-pressed', on);
    });

    stage.style.height = stage.offsetHeight + 'px';
    stage.classList.add('swapping');
    summary.classList.add('swap-out');
    setTimeout(() => {
      render(key);
      summary.classList.remove('swap-out');
      enter(summary);
      stage.style.height = stage.scrollHeight + 'px';
      stage.classList.remove('swapping');
      setTimeout(() => {
        stage.style.height = '';
        busy = false;
      }, reduce ? 0 : 450);
    }, t);
  }

  links.forEach((l) => l.addEventListener('click', () => switchTo(l.dataset.edition)));

  render(current);
})();
