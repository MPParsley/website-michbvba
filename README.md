# MiCH bvba

Statische Nederlandstalige site met de publieke pagina’s uit de Drupal-navigatie, de oudere merk- en categoriepagina’s, de projectgalerijen, partnerlogo’s en de OBPR-handleiding.

## Inhoud aanpassen

- `content/index.md` bevat de startpagina.
- `content/_site.md` bevat het adres, de contactlinks, de kaart en de voettekst.
- `content/projecten/` bevat de categorieën en projecten. Voeg een nieuw project toe als Markdown-bestand in de juiste categorie en voeg de URL toe aan de lijst `projects` bovenaan het categorie­bestand.
- `content/partners.md` bevat de partnernamen, afbeeldingen en links. `content/manuals.md` en `content/product/obpr.md` bevatten de documentatie.
- Ieder Markdown-bestand begint met metadata in JSON tussen twee regels met `---`. De paginatekst eronder gebruikt gewone Markdown. Bewaar lokale afbeeldingen en documenten in `public/`. Gebruik in Markdown bijvoorbeeld `/foto.webp` voor `public/foto.webp`.
- De oude Drupal-adressen onder `/node/` staan in `redirects.json`. De overeenkomstige pagina’s leiden door naar hun leesbare URL. De oorspronkelijke PDF-URL blijft rechtstreeks beschikbaar.

## Lokaal bekijken

Gebruik Node.js 22 en npm. Voor de optionele lokale HTTP-server is Python 3 nodig.

```sh
npm ci
SITE_URL=http://127.0.0.1:4173 SITE_PREVIEW=1 npm run build
npm run preview
```

Open [de lokale site](http://127.0.0.1:4173). Bouw opnieuw na een wijziging en vernieuw je browser. De gegenereerde site staat in `dist/`.

## GitHub Pages

1. Plaats deze bronbestanden, inclusief de map `.github`, in de gewenste GitHub-repository.
2. Kies in **Settings → Pages → Build and deployment → Source** voor **GitHub Actions**.
3. Push naar de standaardbranch of voer de workflow **GitHub Pages** handmatig uit op die branch. Pull requests bouwen de site ter controle.
4. Als de site `michbvba.be` moet overnemen, voeg dat domein toe in de Pages-instellingen en volg de [GitHub-instructies voor DNS en HTTPS](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

De workflow gebruikt de Pages-URL voor interne paden, canonieke URL’s, Open Graph, gestructureerde gegevens en de sitemap. Zowel een GitHub-projectpad als een eigen domein wordt ondersteund. Bij een GitHub-projectpad beheert de host de effectieve `robots.txt` op de domeinroot. Zodra de eigen domeinnaam actief is, wordt de meegeleverde `robots.txt` op de domeinroot geserveerd.

GitHub Pages stuurt directory-URL’s door naar de versie met afsluitende slash. Oude Drupal-aliases onder `/node/` gebruiken een statische doorverwijspagina. De site gebruikt geen servercode. De kaart en externe partnerlinks blijven afhankelijk van de externe aanbieders.

## Preview op Sites

```sh
SITE_URL=https://mich-bvba-preview.mich-bv-4396.chatgpt.site SITE_PREVIEW=1 npm run build
```

De preview gebruikt `noindex`. De GitHub Pages-workflow bouwt standaard indexeerbare HTML, met een XML-sitemap en JSON-LD voor bedrijfsgegevens, navigatie en projectpagina’s.
