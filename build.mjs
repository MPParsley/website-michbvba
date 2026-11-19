import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const output = 'dist';
const url = new URL(process.env.SITE_URL || 'https://michbvba.be');
if (!['https:', 'http:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) {
  throw new Error('SITE_URL moet een HTTP(S)-adres zonder query of fragment zijn.');
}
const base = url.pathname.replace(/\/+$/, '');
const preview = process.env.SITE_PREVIEW === '1';
const local = (route) => base + route;
const absolute = (route) => url.origin + local(route);
const escape = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const link = (label, href, attributes = '') => `<a href="${escape(href)}"${attributes ? ' ' + attributes : ''}>${escape(label)}</a>`;

const markdown = new MarkdownIt({ html: false });
for (const [rule, attribute] of [['link_open', 'href'], ['image', 'src']]) {
  const fallback = markdown.renderer.rules[rule] ?? ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  markdown.renderer.rules[rule] = (tokens, index, options, env, self) => {
    const value = tokens[index].attrGet(attribute);
    if (value?.startsWith('/') && !value.startsWith('//')) tokens[index].attrSet(attribute, local(value));
    return fallback(tokens, index, options, env, self);
  };
}

async function loadMarkdown(filename) {
  const raw = await readFile(filename, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error(`Metadata ontbreekt in ${filename}`);
  return { ...JSON.parse(match[1]), body: match[2].trim() };
}

async function loadPages(directory, prefix = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = await Promise.all(entries.map(async entry => {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) return loadPages(file, prefix + entry.name + '/');
    if (!entry.name.endsWith('.md') || entry.name.startsWith('_')) return [];
    const slug = entry.name === 'index.md' ? '' : entry.name.slice(0, -3) + '/';
    return [{ ...await loadMarkdown(file), route: '/' + prefix + slug }];
  }));
  return result.flat();
}

const site = await loadMarkdown('content/_site.md');
const allPages = await loadPages('content');
const pages = new Map(allPages.map(page => [page.route, page]));
const redirects = JSON.parse(await readFile('redirects.json', 'utf8'));
const files = '/sites/default/files/';
const logo = files + 'michbvba.png';
const mapURL = 'https://www.google.com/maps/search/?api=1&query='
  + encodeURIComponent(`${site.name}, ${site.street}, ${site.postalCode} ${site.city}`);
const navigation = [
  ['Projecten', '/projecten/'], ['Manuals', '/manuals/'], ['Partners', '/partners/'],
  ['MiCH lite', 'https://michlite.com/'], ['Contact', '/contact/'],
];
const organization = {
  '@type': 'LocalBusiness',
  '@id': absolute('/#mich'),
  name: site.name,
  description: pages.get('/').description,
  url: absolute('/'),
  logo: absolute(logo),
  telephone: site.telephone,
  email: site.email,
  vatID: site.vat,
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.street,
    postalCode: site.postalCode,
    addressLocality: site.city,
    addressCountry: site.countryCode,
  },
  hasMap: mapURL,
};
const website = {
  '@type': 'WebSite', '@id': absolute('/#website'), url: absolute('/'),
  name: site.name, inLanguage: 'nl-BE', publisher: { '@id': organization['@id'] },
};

function breadcrumb(page) {
  if (page.route === '/') return [];
  const parents = page.route.split('/').filter(Boolean).slice(0, -1);
  const result = [{ name: 'Home', route: '/' }];
  if (page.kind === 'manual') result.push({ name: 'Manuals', route: '/manuals/' });
  for (const [index] of parents.entries()) {
    const route = '/' + parents.slice(0, index + 1).join('/') + '/';
    if (pages.has(route)) result.push({ name: pages.get(route).title, route });
  }
  return [...result, { name: page.kind === 'contact' ? 'Contact' : page.title, route: page.route }];
}

