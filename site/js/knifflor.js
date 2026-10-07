/**
 * knifflor - Kniffel-Zählblock.
 *
 * Jede Spalte ist ein Spiel. Nur das jüngste Spiel lässt sich bearbeiten,
 * abgeschlossene Spiele stehen fest. Regeln, Darstellung und Speicherung
 * laufen vollständig im Browser; der Spielstand liegt als JSON im
 * localStorage, der Server sieht ihn nie.
 */
(() => {
  'use strict';

  const STORAGE_KEY = 'knifflor.game';
  const SCHEMA_VERSION = 3;

  const BONUS_THRESHOLD = 63;
  const BONUS_VALUE = 35;

  const MAX_GAMES = 20;

  /** Oberer Block: nur Vielfache der Augenzahl, höchstens fünf Würfel. */
  const UPPER = [
    { key: 'einser', label: 'Einser', face: 1 },
    { key: 'zweier', label: 'Zweier', face: 2 },
    { key: 'dreier', label: 'Dreier', face: 3 },
    { key: 'vierer', label: 'Vierer', face: 4 },
    { key: 'fuenfer', label: 'Fünfer', face: 5 },
    { key: 'sechser', label: 'Sechser', face: 6 },
  ];

  /** Unterer Block. 'sum' = Summe aller fünf Würfel, 'fixed' = fester Wert. */
  const LOWER = [
    { key: 'dreierpasch', label: 'Dreierpasch', type: 'sum', hint: 'Summe aller Würfel' },
    { key: 'viererpasch', label: 'Viererpasch', type: 'sum', hint: 'Summe aller Würfel' },
    { key: 'fullHouse', label: 'Full House', type: 'fixed', value: 25 },
    { key: 'kleineStrasse', label: 'Kleine Straße', type: 'fixed', value: 30 },
    { key: 'grosseStrasse', label: 'Große Straße', type: 'fixed', value: 40 },
    { key: 'kniffel', label: 'Kniffel', type: 'fixed', value: 50 },
    { key: 'chance', label: 'Chance', type: 'sum', hint: 'Summe aller Würfel' },
  ];

  const DICE_MIN = 5; // fünf Einsen
  const DICE_MAX = 30; // fünf Sechsen

  const ALL_FIELDS = [...UPPER, ...LOWER];
  const ALL_KEYS = ALL_FIELDS.map((field) => field.key);

  const OPEN_MARK = '·'; // noch offen
  const STRUCK_MARK = '—'; // gestrichen

  // ---------------------------------------------------------------- Regeln

  /** null (noch offen) und 0 (gestrichen) zählen beide null Punkte. */
  const points = (game, key) => game.scores[key] ?? 0;

  const sumOf = (game, fields) =>
    fields.reduce((total, field) => total + points(game, field.key), 0);

  const upperSum = (game) => sumOf(game, UPPER);
  const bonus = (game) => (upperSum(game) >= BONUS_THRESHOLD ? BONUS_VALUE : 0);
  const upperTotal = (game) => upperSum(game) + bonus(game);
  const lowerTotal = (game) => sumOf(game, LOWER);
  const grandTotal = (game) => upperTotal(game) + lowerTotal(game);

  /** Was im oberen Block noch bis zum Bonus fehlt. */
  const toBonus = (game) => Math.max(0, BONUS_THRESHOLD - upperSum(game));

  /** Der Gesamtpunktestand: alle Spielendsummen zusammen. */
  const overallTotal = () => session.games.reduce((sum, game) => sum + grandTotal(game), 0);

  const openFields = (game) => ALL_KEYS.filter((key) => game.scores[key] == null).length;

  // --------------------------------------------------------------- Zustand

  function emptyScores() {
    return Object.fromEntries(ALL_KEYS.map((key) => [key, null]));
  }

  function newGame() {
    return { startedAt: new Date().toISOString(), scores: emptyScores() };
  }

  /** Setzt alles zurück - der Block beginnt wieder bei Spiel 1. */
  function newSession() {
    return {
      version: SCHEMA_VERSION,
      startedAt: new Date().toISOString(),
      games: [newGame()],
    };
  }

  /**
   * Reine Ansichtssache: gehört nicht in den Spielstand und wird nicht
   * wiederhergestellt. Jeder Aufruf startet ohne Verlauf.
   */
  let showHistory = false;

  /** Nur das jüngste Spiel ist offen, alles davor ist abgeschlossen. */
  const activeIndex = () => session.games.length - 1;
  const isLocked = (index) => index < activeIndex();

  /**
   * Welche Spalten der Block zeigt. Ohne Verlauf bleibt nur das laufende
   * Spiel stehen; gerechnet wird trotzdem über alle, die Gesamtspalte und
   * der Punktestand oben bleiben also vollständig.
   */
  const visibleIndexes = () =>
    showHistory ? session.games.map((_, index) => index) : [activeIndex()];

  // ------------------------------------------------------------- Speichern

  function saveSession() {
    const payload = { ...session, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      showStatus('Gespeichert');
    } catch (err) {
      // Privater Modus oder voller Speicher: weiterspielen geht, nur ohne Netz.
      console.warn('knifflor: Speichern fehlgeschlagen', err);
      showStatus('Speichern nicht möglich - Stand geht beim Neuladen verloren', true);
    }
  }

  /** Übernimmt nur, was als ganze Zahl dasteht - alles andere bleibt offen. */
  function readScores(source) {
    const scores = emptyScores();
    for (const key of ALL_KEYS) {
      const value = source?.[key];
      if (Number.isInteger(value)) scores[key] = value;
    }
    return scores;
  }

  /**
   * Die Spalten hießen schon anders: Schema 1 hatte eine je Spieler,
   * Schema 2 eine je Runde. Die Struktur war immer dieselbe, deshalb wird
   * jede alte Spalte unverändert zu einem Spiel.
   */
  function readColumns(data) {
    for (const field of ['games', 'rounds', 'players']) {
      if (Array.isArray(data[field]) && data[field].length > 0) return data[field];
    }
    return null;
  }

  /**
   * Liest den Spielstand und bringt ihn in Form. Kaputte oder fremde Daten
   * sollen die App nicht lahmlegen, deshalb wird jedes Feld einzeln geprüft.
   */
  function loadSession() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.warn('knifflor: Lesen fehlgeschlagen', err);
      return null;
    }
    if (!raw) return null;

    try {
      const data = JSON.parse(raw);
      if (!data) return null;

      const columns = readColumns(data);
      if (!columns) return null;

      const games = columns.slice(0, MAX_GAMES).map((entry) => ({
        startedAt: entry?.startedAt ?? data.startedAt ?? new Date().toISOString(),
        scores: readScores(entry?.scores),
      }));

      return {
        version: SCHEMA_VERSION,
        startedAt: data.startedAt ?? new Date().toISOString(),
        games,
      };
    } catch (err) {
      console.warn('knifflor: Spielstand unlesbar, starte neu', err);
      return null;
    }
  }

  let session = loadSession() ?? newSession();

  // ----------------------------------------------------------- Darstellung

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /** Auswahlfeld für Felder mit abzählbar vielen gültigen Werten. */
  function makeSelect(values, current, onChange) {
    const select = el('select', 'form-select form-select-sm score-input');

    const open = el('option', null, OPEN_MARK);
    open.value = '';
    select.append(open);

    const struck = el('option', null, STRUCK_MARK);
    struck.value = '0';
    struck.title = 'Gestrichen';
    select.append(struck);

    for (const value of values) {
      const option = el('option', null, String(value));
      option.value = String(value);
      select.append(option);
    }

    select.value = current == null ? '' : String(current);
    select.addEventListener('change', () => {
      onChange(select.value === '' ? null : Number(select.value));
    });
    return select;
  }

  /** Zahlenfeld für Würfelsummen: leer, 0 (gestrichen) oder 5 bis 30. */
  function makeNumberInput(current, onChange) {
    const input = el('input', 'form-control form-control-sm score-input');
    input.type = 'number';
    input.inputMode = 'numeric';
    input.min = '0';
    input.max = String(DICE_MAX);
    input.placeholder = OPEN_MARK;
    input.value = current == null ? '' : String(current);

    input.addEventListener('change', () => {
      if (input.value.trim() === '') {
        input.classList.remove('is-invalid');
        onChange(null);
        return;
      }

      let value = Math.round(Number(input.value));
      if (!Number.isFinite(value)) value = 0;
      value = Math.min(DICE_MAX, Math.max(0, value));
      input.value = String(value);

      // 1 bis 4 lässt sich mit fünf Würfeln nicht legen. Markieren, aber nicht
      // überschreiben - die Eingabe gehört den Spielenden.
      input.classList.toggle('is-invalid', value > 0 && value < DICE_MIN);
      onChange(value);
    });

    return input;
  }

  /** Abgeschlossene Spiele werden nur noch gelesen, nicht mehr getippt. */
  function lockedCell(value) {
    const cell = el('td', 'sheet-locked');
    if (value == null) cell.append(el('span', 'score-locked text-body-secondary', OPEN_MARK));
    else if (value === 0) cell.append(el('span', 'score-locked text-body-secondary', STRUCK_MARK));
    else cell.append(el('span', 'score-locked', String(value)));
    return cell;
  }

  function fieldCell(field, game, index) {
    const value = game.scores[field.key];
    if (isLocked(index)) return lockedCell(value);

    const cell = el('td');
    const onChange = (next) => {
      game.scores[field.key] = next;
      saveSession();
      renderTotals();
    };

    if (field.face) {
      const values = [1, 2, 3, 4, 5].map((count) => count * field.face);
      cell.append(makeSelect(values, value, onChange));
    } else if (field.type === 'fixed') {
      cell.append(makeSelect([field.value], value, onChange));
    } else {
      cell.append(makeNumberInput(value, onChange));
    }
    return cell;
  }

  function labelCell(field) {
    const cell = el('th', 'sheet-label');
    cell.scope = 'row';
    cell.append(el('span', 'sheet-name', field.label));

    let hint = field.hint;
    if (!hint && field.type === 'fixed') hint = field.value + ' Punkte';
    if (!hint && field.face) hint = 'nur ' + field.face + 'er';
    if (hint) cell.append(el('span', 'sheet-hint', hint));

    return cell;
  }

  /** Zelle der Gesamtspalte - wird in renderTotals() gefüllt. */
  function overallCell(kind, key) {
    const cell = el('td', 'sheet-value sheet-overall');
    cell.dataset.overall = kind;
    cell.dataset.key = key;
    return cell;
  }

  /** Eingabezeile: Kategorie, eine Zelle je Spiel, Summe über alle Spiele. */
  function fieldRow(field) {
    const row = el('tr');
    row.append(labelCell(field));
    for (const index of visibleIndexes()) row.append(fieldCell(field, session.games[index], index));
    row.append(overallCell('field', field.key));
    return row;
  }

  /** Berechnete Zeile - nie editierbar, immer aus den Regeln abgeleitet. */
  function totalRow(label, key, variant) {
    const row = el('tr', variant ? 'sheet-total sheet-total-' + variant : 'sheet-total');
    row.dataset.total = key;

    const head = el('th', 'sheet-label');
    head.scope = 'row';
    head.append(el('span', 'sheet-name', label));
    row.append(head);

    for (const index of visibleIndexes()) {
      const cell = el('td', 'sheet-value');
      cell.dataset.game = String(index);
      row.append(cell);
    }

    row.append(overallCell('total', key));
    return row;
  }

  function renderHead(table) {
    const thead = el('thead');
    const row = el('tr');

    const corner = el('th', 'sheet-label');
    corner.scope = 'col';
    corner.append(el('span', 'sheet-name', 'Kategorie'));
    row.append(corner);

    for (const index of visibleIndexes()) {
      const cell = el('th', 'sheet-game');
      cell.scope = 'col';
      cell.append(el('span', 'sheet-name', 'Spiel ' + (index + 1)));

      if (isLocked(index)) {
        cell.classList.add('is-locked');
        cell.append(el('span', 'sheet-hint', 'abgeschlossen'));
      } else {
        cell.classList.add('is-active');
        cell.append(el('span', 'sheet-hint', 'läuft'));
      }
      row.append(cell);
    }

    const overall = el('th', 'sheet-game sheet-overall');
    overall.scope = 'col';
    overall.append(el('span', 'sheet-name', 'Gesamt'));
    overall.append(el('span', 'sheet-hint', 'alle Spiele'));
    row.append(overall);

    thead.append(row);
    table.append(thead);
  }

  function renderBody(table) {
    const upper = el('tbody');
    for (const field of UPPER) upper.append(fieldRow(field));
    upper.append(totalRow('Zwischensumme', 'upperSum'));
    upper.append(totalRow('Bonus ab ' + BONUS_THRESHOLD, 'bonus'));
    upper.append(totalRow('Summe oberer Block', 'upperTotal', 'section'));
    table.append(upper);

    const lower = el('tbody');
    for (const field of LOWER) lower.append(fieldRow(field));
    lower.append(totalRow('Summe unterer Block', 'lowerTotal', 'section'));
    lower.append(totalRow('Endsumme', 'grandTotal', 'grand'));
    table.append(lower);
  }

  const TOTALS = { upperSum, bonus, upperTotal, lowerTotal, grandTotal };

  /** Schreibt alle berechneten Zellen neu - der einzige Weg, wie Summen entstehen. */
  function renderTotals() {
    const best = Math.max(...session.games.map(grandTotal));

    // Summe je Kategorie über alle Spiele
    for (const field of ALL_FIELDS) {
      const cell = document.querySelector('[data-overall="field"][data-key="' + field.key + '"]');
      if (!cell) continue;
      cell.textContent = String(
        session.games.reduce((sum, game) => sum + points(game, field.key), 0),
      );
    }

    for (const [key, compute] of Object.entries(TOTALS)) {
      const row = document.querySelector('[data-total="' + key + '"]');
      if (!row) continue;

      for (const index of visibleIndexes()) {
        const game = session.games[index];
        const cell = row.querySelector('[data-game="' + index + '"]');
        if (!cell) continue;

        const value = compute(game);
        cell.textContent = String(value);

        if (key === 'bonus') {
          const missing = toBonus(game);
          cell.title = missing > 0 ? 'noch ' + missing + ' bis zum Bonus' : 'Bonus erreicht';
          cell.classList.toggle('bonus-reached', value > 0);
        }
        if (key === 'grandTotal') {
          // Ohne Verlauf gibt es nichts zu vergleichen.
          const compare = showHistory && session.games.length > 1;
          cell.classList.toggle('is-best', compare && best > 0 && value === best);
        }
      }

      const overall = row.querySelector('[data-overall="total"]');
      if (overall) {
        overall.textContent = String(
          session.games.reduce((sum, game) => sum + compute(game), 0),
        );
      }
    }

    renderScoreboard();
  }

  /** Die große Zahl über dem Block. */
  function renderScoreboard() {
    const total = document.getElementById('overall-total');
    if (total) total.textContent = String(overallTotal());

    const meta = document.getElementById('overall-meta');
    if (meta) {
      const count = session.games.length;
      const open = openFields(session.games[activeIndex()]);
      const parts = [count === 1 ? '1 Spiel' : count + ' Spiele'];
      if (open === 0) parts.push('Spiel ' + count + ' vollständig');
      else parts.push(open === 1 ? '1 Feld offen' : open + ' Felder offen');
      meta.textContent = parts.join(' · ');
    }
  }

  function render(scrollToEnd) {
    const host = document.getElementById('sheet');
    if (!host) return;

    host.replaceChildren();

    const table = el('table', 'table table-sm align-middle sheet');
    renderHead(table);
    renderBody(table);
    host.append(table);

    const addButton = document.getElementById('new-game');
    if (addButton) addButton.disabled = session.games.length >= MAX_GAMES;

    renderTotals();

    // Das frische Spiel steht ganz rechts und wäre sonst aus dem Bild.
    if (scrollToEnd) host.scrollLeft = host.scrollWidth;
  }

  let statusTimer = null;
  function showStatus(message, sticky) {
    const node = document.getElementById('status');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('text-danger', Boolean(sticky));
    clearTimeout(statusTimer);
    if (!sticky) {
      statusTimer = setTimeout(() => {
        node.textContent = '';
      }, 1500);
    }
  }

  // -------------------------------------------------------------- Bedienung

  document.getElementById('new-game')?.addEventListener('click', () => {
    if (session.games.length >= MAX_GAMES) return;

    // Abschließen ist endgültig, deshalb bei Lücken einmal nachfragen.
    const open = openFields(session.games[activeIndex()]);
    if (open > 0) {
      const message =
        'In Spiel ' + session.games.length + ' sind noch ' + open + ' Felder offen.\n\n' +
        'Mit einem neuen Spiel wird es abgeschlossen und lässt sich nicht mehr ändern. Fortfahren?';
      if (!confirm(message)) return;
    }

    session.games.push(newGame());
    saveSession();
    render(true);
  });

  document.getElementById('show-history')?.addEventListener('change', (event) => {
    showHistory = event.target.checked;
    render(!showHistory);
  });

  document.getElementById('restart')?.addEventListener('click', () => {
    if (!confirm('Neu starten? Alle Spiele werden gelöscht.')) return;
    session = newSession();
    saveSession();
    render();
  });

  render();
})();
