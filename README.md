# Butxaca 👛

Control de despeses a l'estil de Monefy: **toca +, tria una categoria i escriu l'import.** Toca el cercle per veure on van els diners.

## Fes-la servir

**https://farrius.github.io/Butxaca/**

- **iPhone (Safari):** Compartir → *Afegir a la pantalla d'inici*
- **Android (Chrome):** ☰ → *Install app on this phone*

S'obre a pantalla completa i funciona sense connexió. Per compartir-la, envia l'enllaç.
De moment les despeses només es guarden al mòbil de cadascú; fes servir ☰ → *Export* com a còpia de seguretat.

## Què fa

- **+ Expense** → categoria → import, moneda, data i nota.
- Categories en cercle al voltant del gràfic; toca'n una per afegir-hi una despesa directament.
- Toca el gràfic per veure el desglossament i esborrar despeses (amb *Undo*).
- **‹ ›** o lliscar sobre el cercle canvia de període; lliscar des de la vora esquerra obre el menú.
- **Menú ☰:** període, moneda principal, categories (afegir, editar nom i emoji, esborrar, arrossegar per reordenar) i exportar a CSV.

## Desenvolupament

```bash
npm install
npm start             # app d'escriptori (Electron)
npm run web           # al navegador → http://localhost:5173
npm test              # tests
npm run build:single  # tota l'app en un sol fitxer HTML a dist/
```

- Tota l'app és a `src/renderer/` (HTML/CSS/JS, sense compilació). Electron (`src/main/`) només l'embolcalla per a l'escriptori.
- Cada push a `main` es publica automàticament a GitHub Pages (`.github/workflows/pages.yml`).
- Si canvies fitxers de `src/renderer/`, puja `VERSION` a `src/renderer/sw.js` perquè els mòbils rebin l'actualització.

## Dades

Cada despesa és una fila, preparada per anar a un full de càlcul:

| id | date | category | amount | currency | note | createdAt |
|----|------|----------|--------|----------|------|-----------|

Els `id` de categoria no canvien mai (les categories esborrades s'arxiven), així que altres apps s'hi poden refiar.

## Properes passes

1. **Google Sheets com a base de dades**, amb inici de sessió de Google des del mateix mòbil.
2. Importar des del full de càlcul.
3. **Despeses recurrents** (lloguer, subscripcions…) afegides cada mes.
4. Apps a l'App Store i a Google Play amb Capacitor.
5. Editar despeses i conversió de monedes.