function structuredData(page, crumbs) {
  const graph = [
    organization, website,
    {
      '@type': page.kind === 'contact' ? 'ContactPage' : 'WebPage',
      '@id': absolute(page.route + '#webpage'),
      url: absolute(page.route), name: page.title, description: page.description,
      inLanguage: 'nl-BE', isPartOf: { '@id': website['@id'] },
      about: { '@id': organization['@id'] },
    },
  ];
  if (crumbs.length) graph.push({
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(({ name, route }, index) => ({
      '@type': 'ListItem', position: index + 1, name, item: absolute(route),
    })),
  });
  if (page.kind === 'project') graph.push({
    '@type': 'Article', headline: page.title, description: page.description,
    image: page.gallery.map(({image}) => absolute(image)),
    author: { '@id': organization['@id'] }, publisher: { '@id': organization['@id'] },
    mainEntityOfPage: { '@id': absolute(page.route + '#webpage') },
  });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
}

const image = (src, alt, extra = '') => `<img src="${escape(local(src))}" alt="${escape(alt)}" ${extra}>`;
const thumb = (src) => src.replace(/\.webp$/, '-thumb.webp');
const label = (value) => `<p class="eyebrow">${escape(value)}</p>`;

function header(page) {
  return `<a class="skip" href="#inhoud">Naar de inhoud</a>
<header class="site-header"><div class="wrap header-inner">
  <a class="brand" href="${local('/')}" aria-label="${escape(site.name)} · Home">${image(logo, '', 'width="64" height="64"')}<span>${escape(site.name)}<small>${escape(site.tagline)}</small></span></a>
  <nav aria-label="Hoofdnavigatie"><ul>${navigation.map(([name, target]) => {
    const internal = target.startsWith('/');
    const current = page.route === target ? 'aria-current="page"' : '';
    const active = page.route.startsWith(target) || (page.kind === 'manual' && target === '/manuals/');
    return `<li>${link(name, internal ? local(target) : target, [current, active ? 'class="active"' : ''].filter(Boolean).join(' '))}</li>`;
  }).join('')}</ul></nav>
</div></header>`;
}

function contactDetails() {
  return `<address><strong>${escape(site.name)}</strong><br>${escape(site.street)}<br>${escape(site.postalCode)} ${escape(site.city)}, ${escape(site.country)}</address>
<ul class="contact-links"><li>${link(site.email, 'mailto:' + site.email)}</li><li>${link(site.phone, 'tel:' + site.telephone)}</li><li>Btw ${escape(site.vat)}</li></ul>`;
}

function footer() {
  return `<footer class="footer"><div class="wrap footer-grid">
<div>${link(site.name, local('/'), 'class="footer-brand"')}<p>${escape(site.tagline)}</p></div>
<div>${contactDetails()}</div>
<nav aria-label="Navigatie onderaan"><ul>${navigation.map(([name, route]) => `<li>${link(name, route.startsWith('/') ? local(route) : route)}</li>`).join('')}</ul></nav>
</div><div class="wrap copyright">${escape(site.copyright)}</div></footer>`;
}

function cards(items, heading = 'h2') {
  return `<ul class="card-grid">${items.map(({ url: target, image: src }) => {
    const item = pages.get(target);
    return `<li><a class="card" href="${local(target)}">
    ${src ? image(thumb(src), '', 'loading="lazy" decoding="async"') : ''}
    <div class="card-text"><${heading}>${escape(item.title)}</${heading}><p>${escape(item.description)}</p></div></a></li>`;
  }).join('')}</ul>`;
}

function gallery(page) {
  if (!page.gallery.length) return '';
  return `<section class="gallery-section" aria-labelledby="foto-kop"><h2 id="foto-kop">Projectfoto’s</h2>
<ul class="gallery">${page.gallery.map(({image: src, caption}) => `<li><figure><a href="${escape(local(src))}" aria-label="${escape('Vergroot foto · ' + caption)}">${image(thumb(src), caption, 'loading="lazy" decoding="async"')}</a><figcaption>${escape(caption)}</figcaption></figure></li>`).join('')}</ul>
<dialog class="lightbox" aria-labelledby="foto-bijschrift"><div class="lightbox-controls">
<button type="button" data-photo="previous">Vorige</button><span class="photo-count" aria-live="polite"></span><button type="button" data-photo="next">Volgende</button><button type="button" data-photo="close">Sluiten</button>
</div><figure><img alt=""><figcaption id="foto-bijschrift"></figcaption></figure></dialog>
<script src="${local('/assets/gallery.js')}" defer></script></section>`;
}

