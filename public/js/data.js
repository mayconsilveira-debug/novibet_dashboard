(function () {
  const cfg = window.SUPABASE_CONFIG;
  if (!cfg || !window.supabase) {
    console.error('[data.js] Missing SUPABASE_CONFIG or supabase-js — check script order in index.html');
    return;
  }

  const client = window.supabase.createClient(cfg.url, cfg.publishableKey);
  const PAGE_SIZE = 1000;

  // Shared cache of fact-table rows, columns pruned to only what the UI needs.
  // Populated once on first call; every downstream function (KPIs, main chart,
  // etc.) reads from here to avoid re-downloading 72k+ rows.
  let _allRowsPromise = null;

  async function fetchAllFactRows() {
    if (_allRowsPromise) return _allRowsPromise;
    _allRowsPromise = (async () => {
      const { count, error: countErr } = await client
        .from('gold_fct_novibet')
        .select('*', { count: 'exact', head: true });
      if (countErr) throw countErr;
      if (!count) return [];

      const pages = Math.ceil(count / PAGE_SIZE);
      const requests = [];
      for (let p = 0; p < pages; p++) {
        const from = p * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;
        requests.push(
          client.from('gold_fct_novibet')
            .select('"Date","Total impressions","Total clicks","Complete","Investiment","Canal","Formato","Pacote","Grupo","Categoria","Pedido"')
            .range(from, to)
        );
      }
      const results = await Promise.all(requests);
      const all = [];
      for (const { data, error } of results) {
        if (error) throw error;
        for (const r of data) all.push(r);
      }
      return all;
    })();
    return _allRowsPromise;
  }

  async function fetchNovibetFacts({ limit = 1000, dateFrom, dateTo } = {}) {
    let q = client.from('gold_fct_novibet').select('*').limit(limit);
    if (dateFrom) q = q.gte('Date', dateFrom);
    if (dateTo) q = q.lte('Date', dateTo);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  async function fetchPacingFacts({ limit = 1000, dateFrom, dateTo } = {}) {
    let q = client.from('gold_fct_pacing_novibet').select('*').limit(limit);
    if (dateFrom) q = q.gte('Date', dateFrom);
    if (dateTo) q = q.lte('Date', dateTo);
    const { data, error } = await q;
    if (error) throw error;
    return data;
  }

  // Pacing table (goal/target rows). Small enough (< 1k rows today) to fit in
  // a single request; cached for the whole session.
  let _allPacingPromise = null;
  async function fetchAllPacingRows() {
    if (_allPacingPromise) return _allPacingPromise;
    _allPacingPromise = (async () => {
      const all = [];
      let from = 0;
      while (true) {
        const { data, error } = await client
          .from('gold_fct_pacing_novibet')
          .select('"Date","Canal","Grupo","Pacote","Pedido","Total impressions"')
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw error;
        for (const r of data) all.push(r);
        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }
      return all;
    })();
    return _allPacingPromise;
  }

  // Narrows rows down to the current period plus any cross-filter dims.
  //   - Period is either a full year OR a [dateFrom, dateTo] range
  //     (date range wins when both are supplied). Dates are ISO strings
  //     (YYYY-MM-DD) so lexical comparison works against row.Date directly.
  //   - `dims` is an optional { canal, grupo, formato, categoria, pacote,
  //     pedido } map of single-value cross-filters. Rows must match every
  //     dim set. Empty / null values are ignored.
  function _filterByPeriod(rows, period) {
    if (!period) return rows;
    const { year, dateFrom, dateTo, dims } = period;
    let filtered = rows;
    if (dateFrom || dateTo) {
      filtered = filtered.filter(r => {
        if (!r.Date) return false;
        if (dateFrom && r.Date < dateFrom) return false;
        if (dateTo && r.Date > dateTo) return false;
        return true;
      });
    } else if (year) {
      filtered = filtered.filter(r => yearOf(r.Date) === year);
    }
    if (dims) {
      const entries = Object.entries(dims).filter(([, v]) => v != null && v !== '');
      if (entries.length) {
        filtered = filtered.filter(r => {
          for (const [dim, val] of entries) {
            const field = DIM_TO_FIELD[dim];
            if (!field) continue;
            if ((r[field] || '—') !== val) return false;
          }
          return true;
        });
      }
    }
    return filtered;
  }

  async function fetchOverviewKPIs(period) {
    const rows = await fetchAllFactRows();
    const filtered = _filterByPeriod(rows, period);
    const totals = { impressions: 0, clicks: 0, views: 0, invest: 0 };
    for (const r of filtered) {
      totals.impressions += r['Total impressions'] || 0;
      totals.clicks += r['Total clicks'] || 0;
      totals.views += r['Complete'] || 0;
      totals.invest += r['Investiment'] || 0;
    }
    totals.ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    totals.rowCount = filtered.length;
    return totals;
  }

  // Functions that used to accept a raw `year` now accept either a year
  // number (legacy) OR a period object like { dateFrom, dateTo } / { year }.
  // This helper normalizes the caller's arg to a period.
  function _periodFromArg(arg) {
    if (arg && typeof arg === 'object') return arg;
    if (typeof arg === 'number') return { year: arg };
    return null;
  }

  // Metric extraction per row — centralizes the column-name mapping so the
  // rest of the code uses friendly names (impressions, clicks, views, invest).
  function rowMetric(row, metric) {
    switch (metric) {
      case 'impressions': return row['Total impressions'] || 0;
      case 'clicks':      return row['Total clicks'] || 0;
      case 'views':       return row['Complete'] || 0;
      case 'invest':      return row['Investiment'] || 0;
      default:            return 0;
    }
  }

  function isoWeek(d) {
    const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week: weekNum };
  }

  // Turns per-row sums into (impressions, clicks, views, ctr) — the chart only
  // ever asks for one metric at a time, but we compute CTR on the fly from the
  // grouped sums.
  function finalizeMetric(group, metric) {
    if (metric === 'ctr') {
      return group.impressions > 0 ? (group.clicks / group.impressions) * 100 : 0;
    }
    return group[metric] || 0;
  }

  function emptyGroup() {
    return { impressions: 0, clicks: 0, views: 0, invest: 0 };
  }

  function addRowToGroup(group, row) {
    group.impressions += row['Total impressions'] || 0;
    group.clicks      += row['Total clicks'] || 0;
    group.views       += row['Complete'] || 0;
    group.invest      += row['Investiment'] || 0;
  }

  function aggregateByYear(rows, metric) {
    const buckets = new Map();
    for (const r of rows) {
      if (!r.Date) continue;
      const y = r.Date.slice(0, 4);
      if (!buckets.has(y)) buckets.set(y, emptyGroup());
      addRowToGroup(buckets.get(y), r);
    }
    const years = [...buckets.keys()].sort();
    return {
      labels: years,
      values: years.map(y => finalizeMetric(buckets.get(y), metric))
    };
  }

  const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  function aggregateByMonth(rows, metric, year) {
    // Defaults to the latest year present in the data. Returns all 12 months
    // so the chart always shows Jan..Dez (months with no data show as 0).
    if (!year) {
      let maxYear = 0;
      for (const r of rows) {
        if (!r.Date) continue;
        const y = +r.Date.slice(0, 4);
        if (y > maxYear) maxYear = y;
      }
      year = maxYear || new Date().getUTCFullYear();
    }
    const buckets = Array.from({ length: 12 }, emptyGroup);
    for (const r of rows) {
      if (!r.Date) continue;
      if (+r.Date.slice(0, 4) !== year) continue;
      const m = +r.Date.slice(5, 7) - 1;
      addRowToGroup(buckets[m], r);
    }
    return {
      labels: MONTH_LABELS,
      values: buckets.map(g => finalizeMetric(g, metric)),
      year
    };
  }

  function aggregateByWeek(rows, metric, weeksBack = 12) {
    // Last `weeksBack` ISO weeks ending at the latest date present in data.
    // Keyed by year-week so weeks spanning year boundaries don't collapse.
    let latestDate = null;
    for (const r of rows) {
      if (!r.Date) continue;
      const d = new Date(r.Date + 'T00:00:00Z');
      if (!latestDate || d > latestDate) latestDate = d;
    }
    if (!latestDate) return { labels: [], values: [] };

    const endIso = isoWeek(latestDate);

    // Walk back `weeksBack` ISO weeks from the end.
    const windowKeys = [];
    const cursor = new Date(latestDate);
    for (let i = 0; i < weeksBack; i++) {
      const iw = isoWeek(cursor);
      windowKeys.unshift(`${iw.year}-${String(iw.week).padStart(2, '0')}`);
      cursor.setUTCDate(cursor.getUTCDate() - 7);
    }

    const buckets = new Map(windowKeys.map(k => [k, emptyGroup()]));
    for (const r of rows) {
      if (!r.Date) continue;
      const iw = isoWeek(new Date(r.Date + 'T00:00:00Z'));
      const k = `${iw.year}-${String(iw.week).padStart(2, '0')}`;
      if (buckets.has(k)) addRowToGroup(buckets.get(k), r);
    }

    return {
      labels: windowKeys.map(k => 'S' + +k.slice(5)),
      values: windowKeys.map(k => finalizeMetric(buckets.get(k), metric))
    };
  }

  async function aggregateByDrill(metric, drill) {
    const rows = await fetchAllFactRows();
    if (drill === 'ano') return aggregateByYear(rows, metric);
    if (drill === 'mes') return aggregateByMonth(rows, metric);
    if (drill === 'semana') return aggregateByWeek(rows, metric, 12);
    return { labels: [], values: [] };
  }

  // --- Overview table + mini charts --------------------------------------

  // Groups fact rows by an arbitrary dimension (Canal / Pacote / Formato),
  // filtered by year, returning the shape the overview table expects:
  // [{ name, investimento, impressions, clicks, views, ctr, children }, ...]
  //
  // If `childField` is provided, each group also gets a `children` array
  // aggregating the sub-dimension (e.g. pacote → formato).
  async function aggregateDimension({ field, year, period, childField } = {}) {
    const rows = await fetchAllFactRows();
    const p = period || (year ? { year } : null);
    const filtered = _filterByPeriod(rows, p);

    const groups = new Map();
    const subGroups = new Map(); // key: `${parentKey}::${childKey}`
    for (const r of filtered) {
      const key = r[field] || '—';
      if (!groups.has(key)) {
        groups.set(key, { name: key, investimento: 0, impressions: 0, clicks: 0, views: 0 });
      }
      const g = groups.get(key);
      g.investimento += r['Investiment'] || 0;
      g.impressions  += r['Total impressions'] || 0;
      g.clicks       += r['Total clicks'] || 0;
      g.views        += r['Complete'] || 0;

      if (childField) {
        const ckey = r[childField] || '—';
        const compoundKey = `${key}::${ckey}`;
        if (!subGroups.has(compoundKey)) {
          subGroups.set(compoundKey, { parent: key, name: ckey, investimento: 0, impressions: 0, clicks: 0, views: 0 });
        }
        const sg = subGroups.get(compoundKey);
        sg.investimento += r['Investiment'] || 0;
        sg.impressions  += r['Total impressions'] || 0;
        sg.clicks       += r['Total clicks'] || 0;
        sg.views        += r['Complete'] || 0;
      }
    }

    const out = [...groups.values()].map(g => ({
      ...g,
      ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
      children: []
    }));

    if (childField) {
      const byParent = new Map(out.map(o => [o.name, o]));
      for (const sg of subGroups.values()) {
        const parent = byParent.get(sg.parent);
        if (!parent) continue;
        parent.children.push({
          name: sg.name,
          investimento: sg.investimento,
          impressions: sg.impressions,
          clicks: sg.clicks,
          views: sg.views,
          ctr: sg.impressions > 0 ? (sg.clicks / sg.impressions) * 100 : 0
        });
      }
      for (const p of out) p.children.sort((a, b) => b.investimento - a.investimento);
    }

    return out.sort((a, b) => b.investimento - a.investimento);
  }

  // Friendly dimension names → fact-table column names. Update here whenever
  // the overview table gains/loses a drill option.
  const DIM_TO_FIELD = {
    canal:     'Canal',
    grupo:     'Grupo',
    formato:   'Formato',
    categoria: 'Categoria',
    pacote:    'Pacote',
    pedido:    'Pedido'
  };

  const DIM_LABELS = {
    pt: { canal: 'Canal', grupo: 'Grupo', formato: 'Formato', categoria: 'Categoria', pacote: 'Pacote', pedido: 'Pedido' },
    en: { canal: 'Channel', grupo: 'Group', formato: 'Format', categoria: 'Category', pacote: 'Package', pedido: 'Order' }
  };

  async function aggregateDimensionForYear(dim, arg) {
    const field = DIM_TO_FIELD[dim];
    if (!field) return [];
    // Only Pacote carries a sub-breakdown (by Formato) today; the expandable
    // children row in the overview table uses that.
    const childField = dim === 'pacote' ? 'Formato' : undefined;
    return aggregateDimension({ field, period: _periodFromArg(arg), childField });
  }

  // Hierarchical aggregation — each dimension in `dims` becomes a drill-down
  // level. Returns a tree of the form:
  //   [{ name, investimento, impressions, clicks, views, ctr, children: [...] }]
  // Leaves have children: [].
  function groupHierarchical(rows, dims) {
    if (!dims.length) return [];
    const field = DIM_TO_FIELD[dims[0]];
    if (!field) return [];
    const rest = dims.slice(1);
    const groups = new Map();
    for (const r of rows) {
      const key = r[field] || '—';
      if (!groups.has(key)) {
        groups.set(key, { name: key, investimento: 0, impressions: 0, clicks: 0, views: 0, _rows: [] });
      }
      const g = groups.get(key);
      g.investimento += r['Investiment'] || 0;
      g.impressions  += r['Total impressions'] || 0;
      g.clicks       += r['Total clicks'] || 0;
      g.views        += r['Complete'] || 0;
      if (rest.length) g._rows.push(r);
    }
    return [...groups.values()].map(g => ({
      name: g.name,
      investimento: g.investimento,
      impressions: g.impressions,
      clicks: g.clicks,
      views: g.views,
      ctr: g.impressions > 0 ? (g.clicks / g.impressions) * 100 : 0,
      children: rest.length ? groupHierarchical(g._rows, rest) : []
    })).sort((a, b) => b.investimento - a.investimento);
  }

  async function aggregateHierarchicalForYear(dims, arg) {
    const period = _periodFromArg(arg);
    const rows = await fetchAllFactRows();
    const filtered = _filterByPeriod(rows, period);
    return groupHierarchical(filtered, dims);
  }

  // Aliases kept for any legacy call sites; direct callers should prefer
  // aggregateDimensionForYear(). TODO: drop after all call sites migrate.
  async function aggregatePackagesForYear(year)  { return aggregateDimensionForYear('pacote',  year); }
  async function aggregateChannelsForYear(year)  { return aggregateDimensionForYear('canal',   year); }
  async function aggregateFormatsForYear(year)   { return aggregateDimensionForYear('formato', year); }

  async function aggregateInvestByMonthForYear(arg) {
    const period = _periodFromArg(arg);
    const rows = await fetchAllFactRows();
    const filtered = _filterByPeriod(rows, period);
    const byMonth = new Array(12).fill(0);
    for (const r of filtered) byMonth[monthOf(r.Date)] += r['Investiment'] || 0;
    return { labels: MONTH_LABELS, values: byMonth };
  }

  async function aggregateFormatShareForYear(arg) {
    const formats = await aggregateFormatsForYear(arg);
    const total = formats.reduce((s, f) => s + f.impressions, 0);
    if (!total) return { labels: [], values: [], percents: [], total: 0 };
    return {
      labels:   formats.map(f => f.name),
      values:   formats.map(f => f.impressions),
      percents: formats.map(f => +((f.impressions / total) * 100).toFixed(2)),
      total
    };
  }

  async function aggregateChannelsByImpressionsForYear(arg, topN = 6) {
    const channels = await aggregateChannelsForYear(arg);
    const sorted = [...channels].sort((a, b) => b.impressions - a.impressions).slice(0, topN);
    return {
      labels: sorted.map(c => c.name),
      values: sorted.map(c => c.impressions)
    };
  }

  async function aggregateChannelsByViewsForYear(arg, topN = 6) {
    const channels = await aggregateChannelsForYear(arg);
    const sorted = [...channels].sort((a, b) => b.views - a.views).slice(0, topN);
    return {
      labels: sorted.map(c => c.name),
      values: sorted.map(c => c.views)
    };
  }

  // --- Pacing page --------------------------------------------------------
  //
  // Produces a payload in the exact shape PacingModule.init() expects, built
  // live from gold_fct_novibet (actuals) and gold_fct_pacing_novibet (target
  // impressions). Notes:
  //   - `goal` on each package is the TARGET in IMPRESSIONS (the pacing table
  //     only has impression goals, not R$ goals). Renderers show this number
  //     without an R$ prefix.
  //   - `deliveryRate` is actual impressions / goal impressions * 100.
  //   - `vtr`          = Complete / Impressions * 100.
  //   - `engagement`   = (Clicks + Complete) / Impressions * 100.
  //   - Trend series are cumulative impressions (actual vs goal) by month.
  //
  function fmtPct(v) { return v.toFixed(2).replace('.', ',') + '%'; }

  // Qualitative thresholds — tuned to the current Novibet data distribution.
  // If real benchmarks differ, only these numbers need changing.
  const VTR_GOOD = 20, VTR_OK = 10;
  const ENG_GOOD = 15, ENG_OK = 5;

  function qualifyMetric(value, goodThr, okThr, lang) {
    if (value >= goodThr) {
      return {
        label: lang === 'en' ? 'solid' : 'bom',
        color: 'var(--color-success)'
      };
    }
    if (value >= okThr) {
      return {
        label: lang === 'en' ? 'room to improve' : 'pode melhorar',
        color: 'var(--color-warning)'
      };
    }
    return {
      label: lang === 'en' ? 'below expectations' : 'abaixo do esperado',
      color: 'var(--color-danger)'
    };
  }

  function formatPctBr(v) {
    return (v || 0).toFixed(2).replace('.', ',') + '%';
  }

  // `vtr` and `engagement` are raw numbers (e.g. 18.5) so we can classify them;
  // the helper still renders the formatted percentage for display.
  //
  // Returns HTML structured as three lines so the card footer can show each
  // analysis on its own row:
  //   1. Pacing head (delivery rate vs goal)
  //   2. VTR definition + current value + qualitative label
  //   3. Engagement definition + current value + qualitative label
  function channelInsight(grupo, dr, vtr, engagement, lang = 'pt') {
    const pct = dr.toFixed(0);
    const vtrNum = typeof vtr === 'number' ? vtr : 0;
    const engNum = typeof engagement === 'number' ? engagement : 0;
    const vtrQ = qualifyMetric(vtrNum, VTR_GOOD, VTR_OK, lang);
    const engQ = qualifyMetric(engNum, ENG_GOOD, ENG_OK, lang);
    const vtrStr = formatPctBr(vtrNum);
    const engStr = formatPctBr(engNum);

    const wrap = (lines) => lines
      .map(l => `<div class="pc-insight-line">${l}</div>`)
      .join('');

    if (lang === 'en') {
      let head;
      if (dr >= 100)     head = `Group <strong>${grupo}</strong> delivered <strong>${pct}%</strong> of the impression goal — above target for the period.`;
      else if (dr >= 90) head = `Group <strong>${grupo}</strong> is at <strong>${pct}%</strong> of goal — <strong style="color:var(--color-success);">on track</strong>.`;
      else if (dr >= 60) head = `Group <strong>${grupo}</strong> is at <strong>${pct}%</strong> of goal. <strong style="color:var(--color-warning);">Attention:</strong> pacing is below expected — review allocation.`;
      else               head = `Group <strong>${grupo}</strong> is at <strong>${pct}%</strong> of goal. <strong style="color:var(--color-danger);">Critical:</strong> pacing is far below expected.`;

      const vtrLine = `<span style="color:var(--color-text-muted);">VTR is the share of impressions that became complete views.</span> VTR at <strong style="color:var(--color-text-primary);">${vtrStr}</strong> — <strong style="color:${vtrQ.color};">${vtrQ.label}</strong>.`;
      const engLine = `<span style="color:var(--color-text-muted);">Engagement combines clicks and complete views over impressions.</span> Engagement at <strong style="color:var(--color-text-primary);">${engStr}</strong> — <strong style="color:${engQ.color};">${engQ.label}</strong>.`;

      return wrap([head, vtrLine, engLine]);
    }

    let head;
    if (dr >= 100)     head = `O grupo <strong>${grupo}</strong> entregou <strong>${pct}%</strong> da meta de impressões — acima do esperado para o período.`;
    else if (dr >= 90) head = `O grupo <strong>${grupo}</strong> está em <strong>${pct}%</strong> da meta — <strong style="color:var(--color-success);">ritmo dentro do esperado</strong>.`;
    else if (dr >= 60) head = `O grupo <strong>${grupo}</strong> está em <strong>${pct}%</strong> da meta. <strong style="color:var(--color-warning);">Atenção:</strong> ritmo abaixo do esperado — revisar alocação.`;
    else               head = `O grupo <strong>${grupo}</strong> está em <strong>${pct}%</strong> da meta. <strong style="color:var(--color-danger);">Crítico:</strong> ritmo muito abaixo do esperado.`;

    const vtrLine = `<span style="color:var(--color-text-muted);">VTR é a taxa de visualizações completas sobre o total de impressões.</span> VTR em <strong style="color:var(--color-text-primary);">${vtrStr}</strong> — <strong style="color:${vtrQ.color};">${vtrQ.label}</strong>.`;
    const engLine = `<span style="color:var(--color-text-muted);">Engajamento combina cliques e visualizações completas sobre as impressões.</span> Engajamento em <strong style="color:var(--color-text-primary);">${engStr}</strong> — <strong style="color:${engQ.color};">${engQ.label}</strong>.`;

    return wrap([head, vtrLine, engLine]);
  }

  function globalInsight(dr, topCanal, lang = 'pt') {
    if (lang === 'en') {
      const pct = dr.toFixed(2);
      if (dr >= 100) return `Accumulated impressions are <strong>${pct}%</strong> of the expected goal — ahead of plan. <strong>${topCanal}</strong> leads in volume.`;
      if (dr >= 90)  return `The year is at <strong>${pct}%</strong> of the annual goal — <strong style="color:var(--color-success);">on pace</strong>. <strong>${topCanal}</strong> has the highest impression volume.`;
      if (dr >= 30)  return `The year is at <strong>${pct}%</strong> of the annual goal. <strong>${topCanal}</strong> leads in impression volume. <strong style="color:var(--color-warning);">Monitor</strong> whether pacing stays aligned with next-quarter goals.`;
      return `The year is at <strong>${pct}%</strong> of the annual goal — early execution phase. <strong>${topCanal}</strong> has the highest initial impression volume.`;
    }
    const pct = dr.toFixed(2).replace('.', ',');
    if (dr >= 100) return `As impressões acumuladas representam <strong>${pct}%</strong> da meta esperada — ritmo acima do planejado. <strong>${topCanal}</strong> lidera em volume.`;
    if (dr >= 90)  return `O ano está em <strong>${pct}%</strong> da meta anual — <strong style="color:var(--color-success);">ritmo dentro do esperado</strong>. <strong>${topCanal}</strong> é o canal com maior volume de impressões.`;
    if (dr >= 30)  return `O ano está em <strong>${pct}%</strong> da meta anual. <strong>${topCanal}</strong> lidera em volume de impressões. <strong style="color:var(--color-warning);">Monitorar</strong> se o ritmo permanece alinhado com as metas do próximo trimestre.`;
    return `O ano está em <strong>${pct}%</strong> da meta anual — fase inicial de execução. <strong>${topCanal}</strong> é o canal com maior volume inicial de impressões.`;
  }

  function yearOf(d) { return d ? +d.slice(0, 4) : 0; }
  function monthOf(d) { return d ? +d.slice(5, 7) - 1 : 0; }
  function dayOf(d)   { return d ? +d.slice(8, 10) : 0; }

  // Today in local-calendar YYYY-MM-DD — used to cap "realizado" series so
  // actuals never extend into the future even when the dataset contains
  // forward-dated rows (test / seeded data).
  function todayLocalIso() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  // Last day of a year/month — used when building YYYY-MM-DD date-range
  // strings for the drill period.
  function lastDayOf(year, monthIdx) {
    return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
  }

  // Most recent month (0-11) that has at least one actuals row in the given
  // year, or null if the year has no data at all. Used to anchor the
  // "Trimestre" and "Mês" drills on the last active period.
  function latestMonthInYear(rows, year) {
    let max = -1;
    for (const r of rows) {
      if (!r.Date) continue;
      if (yearOf(r.Date) !== year) continue;
      const m = monthOf(r.Date);
      if (m > max) max = m;
    }
    return max >= 0 ? max : null;
  }

  // Maps a pacing drill ('year' | 'quarter' | 'month') to a period filter
  // that narrows rows down to the matching slice of the selected year:
  //   - year:    the full year
  //   - quarter: the 3 months of the latest active quarter
  //   - month:   the latest active month
  // Falls back to the full year if the year has no data.
  function getDrillPeriod(year, drill, actualRows) {
    if (!year || drill === 'year') return { year };
    const m = latestMonthInYear(actualRows, year);
    if (m == null) return { year };

    const pad = (n) => String(n).padStart(2, '0');

    if (drill === 'quarter') {
      const qStart = Math.floor(m / 3) * 3;
      const from = `${year}-${pad(qStart + 1)}-01`;
      const to   = `${year}-${pad(qStart + 3)}-${pad(lastDayOf(year, qStart + 2))}`;
      return { dateFrom: from, dateTo: to, drillStartMonth: qStart, drillEndMonth: qStart + 2 };
    }

    if (drill === 'month') {
      const from = `${year}-${pad(m + 1)}-01`;
      const to   = `${year}-${pad(m + 1)}-${pad(lastDayOf(year, m))}`;
      return { dateFrom: from, dateTo: to, drillMonth: m };
    }

    return { year };
  }

  async function computePacingForYear(year, { lang = 'pt', drill = 'year' } = {}) {
    const [actualAllRaw, pacingAll] = await Promise.all([
      fetchAllFactRows(),
      fetchAllPacingRows()
    ]);
    // Pacing shows "what was delivered so far" — actuals dated in the future
    // (seeded/test data) must not be counted. Goals (pacing table) may extend
    // into the future, that's the planned delivery.
    const todayIso = todayLocalIso();
    const actualAll = actualAllRaw.filter(r => !r.Date || r.Date <= todayIso);

    // The drill acts as a period filter applied to everything on the page
    // (cards + trend). _filterByPeriod narrows the rows using the same
    // helper the Overview date-range filter uses.
    const period = getDrillPeriod(year, drill, actualAll);
    const actual = _filterByPeriod(actualAll, period);
    const pacing = _filterByPeriod(pacingAll, period);

    // Globals
    let gImpr = 0, gClk = 0, gView = 0, gInv = 0;
    for (const r of actual) {
      gImpr += r['Total impressions'] || 0;
      gClk  += r['Total clicks'] || 0;
      gView += r['Complete'] || 0;
      gInv  += r['Investiment'] || 0;
    }
    let gGoal = 0;
    for (const r of pacing) gGoal += r['Total impressions'] || 0;

    const vtr = gImpr > 0 ? (gView / gImpr) * 100 : 0;
    const engagement = gImpr > 0 ? ((gClk + gView) / gImpr) * 100 : 0;
    const deliveryRate = gGoal > 0 ? (gImpr / gGoal) * 100 : 0;

    // Group by Grupo (actuals) and (Grupo, Pacote) for both sides
    const byGroup = new Map();
    const ensureGroup = (grupo) => {
      if (!byGroup.has(grupo)) {
        byGroup.set(grupo, {
          grupo,
          impressions: 0, clicks: 0, views: 0, invest: 0,
          goalImpressions: 0,
          packages: new Map()
        });
      }
      return byGroup.get(grupo);
    };
    const ensurePackage = (group, pacote) => {
      if (!group.packages.has(pacote)) {
        group.packages.set(pacote, {
          name: pacote,
          invested: 0,
          goal: 0,        // impressions goal
          impressions: 0, // actual impressions
          clicks: 0,
          views: 0
        });
      }
      return group.packages.get(pacote);
    };

    for (const r of actual) {
      const grupo = r['Grupo'] || '—';
      const pacote = r['Pacote'] || '—';
      const gr = ensureGroup(grupo);
      gr.impressions += r['Total impressions'] || 0;
      gr.clicks      += r['Total clicks'] || 0;
      gr.views       += r['Complete'] || 0;
      gr.invest      += r['Investiment'] || 0;
      const pkg = ensurePackage(gr, pacote);
      pkg.invested    += r['Investiment'] || 0;
      pkg.impressions += r['Total impressions'] || 0;
      pkg.clicks      += r['Total clicks'] || 0;
      pkg.views       += r['Complete'] || 0;
    }

    for (const r of pacing) {
      const grupo = r['Grupo'] || '—';
      const pacote = r['Pacote'] || '—';
      const gr = ensureGroup(grupo);
      const g = r['Total impressions'] || 0;
      gr.goalImpressions += g;
      const pkg = ensurePackage(gr, pacote);
      pkg.goal += g;
    }

    // Build the shape PacingModule expects (one entry per Grupo)
    const channels = [...byGroup.values()]
      .map(gr => {
        const grVtr = gr.impressions > 0 ? (gr.views / gr.impressions) * 100 : 0;
        const grEng = gr.impressions > 0 ? ((gr.clicks + gr.views) / gr.impressions) * 100 : 0;
        const grDr  = gr.goalImpressions > 0 ? (gr.impressions / gr.goalImpressions) * 100 : 0;
        const vtrStr = fmtPct(grVtr);
        const engStr = fmtPct(grEng);
        return {
          grupo: gr.grupo,
          vtr: vtrStr,
          engagement: engStr,
          estimateTotal: gr.goalImpressions,
          packages: [...gr.packages.values()].map(pkg => ({
            name: pkg.name,
            invested: Math.round(pkg.invested),
            goal: pkg.goal,
            impressions: pkg.impressions,
            ctr: pkg.impressions > 0 ? +((pkg.clicks / pkg.impressions) * 100).toFixed(2) : 0,
            vtr: pkg.impressions > 0 ? +((pkg.views  / pkg.impressions) * 100).toFixed(2) : 0,
            engagement: pkg.impressions > 0
              ? +(((pkg.clicks + pkg.views) / pkg.impressions) * 100).toFixed(2) : 0
          })).sort((a, b) => b.impressions - a.impressions),
          insight: channelInsight(gr.grupo, grDr, grVtr, grEng, lang),
          _deliveryRate: grDr,
          _vtrRaw: grVtr,
          _engRaw: grEng
        };
      })
      .sort((a, b) => b.estimateTotal - a.estimateTotal);

    const topGroup = channels[0] ? channels[0].grupo : '—';
    const trend = await computePacingTrend({ year, drill, _preloaded: { actualAll, pacingAll } });

    return {
      vtr: fmtPct(vtr),
      engagement: fmtPct(engagement),
      deliveryRate,
      channels,
      trend,
      globalInsight: globalInsight(deliveryRate, topGroup, lang),
      totalInvest: gInv
    };
  }

  // Drill-aware trend series, bucketed so the x-axis granularity matches the
  // drill period filter that is applied to the rest of the page:
  //   - year:    12 months (Jan..Dez) cumulative within the selected year
  //   - quarter: the 3 months of the latest active quarter, cumulative
  //   - month:   the 4 weeks of the latest active month, cumulative
  //
  // The "realizado" cumulative is clipped at today (future buckets render as
  // null so the line stops instead of plateauing through future labels). The
  // "meta esperada" line keeps extending so planned future delivery is still
  // visible.
  async function computePacingTrend({ year, drill = 'year', _preloaded } = {}) {
    const [actualAllSource, pacingAll] = _preloaded
      ? [_preloaded.actualAll, _preloaded.pacingAll]
      : await Promise.all([fetchAllFactRows(), fetchAllPacingRows()]);

    // Guard against forward-dated actuals reaching this function when the
    // preloaded path is skipped (computePacingTrend called standalone).
    const todayIso = todayLocalIso();
    const actualAll = actualAllSource.filter(r => !r.Date || r.Date <= todayIso);

    const today = new Date();
    const todayY = today.getFullYear();
    const todayM = today.getMonth();   // 0-11
    const todayD = today.getDate();

    // Returns the bucket index (0-based) that contains "today" for the given
    // drill + bucket count. -1 means the drill period is entirely in the
    // future (all actual buckets should be null); lastIdx means it's entirely
    // in the past (no nulling needed).
    const todayIndex = (drill, bucketCount, anchorMonth) => {
      if (drill === 'year') {
        if (year > todayY) return -1;
        if (year < todayY) return 11;
        return todayM;
      }
      if (drill === 'quarter') {
        const qStart = Math.floor(anchorMonth / 3) * 3;
        if (year > todayY) return -1;
        if (year < todayY) return 2;
        if (todayM < qStart) return -1;
        if (todayM > qStart + 2) return 2;
        return todayM - qStart;
      }
      if (drill === 'month') {
        if (year > todayY) return -1;
        if (year < todayY) return 3;
        if (todayM < anchorMonth) return -1;
        if (todayM > anchorMonth) return 3;
        return Math.min(3, Math.floor((todayD - 1) / 7));
      }
      return bucketCount - 1;
    };

    // Builds a cumulative array, setting every bucket past `todayIdx` to null
    // so Chart.js breaks the line there (spanGaps is off on the realizado
    // dataset, so null = the line stops).
    const cumClipped = (arr, todayIdx) => {
      const out = [];
      let sum = 0;
      for (let i = 0; i < arr.length; i++) {
        if (i > todayIdx) {
          out.push(null);
        } else {
          sum += arr[i];
          out.push(sum);
        }
      }
      return out;
    };

    const cumulate = (arr) => {
      const out = [];
      let sum = 0;
      for (const v of arr) { sum += v; out.push(sum); }
      return out;
    };

    // ---- Year drill: 12 monthly buckets across the selected year -----------
    if (drill === 'year') {
      const actual = actualAll.filter(r => yearOf(r.Date) === year);
      const pacing = pacingAll.filter(r => yearOf(r.Date) === year);
      const actualByMonth = new Array(12).fill(0);
      const goalByMonth   = new Array(12).fill(0);
      for (const r of actual) actualByMonth[monthOf(r.Date)] += r['Total impressions'] || 0;
      for (const r of pacing) goalByMonth[monthOf(r.Date)]   += r['Total impressions'] || 0;
      const tIdx = todayIndex('year', 12, 0);
      return {
        labels: MONTH_LABELS,
        actual: cumClipped(actualByMonth, tIdx),
        expected: cumulate(goalByMonth),
        expectedTotal: goalByMonth.reduce((s, v) => s + v, 0),
        actualTotal: actualByMonth.reduce((s, v) => s + v, 0)
      };
    }

    // Both Trimestre and Mês drills anchor on the latest month that actually
    // has data in the (capped) actuals — past years land on December/Q4 and
    // the current year lands on the current month.
    const latestMonth = latestMonthInYear(actualAll, year);
    if (latestMonth == null) {
      return { labels: [], actual: [], expected: [], expectedTotal: 0 };
    }

    // ---- Quarter drill: 3 month buckets of the latest active quarter -------
    if (drill === 'quarter') {
      const qStart = Math.floor(latestMonth / 3) * 3;
      const actualByM = [0, 0, 0];
      const goalByM   = [0, 0, 0];
      for (const r of actualAll) {
        if (yearOf(r.Date) !== year) continue;
        const mo = monthOf(r.Date);
        if (mo < qStart || mo > qStart + 2) continue;
        actualByM[mo - qStart] += r['Total impressions'] || 0;
      }
      for (const r of pacingAll) {
        if (yearOf(r.Date) !== year) continue;
        const mo = monthOf(r.Date);
        if (mo < qStart || mo > qStart + 2) continue;
        goalByM[mo - qStart] += r['Total impressions'] || 0;
      }
      const tIdx = todayIndex('quarter', 3, latestMonth);
      return {
        labels: [MONTH_LABELS[qStart], MONTH_LABELS[qStart + 1], MONTH_LABELS[qStart + 2]],
        actual: cumClipped(actualByM, tIdx),
        expected: cumulate(goalByM),
        expectedTotal: goalByM.reduce((s, v) => s + v, 0),
        actualTotal: actualByM.reduce((s, v) => s + v, 0)
      };
    }

    // ---- Month drill: 4 week buckets of the latest active month ------------
    // Weeks are days 1-7, 8-14, 15-21, 22-end. Deliberately calendar-naive so
    // the buckets line up with what users see in the date picker.
    if (drill === 'month') {
      const actualByW = [0, 0, 0, 0];
      const goalByW   = [0, 0, 0, 0];
      const dayBucket = (iso) => {
        const day = +iso.slice(8, 10);
        return Math.min(3, Math.floor((day - 1) / 7));
      };
      for (const r of actualAll) {
        if (!r.Date) continue;
        if (yearOf(r.Date) !== year || monthOf(r.Date) !== latestMonth) continue;
        actualByW[dayBucket(r.Date)] += r['Total impressions'] || 0;
      }
      for (const r of pacingAll) {
        if (!r.Date) continue;
        if (yearOf(r.Date) !== year || monthOf(r.Date) !== latestMonth) continue;
        goalByW[dayBucket(r.Date)] += r['Total impressions'] || 0;
      }
      const tIdx = todayIndex('month', 4, latestMonth);
      return {
        labels: ['S1', 'S2', 'S3', 'S4'],
        actual: cumClipped(actualByW, tIdx),
        expected: cumulate(goalByW),
        expectedTotal: goalByW.reduce((s, v) => s + v, 0),
        actualTotal: actualByW.reduce((s, v) => s + v, 0)
      };
    }

    return { labels: [], actual: [], expected: [], expectedTotal: 0, actualTotal: 0 };
  }

  function renderKPIs(kpis) {
    const set = (metric, text) => {
      const el = document.querySelector(`.stat-card[data-metric="${metric}"] .stat-value`);
      if (el) el.textContent = text;
    };
    set('impressions', kpis.impressions.toLocaleString('pt-BR'));
    set('clicks', kpis.clicks.toLocaleString('pt-BR'));
    set('ctr', kpis.ctr.toFixed(2) + '%');
    set('views', kpis.views.toLocaleString('pt-BR'));

    // Deltas are period-over-period; we don't have a comparison period defined
    // yet, so hide the placeholder indicators rather than show stale values.
    document.querySelectorAll('.stat-card .stat-change').forEach(el => {
      el.style.display = 'none';
    });
  }

  function showKPILoading() {
    document.querySelectorAll('.stat-card .stat-value').forEach(el => {
      el.textContent = '…';
    });
  }

  const listeners = [];
  function onDataReady(cb) { listeners.push(cb); }
  function emitDataReady(rows) { for (const cb of listeners) { try { cb(rows); } catch (e) { console.error(e); } } }

  window.DashboardData = {
    client,
    fetchNovibetFacts,
    fetchPacingFacts,
    fetchAllFactRows,
    fetchAllPacingRows,
    fetchOverviewKPIs,
    applyFilters: _filterByPeriod,
    aggregateByDrill,
    aggregateByYear,
    aggregateByMonth,
    aggregateByWeek,
    aggregatePackagesForYear,
    aggregateChannelsForYear,
    aggregateFormatsForYear,
    aggregateDimensionForYear,
    aggregateHierarchicalForYear,
    DIM_LABELS,
    aggregateInvestByMonthForYear,
    aggregateFormatShareForYear,
    aggregateChannelsByImpressionsForYear,
    aggregateChannelsByViewsForYear,
    computePacingForYear,
    computePacingTrend,
    channelInsight,
    globalInsight,
    renderKPIs,
    rowMetric,
    onDataReady
  };

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(async () => {
    showKPILoading();
    try {
      const rows = await fetchAllFactRows();
      const kpis = await fetchOverviewKPIs();
      renderKPIs(kpis);
      console.log('[Supabase] KPIs loaded from', kpis.rowCount, 'rows:', kpis);
      emitDataReady(rows);
    } catch (err) {
      console.error('[Supabase] load failed:', err);
      document.querySelectorAll('.stat-card .stat-value').forEach(el => {
        el.textContent = '—';
      });
    }
  });
})();