function contactPanel() {
  return `<section class="contact-panel" aria-labelledby="contact-titel"><div class="contact-details">
<h2 id="contact-titel">Adres en contact</h2>${contactDetails()}
${link('Open route in Google Maps', mapURL, 'class="button button-dark"')}</div>
<iframe class="map" title="Kaart met de locatie van MiCH bvba in Mechelen" src="${escape(site.mapEmbed)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></section>`;
}

function home(page) {
  return `<main id="inhoud" tabindex="-1">
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy">${label(site.name + ' · ' + site.city)}<h1>${escape(page.title)}</h1>
  ${markdown.render(page.body)}
  <div class="actions">${link('Bekijk projecten', local('/projecten/'), 'class="button button-primary"')}${link('Neem contact op', local('/contact/'), 'class="button button-outline"')}</div></div>
  <div class="hero-media">${image(page.image, 'Motorjacht, uit de categorie Marine', 'fetchpriority="high"')}</div>
</div></section>
<section class="wrap home-projects" aria-labelledby="projecten-titel"><div class="section-title"><h2 id="projecten-titel">Projecten</h2>${link('Alle projecten', local('/projecten/'))}</div>
${cards(pages.get('/projecten/').categories, 'h3')}
</section>
<div class="wrap home-contact">${contactPanel()}</div>
</main>`;
}

function interior(page, crumbs) {
  const intro = markdown.render(page.body);
  let content = intro;
  if (page.kind === 'contact') content = contactPanel();
  if (page.kind === 'overview') content = cards(page.categories);
  if (page.kind === 'category') content = cards(page.projects.map(route => ({url: route, image: pages.get(route).gallery[0]?.image})));
  if (page.kind === 'project') content += gallery(page);
  if (page.kind === 'partners') content += `<ul class="partners">${page.partners.map(partner => `<li><a href="${escape(partner.url)}">${image(partner.image, '', 'loading="lazy" decoding="async"')}<span>${escape(partner.name)}</span></a></li>`).join('')}</ul>`;
  const introInHeader = ['overview', 'category'].includes(page.kind);
  return `<main id="inhoud" tabindex="-1">
  <div class="page-head"><div class="wrap">
  ${crumbs.length ? `<nav class="breadcrumbs" aria-label="Broodkruimel"><ol>${crumbs.map((crumb, index) => `<li>${index === crumbs.length - 1 ? `<span aria-current="page">${escape(crumb.name)}</span>` : link(crumb.name, local(crumb.route))}</li>`).join('')}</ol></nav>` : ''}
  <h1>${escape(page.title)}</h1>${introInHeader ? intro : ''}</div></div>
  <div class="wrap page-content">${content}</div></main>`;
}

function document(page) {
  const crumbs = breadcrumb(page);
  let title = page.kind === 'contact' ? 'Contact' : page.title;
  if (page.kind === 'category') title += ' – projecten';
  title += ` | ${site.name}`;
  const cover = page.image ?? page.gallery?.[0]?.image ?? logo;
  return `<!doctype html>
<html lang="nl-BE"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(page.description)}">
<meta name="robots" content="${preview || page.kind === 'error' ? 'noindex, follow' : 'index, follow, max-image-preview:large'}">
${page.kind === 'error' ? '' : `<link rel="canonical" href="${escape(absolute(page.route))}">`}
<meta property="og:type" content="${page.kind === 'project' ? 'article' : 'website'}"><meta property="og:locale" content="nl_BE">
<meta property="og:site_name" content="${escape(site.name)}"><meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(page.description)}"><meta property="og:url" content="${escape(absolute(page.route))}">
<meta property="og:image" content="${escape(absolute(cover))}">
<meta name="twitter:card" content="${cover === logo ? 'summary' : 'summary_large_image'}">
<link rel="icon" href="${local(files + 'favicon.ico')}"><link rel="stylesheet" href="${local('/assets/site.css')}">
${page.kind === 'error' ? '' : `<script type="application/ld+json">${structuredData(page, crumbs)}</script>`}
</head><body>${header(page)}${page.kind === 'home' ? home(page) : interior(page, page.kind === 'error' ? [] : crumbs)}${footer()}</body></html>\n`;
}

async function write(file, body) {
  const destination = path.join(output, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, body);
}

function rss(title, route, routes = []) {
  const items = routes.map(target => {
    const page = pages.get(target);
    const address = escape(absolute(target));
    return `<item><title>${escape(page.title)}</title><link>${address}</link><guid>${address}</guid><description>${escape(page.description)}</description></item>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>
<title>${escape(title)}</title><link>${escape(absolute(route))}</link><description>${escape(site.tagline)}</description><language>nl-BE</language>
${items.join('\n')}
</channel></rss>\n`;
}

if (pages.size !== allPages.length) throw new Error('Twee Markdown-bestanden gebruiken dezelfde URL.');
await rm(output, { recursive: true, force: true });
await mkdir(output);
await Promise.all([cp('public', output, { recursive: true }), cp('assets', path.join(output, 'assets'), { recursive: true })]);
await Promise.all(allPages.map(page => write(page.route.slice(1) + 'index.html', document(page))));
await Promise.all(Object.entries(redirects).map(([from, to]) => {
  if (!pages.has(to) || pages.has(from)) throw new Error(`Ongeldige doorverwijzing ${from} → ${to}`);
  return write(from.slice(1) + 'index.html', `<!doctype html><html lang="nl-BE"><head><meta charset="utf-8">
<title>Pagina verhuisd | MiCH bvba</title><meta name="robots" content="noindex, follow">
<link rel="canonical" href="${escape(absolute(to))}"><meta http-equiv="refresh" content="0; url=${escape(local(to))}">
</head><body><main><h1>Pagina verhuisd</h1><p>${link('Ga naar ' + pages.get(to).title, local(to))}</p></main></body></html>\n`);
}));
const feeds = [
  ['Partner', '/partners/', [...pages.keys()].filter(route => route.startsWith('/producten/'))],
  ['Project type', '/projecten/', [...pages.keys()].filter(route => route.startsWith('/project-type/'))],
  ['Projecten', '/projecten/', allPages.filter(page => page.kind === 'project').map(page => page.route)],
  ...['road', 'marine', 'on-grid', 'off-grid'].map(category => {
    const route = `/projecten/${category}/`;
    const page = pages.get(route);
    return [page.title, route, page.projects];
  }),
  ['Product', '/manuals/', ['/product/obpr/']],
];
await Promise.all([
  write('404.html', document({title: 'Pagina niet gevonden', description: 'Deze pagina bestaat niet.', kind: 'error', route: '/404.html', body: '[Ga naar de startpagina](/) of [bekijk de projecten](/projecten/).'})),
  write('robots.txt', `User-agent: *\nAllow: /\n${preview ? '' : 'Sitemap: ' + absolute('/sitemap.xml') + '\n'}`),
  write('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + (preview ? '' : [...pages.keys()].sort().map(route => `  <url><loc>${escape(absolute(route))}</loc></url>\n`).join('')) + '</urlset>\n'),
  write('rss.xml', rss(`${site.name} – ${site.tagline}`, '/')),
  ...feeds.map(([title, route, entries], index) =>
    write(`taxonomy/term/${index + 1}/feed`, rss(title, route, entries))),
]);
console.log(`${pages.size} pagina’s en ${Object.keys(redirects).length} Drupal-doorverwijzingen gebouwd.`);
