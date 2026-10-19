const { useState, useEffect, useMemo, useRef } = React;
const S = 'budget-planner-v1';

const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
const uid = () => Math.random().toString(36).slice(2, 11) + Date.now().toString(36);
const API_BASE_URL = 'https://plansurf-service.onrender.com';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const mk = (year, month) => `${year}-${String(month + 1).padStart(2, '0')}`;
const fmt = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: '💵', color: '#16a34a', type: 'income' },
  { id: 'freelance', label: 'Freelance', icon: '💼', color: '#2563eb', type: 'income' },
  { id: 'investment', label: 'Investment', icon: '📈', color: '#9333ea', type: 'investment' },
  { id: 'transfer', label: 'Transfer', icon: '↔️', color: '#64748b', type: 'transfer' },
  { id: 'rental-income', label: 'Rental Income', icon: '🏠', color: '#0891b2', type: 'income' },
  { id: 'other-income', label: 'Other Income', icon: '🎁', color: '#0891b2', type: 'income' },
  { id: 'rent', label: 'Rent / Mortgage', icon: '🏡', color: '#dc2626', type: 'expense' },
  { id: 'groceries', label: 'Groceries', icon: '🛒', color: '#ea580c', type: 'expense' },
  { id: 'transport', label: 'Transport', icon: '🚗', color: '#d97706', type: 'expense' },
  { id: 'utilities', label: 'Utilities', icon: '⚡', color: '#0d9488', type: 'expense' },
  { id: 'entertainment', label: 'Entertainment', icon: '🎬', color: '#e11d48', type: 'expense' },
  { id: 'holiday', label: 'Holiday', icon: '✈️', color: '#2563eb', type: 'expense' },
  { id: 'dining', label: 'Dining Out', icon: '🍽️', color: '#be185d', type: 'expense' },
  { id: 'health', label: 'Health', icon: '💊', color: '#16a34a', type: 'expense' },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', color: '#7c3aed', type: 'expense' },
  { id: 'education', label: 'Education', icon: '📚', color: '#2563eb', type: 'expense' },
  { id: 'insurance', label: 'Insurance', icon: '🛡️', color: '#4f46e5', type: 'expense' },
  { id: 'subscriptions', label: 'Subscriptions', icon: '📺', color: '#6366f1', type: 'expense' },
  { id: 'other-expense', label: 'Other', icon: '🧾', color: '#64748b', type: 'expense' }
];

const CAT_MAP = {};
CATEGORIES.forEach((category) => {
  CAT_MAP[category.id] = category;
});

const isInvestment = (transaction) => transaction.category === 'investment' || transaction.type === 'investment';

const parseStatementDate = (value) => {
  const parts = String(value || '').trim().split(/[/-]/);
  if (parts.length !== 3) return null;

  const [day, month, year] = parts[0].length === 4 ? [parts[2], parts[1], parts[0]] : parts;
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return null;
  }

  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) {
    return null;
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const parseStatementAmount = (value) => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text);
  const amount = Number(text.replace(/[,$\s()]/g, ''));
  return Number.isFinite(amount) ? (negative ? -Math.abs(amount) : amount) : null;
};

const statementFingerprint = (tx) => `${tx.date}|${tx.desc.trim().toLowerCase()}|${Number(tx.amount).toFixed(2)}`;

const inferCategory = (description) => {
  const text = description.toLowerCase();
  const rules = [
    ['transfer', ['funds tfer', 'funds transfer', 'bpay nab cards', 'anz mobile banking payment', 'payment to beawarwala taha', 'online payment received']],
    ['salary', ['salary', 'payroll', 'paycheck', 'wages']],
    ['freelance', ['freelance', 'client work', 'contract work']],
    ['investment', ['investment', 'dividend', 'stock sale', 'interest', 'vanguard', 'spaceship']],
    ['rental-income', ['rental income', 'rent received', 'tenant payment', 'tenant rent', 'property rent', 'ray white']],
    ['other-income', ['bonus', 'gift', 'refund', 'cashback', 'reversal']],
    ['rent', ['rent', 'mortgage', 'landlord']],
    ['groceries', ['grocery', 'groceries', 'supermarket', 'food shop', 'coles', 'woolworths', 'day to day supermarket', 'natures green farm', 'green grocer', 'farmers market', 'produce market']],
    ['transport', ['uber', 'lyft', 'taxi', 'fuel', 'gas station', 'petrol', 'parking', 'train', 'bus', '7-eleven', 'seven eleven', 'reddy express']],
    ['utilities', ['electric', 'electricity', 'water bill', 'utility', 'utilities', 'internet', 'phone bill', 'energy locals']],
    ['entertainment', ['movie', 'cinema', 'concert', 'game', 'entertainment', 'trybooking']],
    ['holiday', ['flight', 'hotel', 'airbnb', 'vacation', 'holiday', 'travel', 'jetstar']],
    ['dining', ['restaurant', 'dinner', 'lunch', 'breakfast', 'coffee', 'takeout', 'takeaway', 'dining', 'sharetea', 'yo-chi', 'yo- chi', 'domino', 'teriyaki', 'cafe', 'smash burger']],
    ['health', ['doctor', 'dentist', 'pharmacy', 'medicine', 'health', 'chemist warehouse']],
    ['shopping', ['shopping', 'clothes', 'clothing', 'amazon', 'mall', 'rebel', 'kmart', 'smiggle', 'target', 'reject shop', 'temu', 'spotlight', 'payin4', 'bunnings']],
    ['education', ['course', 'tuition', 'school', 'book', 'education']],
    ['insurance', ['insurance', 'insure', 'allianz', 'gmhba', 'budget direct']],
    ['subscriptions', ['netflix', 'spotify', 'subscription', 'membership']],
    ['other-expense', ['expense']]
  ];

  const match = rules.find(([, keywords]) => keywords.some((keyword) => text.includes(keyword)));
  return match ? match[0] : null;
};

function App() {
  const now = new Date();
  const [transactions, setTransactions] = useState(() => load(S + '-tx', {}));
  const [goals, setGoals] = useState(() => load(S + '-goals', []));
  const [curMonth, setCurMonth] = useState(now.getMonth());
  const [curYear, setCurYear] = useState(now.getFullYear());
  const [dark, setDark] = useState(() => localStorage.getItem('bp-dark') === '1');
  const [syncModal, setSyncModal] = useState(false);
  const [sessionToken, setSessionToken] = useState('');
  const [syncStatus, setSyncStatus] = useState('Ready');
  const [dirty, setDirty] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncReady = useRef(false);
  const suppressDirty = useRef(false);
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [cat, setCat] = useState('salary');
  const [txDate, setTxDate] = useState(now.toISOString().split('T')[0]);
  const [statementPreview, setStatementPreview] = useState(null);
  const [statementImportError, setStatementImportError] = useState('');
  const statementFileInput = useRef(null);

  useEffect(() => { save(S + '-tx', transactions); }, [transactions]);
  useEffect(() => { save(S + '-goals', goals); }, [goals]);
  useEffect(() => {
    if (syncReady.current) {
      if (suppressDirty.current) {
        suppressDirty.current = false;
      } else {
        setDirty(true);
        setSyncStatus('Unsaved local changes');
      }
    }
  }, [transactions, goals]);
  useEffect(() => { syncReady.current = true; }, []);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('bp-dark', dark ? '1' : '0');
  }, [dark]);

  const key = mk(curYear, curMonth);
  const monthTx = transactions[key] || [];

  const addTx = (event) => {
    event.preventDefault();
    if (!desc.trim() || !amt) return;

    const categoryInfo = CAT_MAP[cat];
    const tx = {
      id: uid(),
      desc: desc.trim(),
      amount: parseFloat(amt),
      category: cat,
      type: categoryInfo?.type || 'expense',
      date: txDate
    };

    const txKey = mk(new Date(txDate).getFullYear(), new Date(txDate).getMonth());
    setTransactions((previous) => ({ ...previous, [txKey]: [...(previous[txKey] || []), tx] }));
    setDesc('');
    setAmt('');
  };

  const updateTx = (originalKey, updatedTx) => {
    const nextDateKey = mk(new Date(updatedTx.date).getFullYear(), new Date(updatedTx.date).getMonth());
    setTransactions((previous) => {
      const remaining = (previous[originalKey] || []).filter((tx) => tx.id !== updatedTx.id);
      if (nextDateKey === originalKey) {
        return { ...previous, [originalKey]: [...remaining, updatedTx] };
      }
      return { ...previous, [originalKey]: remaining, [nextDateKey]: [...(previous[nextDateKey] || []), updatedTx] };
    });
  };

  const deleteTx = (id) => {
    setTransactions((previous) => ({ ...previous, [key]: (previous[key] || []).filter((tx) => tx.id !== id) }));
  };

  const parseStatementFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setStatementImportError('');

    if (!window.Papa) {
      setStatementImportError('The CSV parser did not load. Check your internet connection and try again.');
      return;
    }

    window.Papa.parse(file, {
      header: false,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        const records = result.data;
        const firstRow = records[0] || [];
        const headers = firstRow.map((value) => String(value || '').replace(/^\uFEFF/, '').trim().toLowerCase());
        const dateIndex = headers.indexOf('date');
        const descriptionIndex = headers.indexOf('description');
        const amountIndex = headers.indexOf('amount');
        const hasHeaders = dateIndex >= 0 && descriptionIndex >= 0 && amountIndex >= 0;
        const isHeaderlessAnz = !hasHeaders && parseStatementDate(firstRow[0]) !== null && parseStatementAmount(firstRow[1]) !== null && Boolean(String(firstRow[2] || '').trim());

        if (!hasHeaders && !isHeaderlessAnz) {
          setStatementImportError('This CSV format is not recognized. Expected Date, Description, and Amount columns, or an ANZ date/amount/description export.');
          return;
        }

        const known = new Set(Object.values(transactions).flat().map(statementFingerprint));
        let skippedRows = 0;
        const dataRows = hasHeaders ? records.slice(1) : records;
        const dateColumn = hasHeaders ? dateIndex : 0;
        const descriptionColumn = hasHeaders ? descriptionIndex : 2;
        const amountColumn = hasHeaders ? amountIndex : 1;

        const items = dataRows.flatMap((row) => {
          const date = parseStatementDate(row[dateColumn]);
          const desc = String(row[descriptionColumn] || '').trim();
          const signedAmount = parseStatementAmount(row[amountColumn]);

          if (!date || !desc || signedAmount === null || signedAmount === 0) {
            skippedRows += 1;
            return [];
          }

          const item = {
            date,
            desc,
            amount: Math.abs(signedAmount),
            category: 'other-expense',
            duplicate: false,
            include: true
          };

          const suggested = inferCategory(desc);
          const direction = hasHeaders ? (signedAmount > 0 ? 'expense' : 'income') : (signedAmount > 0 ? 'income' : 'expense');
          const category = suggested === 'investment' || suggested === 'transfer' || (suggested && CAT_MAP[suggested]?.type === direction)
            ? suggested
            : direction === 'income' ? 'other-income' : 'other-expense';

          item.category = category;
          const fingerprint = statementFingerprint(item);
          item.duplicate = known.has(fingerprint);
          item.include = !item.duplicate;
          known.add(fingerprint);
          return [item];
        });

        if (!items.length) {
          setStatementImportError('No valid transactions were found in this CSV.');
          return;
        }

        setStatementPreview({ fileName: file.name, items, skippedRows, format: hasHeaders ? 'card' : 'ANZ' });
      },
      error: (error) => setStatementImportError(`Could not read this CSV: ${error.message}`)
    });
  };

  const addStatementTransactions = (items) => {
    const selected = items.filter((item) => item.include);
    if (!selected.length) return;

    const groups = {};
    selected.forEach((item) => {
      const monthKey = item.date.slice(0, 7);
      const category = CAT_MAP[item.category] ? item.category : 'other-expense';
      (groups[monthKey] ||= []).push({
        id: uid(),
        desc: item.desc,
        amount: item.amount,
        category,
        type: CAT_MAP[category].type,
        date: item.date
      });
    });

    setTransactions((current) => {
      const next = { ...current };
      Object.entries(groups).forEach(([monthKey, rows]) => {
        next[monthKey] = [...(next[monthKey] || []), ...rows];
      });
      return next;
    });

    const latestDate = selected.map((item) => item.date).sort().at(-1);
    if (latestDate) {
      const [year, month] = latestDate.split('-');
      setCurYear(Number(year));
      setCurMonth(Number(month) - 1);
    }

    setSyncStatus(`${selected.length} transactions imported`);
    setStatementPreview(null);
  };

  const income = monthTx.filter((tx) => tx.type === 'income' && !isInvestment(tx)).reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const expenses = monthTx.filter((tx) => tx.type === 'expense').reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const investments = monthTx.filter(isInvestment).reduce((total, tx) => total + Number(tx.amount || 0), 0);
  const balance = income - expenses;
  const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;

  const catBreakdown = useMemo(() => {
    const map = {};
    monthTx.filter((tx) => tx.type === 'expense').forEach((tx) => {
      map[tx.category] = (map[tx.category] || 0) + Number(tx.amount || 0);
    });

    return CATEGORIES.filter((category) => category.type === 'expense' && map[category.id])
      .map((category) => ({
        ...category,
        amount: map[category.id],
        pct: expenses > 0 ? Math.round((map[category.id] / expenses) * 100) : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [monthTx, expenses]);

  const chartData = useMemo(() => {
    const data = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      let month = curMonth - offset;
      let year = curYear;
      while (month < 0) {
        month += 12;
        year -= 1;
      }

      const keyValue = mk(year, month);
      const txs = transactions[keyValue] || [];
      const inc = txs.filter((tx) => tx.type === 'income' && !isInvestment(tx)).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const exp = txs.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      const inv = txs.filter(isInvestment).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
      data.push({ label: MONTHS[month].slice(0, 3), income: inc, expense: exp, investment: inv });
    }
    return data;
  }, [transactions, curMonth, curYear]);

  const chartMax = Math.max(...chartData.flatMap((entry) => [entry.income, entry.expense, entry.investment]), 1);
  const chartHasData = chartData.some((entry) => entry.income > 0 || entry.expense > 0 || entry.investment > 0);
  const chartTick = (value) => `$${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;

  const prevMonth = () => {
    if (curMonth === 0) {
      setCurMonth(11);
      setCurYear((year) => year - 1);
    } else {
      setCurMonth((month) => month - 1);
    }
  };

  const nextMonth = () => {
    if (curMonth === 11) {
      setCurMonth(0);
      setCurYear((year) => year + 1);
    } else {
      setCurMonth((month) => month + 1);
    }
  };

  const syncData = { version: 1, app: 'plansurf-budget', transactions, goals, updatedAt: new Date().toISOString() };
  const apiUrl = (path) => `${API_BASE_URL}${path}`;

  const apiRequest = async (path, options = {}) => {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
        ...(options.headers || {})
      },
      cache: 'no-store'
    });

    const payload = await response.json().catch(() => ({ error: 'The API returned an invalid response.' }));
    if (!response.ok) throw new Error(payload.error || `API request failed (${response.status}).`);
    return payload;
  };

  const loginApi = async (password) => {
    setSyncing(true);
    setSyncStatus('Signing in...');
    try {
      const payload = await apiRequest('/api/budget/login', {
        method: 'POST',
        body: JSON.stringify({ password }),
        headers: {}
      });
      setSessionToken(payload.token);
      setSyncStatus('Signed in');
      return true;
    } catch (error) {
      setSyncStatus('Sign in failed: ' + error.message);
      return false;
    } finally {
      setSyncing(false);
    }
  };

  const logoutApi = async () => {
    try {
      if (sessionToken) await apiRequest('/api/budget/logout', { method: 'POST' });
    } catch {}
    setSessionToken('');
    setSyncStatus('Signed out');
  };

  const applySyncData = (data) => {
    if (!data || (data.app !== undefined && data.app !== 'plansurf-budget') || !data.transactions || typeof data.transactions !== 'object' || Array.isArray(data.transactions) || !Array.isArray(data.goals)) {
      throw new Error('The JSON file is not a valid PlanSurf budget backup.');
    }

    suppressDirty.current = true;
    setTransactions(data.transactions);
    setGoals(data.goals);
  };

  const pullGitHub = async () => {
    if (!sessionToken) {
      setSyncStatus('Sign in before syncing budget data');
      return;
    }

    if (dirty && !window.confirm('Pulling will replace unsaved local changes. Continue?')) {
      return;
    }

    setSyncing(true);
    setSyncStatus('Loading budget...');
    try {
      applySyncData(await apiRequest('/api/budget/data'));
      setDirty(false);
      setSyncStatus('Budget synced');
    } catch (error) {
      setSyncStatus('Pull failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  const pushGitHub = async () => {
    if (!sessionToken) {
      setSyncStatus('Sign in before syncing budget data');
      return;
    }

    setSyncing(true);
    setSyncStatus('Saving budget...');
    try {
      await apiRequest('/api/budget/data', {
        method: 'PUT',
        body: JSON.stringify(syncData)
      });
      setDirty(false);
      setSyncStatus('Budget saved');
    } catch (error) {
      setSyncStatus('Backup failed: ' + error.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <header className="hdr">
        <h1>
          💰 Budget Planner <span className="app-tag">PlanSurf</span>
        </h1>
        <div className="hdr-r">
          <span className="sync-status">{syncStatus}</span>
          <button className="ibtn" title="Budget sync" onClick={() => setSyncModal(true)}>⚙️</button>
          <button className={`ibtn ${dark ? 'on' : ''}`} onClick={() => setDark(!dark)}>{dark ? '☀️' : '🌙'}</button>
        </div>
      </header>

      <main className="layout">
        <div className="month-nav">
          <button className="mnav" onClick={prevMonth}>←</button>
          <h2>{MONTHS[curMonth]} {curYear}</h2>
          <button className="mnav" onClick={nextMonth}>→</button>
        </div>

        <section className="stats">
          <div className="scard">
            <span className="icon">📥</span>
            <div className="label">Income</div>
            <div className="val" style={{ color: 'var(--green)' }}>$ {fmt(income)}</div>
          </div>
          <div className="scard">
            <span className="icon">📤</span>
            <div className="label">Expenses</div>
            <div className="val" style={{ color: 'var(--red)' }}>$ {fmt(expenses)}</div>
          </div>
          <div className="scard">
            <span className="icon">📈</span>
            <div className="label">Investments</div>
            <div className="val" style={{ color: 'var(--purple)' }}>$ {fmt(investments)}</div>
          </div>
          <div className="scard">
            <span className="icon">💸</span>
            <div className="label">Balance</div>
            <div className="val" style={{ color: balance >= 0 ? 'var(--green)' : 'var(--red)' }}>$ {fmt(balance)}</div>
            <div className="sub">{balance >= 0 ? 'Under budget ✓' : 'Over budget ⚠'}</div>
          </div>
          <div className="scard">
            <span className="icon">📊</span>
            <div className="label">Savings Rate</div>
            <div className="val" style={{ color: 'var(--accent)' }}>{savingsRate}%</div>
          </div>
        </section>

        <section className="chart-sec">
          <h3>6-Month Comparison</h3>
          {chartHasData ? (
            <>
              <div className="bar-chart">
                <div className="chart-scale" aria-hidden="true">
                  {[chartMax, chartMax / 2, 0].map((value, index) => (
                    <span key={index}>{chartTick(value)}</span>
                  ))}
                </div>
                <div className="chart-plot">
                  <div className="chart-grid" aria-hidden="true">
                    <span></span><span></span><span></span>
                  </div>
                  {chartData.map((entry, index) => (
                    <div className="bar-group" key={index} aria-label={`${entry.label}: income $${fmt(entry.income)}, expenses $${fmt(entry.expense)}, investments $${fmt(entry.investment)}`}>
                      <div className="bar" style={{ height: `${(entry.income / chartMax) * 100}%`, background: 'var(--green)', minHeight: entry.income ? 4 : 0 }} title={`Income: $${fmt(entry.income)}`}></div>
                      <div className="bar" style={{ height: `${(entry.expense / chartMax) * 100}%`, background: 'var(--red)', minHeight: entry.expense ? 4 : 0 }} title={`Expenses: $${fmt(entry.expense)}`}></div>
                      <div className="bar" style={{ height: `${(entry.investment / chartMax) * 100}%`, background: 'var(--purple)', minHeight: entry.investment ? 4 : 0 }} title={`Investments: $${fmt(entry.investment)}`}></div>
                      <span className="bar-label">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="chart-legend">
                <span className="legend-income">Income</span>
                <span className="legend-expense">Expenses</span>
                <span className="legend-investment">Investments</span>
              </div>
            </>
          ) : (
            <div className="chart-empty">No income, expenses, or investments recorded in the last six months.</div>
          )}
        </section>

        {catBreakdown.length > 0 && (
          <section className="cat-sec">
            <h3>📂 Expense Breakdown</h3>
            <div className="cat-grid">
              {catBreakdown.map((category) => (
                <div className="cat-card" key={category.id}>
                  <div className="cat-icon" style={{ background: `${category.color}20` }}>{category.icon}</div>
                  <div className="cat-info">
                    <div className="cat-name">{category.label}</div>
                    <div className="cat-amt" style={{ color: category.color }}>$ {fmt(category.amount)}</div>
                    <div className="cat-bar"><div className="cat-fill" style={{ width: `${category.pct}%`, background: category.color }}></div></div>
                  </div>
                  <div className="cat-pct">{category.pct}%</div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="tx-sec">
          <h3>
            🧾 Transactions
            <button type="button" className="btn btn-g" onClick={() => { setStatementImportError(''); statementFileInput.current?.click(); }}>
              ⤴ Import statement
            </button>
            <input ref={statementFileInput} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={parseStatementFile} />
          </h3>

          {statementImportError && <div className="import-error" role="alert">{statementImportError}</div>}

          <form className="add-row" onSubmit={addTx}>
            <input
              type="text"
              value={desc}
              onChange={(event) => {
                const nextValue = event.target.value;
                setDesc(nextValue);
                const suggested = inferCategory(nextValue);
                if (suggested) setCat(suggested);
              }}
              placeholder="Description"
            />
            <input type="number" value={amt} onChange={(event) => setAmt(event.target.value)} placeholder="Amount" step="0.01" min="0" />
            <select value={cat} onChange={(event) => setCat(event.target.value)}>
              <optgroup label="Income">
                {CATEGORIES.filter((category) => category.type === 'income').map((category) => (
                  <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
                ))}
              </optgroup>
              <optgroup label="Expense">
                {CATEGORIES.filter((category) => category.type === 'expense').map((category) => (
                  <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
                ))}
              </optgroup>
              <optgroup label="Investments">
                {CATEGORIES.filter((category) => category.type === 'investment').map((category) => (
                  <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
                ))}
              </optgroup>
              <optgroup label="Transfers">
                {CATEGORIES.filter((category) => category.type === 'transfer').map((category) => (
                  <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
                ))}
              </optgroup>
            </select>
            <input type="date" value={txDate} onChange={(event) => setTxDate(event.target.value)} />
            <button type="submit" className="btn btn-p">+ Add</button>
          </form>

          {monthTx.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)', fontSize: 13 }}>No transactions this month.</div>
          ) : (
            <TransactionsTable rows={monthTx} monthKey={key} onUpdate={updateTx} onDelete={deleteTx} />
          )}
        </section>
      </main>

      {statementPreview && <StatementImportModal preview={statementPreview} onClose={() => setStatementPreview(null)} onImport={addStatementTransactions} />}

      {syncModal && (
        <SyncModal
          sessionToken={sessionToken}
          dirty={dirty}
          syncing={syncing}
          onClose={() => setSyncModal(false)}
          onLogin={loginApi}
          onLogout={logoutApi}
          onPull={pullGitHub}
          onPush={pushGitHub}
          status={syncStatus}
        />
      )}
    </div>
  );
}

function StatementImportModal({ preview, onClose, onImport }) {
  const [items, setItems] = useState(preview.items);
  const selectedCount = items.filter((item) => item.include).length;
  const duplicateCount = items.filter((item) => item.duplicate).length;

  const updateItem = (index, updates) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...updates } : item));
  };

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal statement-modal" role="dialog" aria-modal="true" aria-labelledby="statement-import-title" onClick={(event) => event.stopPropagation()}>
        <h3 id="statement-import-title">Review statement transactions</h3>
        <div className="statement-summary">
          {preview.fileName} • {items.length} parsed • {preview.skippedRows} skipped • {duplicateCount} possible duplicates • Positive amounts treated as {preview.format === 'ANZ' ? 'deposits' : 'charges'}
        </div>
        <div className="import-table-wrap">
          <table className="import-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Category</th>
                <th>Include</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const type = CAT_MAP[item.category]?.type || 'expense';
                const marker = type === 'income' ? '+' : type === 'investment' ? '↗' : '−';
                return (
                  <tr key={`${item.date}-${index}`} className={item.duplicate ? 'import-duplicate' : ''}>
                    <td className="import-date">{item.date}</td>
                    <td className="import-description">
                      {item.desc}
                      {item.duplicate && <span className="import-warning">Possible duplicate</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}><span className={`tx-type ${type}`}>{marker} $ {fmt(item.amount)}</span></td>
                    <td>
                      <select value={item.category} aria-label={`Category for ${item.desc}`} onChange={(event) => updateItem(index, { category: event.target.value })}>
                        <optgroup label="Income">
                          {CATEGORIES.filter((category) => category.type === 'income').map((category) => (
                            <option key={category.id} value={category.id}>{category.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Expenses">
                          {CATEGORIES.filter((category) => category.type === 'expense').map((category) => (
                            <option key={category.id} value={category.id}>{category.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Investments">
                          {CATEGORIES.filter((category) => category.type === 'investment').map((category) => (
                            <option key={category.id} value={category.id}>{category.label}</option>
                          ))}
                        </optgroup>
                        <optgroup label="Transfers">
                          {CATEGORIES.filter((category) => category.type === 'transfer').map((category) => (
                            <option key={category.id} value={category.id}>{category.label}</option>
                          ))}
                        </optgroup>
                      </select>
                    </td>
                    <td>
                      <input type="checkbox" aria-label={`Include ${item.desc}`} checked={item.include} onChange={(event) => updateItem(index, { include: event.target.checked })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="import-actions">
          <span className="statement-summary">{selectedCount} of {items.length} selected</span>
          <div className="macts">
            <button type="button" className="btn btn-g" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-p" disabled={!selectedCount} onClick={() => onImport(items)}>Add transactions</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsTable({ rows, monthKey, onUpdate, onDelete }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' });
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => !needle || `${row.date} ${row.desc} ${CAT_MAP[row.category]?.label || row.category}`.toLowerCase().includes(needle));

    return [...filtered].sort((a, b) => {
      const left = a[sort.key] ?? '';
      const right = b[sort.key] ?? '';

      if (sort.key === 'amount') {
        const comparison = Number(left) - Number(right);
        return sort.direction === 'asc' ? comparison : -comparison;
      }

      const comparison = String(left).localeCompare(String(right));
      return sort.direction === 'asc' ? comparison : -comparison;
    });
  }, [rows, query, sort]);

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({ ...row });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const saveEdit = () => {
    if (!draft) return;
    const category = CAT_MAP[draft.category];
    onUpdate(monthKey, { ...draft, amount: Number(draft.amount) || 0, type: category?.type || 'expense' });
    cancelEdit();
  };

  const toggleSort = (key) => {
    setSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: 'asc' });
  };

  const sortLabel = (key) => sort.key === key ? (sort.direction === 'asc' ? '↑' : '↓') : '';

  return (
    <>
      <div className="table-tools">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter rows..." aria-label="Filter transaction rows" />
        {[
          { key: 'date', label: 'Date' },
          { key: 'desc', label: 'Description' },
          { key: 'category', label: 'Category' },
          { key: 'amount', label: 'Amount' }
        ].map((column) => (
          <button key={column.key} className="sort-btn" onClick={() => toggleSort(column.key)}>
            Sort {column.label} {sortLabel(column.key)}
          </button>
        ))}
        <span className="count">{visibleRows.length} of {rows.length} rows</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tx-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              editingId === row.id ? (
                <TransactionEditRow key={row.id} draft={draft} setDraft={setDraft} onSave={saveEdit} onCancel={cancelEdit} />
              ) : (
                <TransactionViewRow key={row.id} row={row} onEdit={startEdit} onDelete={onDelete} />
              )
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TransactionViewRow({ row, onEdit, onDelete }) {
  const category = CAT_MAP[row.category];
  const investment = isInvestment(row);
  const transfer = row.category === 'transfer' || row.type === 'transfer';

  return (
    <tr>
      <td style={{ fontSize: 12, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{row.date}</td>
      <td>{row.desc}</td>
      <td>
        <span className="tx-cat-badge" style={{ background: `${(category?.color || '#666')}20`, color: category?.color || 'var(--text-sec)' }}>
          {category?.icon} {category?.label || row.category}
        </span>
      </td>
      <td style={{ textAlign: 'right' }}>
        <span className={`tx-type ${investment ? 'investment' : transfer ? 'transfer' : row.type}`}>
          {investment ? '↗' : transfer ? '↔' : row.type === 'income' ? '+' : '-'} ${fmt(Number(row.amount) || 0)}
        </span>
      </td>
      <td>
        <div className="tx-acts">
          <button className="abtn" onClick={() => onEdit(row)}>Edit</button>
          <button className="abtn del" onClick={() => onDelete(row.id)}>✕</button>
        </div>
      </td>
    </tr>
  );
}

function TransactionEditRow({ draft, setDraft, onSave, onCancel }) {
  const setValue = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const setDescription = (value) => {
    const suggested = inferCategory(value);
    setDraft((current) => ({ ...current, desc: value, ...(suggested ? { category: suggested } : {}) }));
  };

  return (
    <tr>
      <td><input className="edit-cell" type="date" value={draft.date || ''} onChange={(event) => setValue('date', event.target.value)} /></td>
      <td><input className="edit-cell" value={draft.desc || ''} onChange={(event) => setDescription(event.target.value)} /></td>
      <td>
        <select className="edit-cell" value={draft.category || ''} onChange={(event) => setValue('category', event.target.value)}>
          <optgroup label="Income">
            {CATEGORIES.filter((category) => category.type === 'income').map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
            ))}
          </optgroup>
          <optgroup label="Expense">
            {CATEGORIES.filter((category) => category.type === 'expense').map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
            ))}
          </optgroup>
          <optgroup label="Investments">
            {CATEGORIES.filter((category) => category.type === 'investment').map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
            ))}
          </optgroup>
          <optgroup label="Transfers">
            {CATEGORIES.filter((category) => category.type === 'transfer').map((category) => (
              <option key={category.id} value={category.id}>{category.icon} {category.label}</option>
            ))}
          </optgroup>
        </select>
      </td>
      <td><input className="edit-cell" type="number" min="0" step="0.01" value={draft.amount ?? ''} onChange={(event) => setValue('amount', event.target.value)} /></td>
      <td>
        <div className="row-edit-actions">
          <button className="abtn save" onClick={onSave}>Save</button>
          <button className="abtn cancel" onClick={onCancel}>Cancel</button>
        </div>
      </td>
    </tr>
  );
}

function SyncModal({ sessionToken, dirty, syncing, onClose, onLogin, onLogout, onPull, onPush, status }) {
  const [password, setPassword] = useState('');

  return (
    <div className="modal-ov" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <h3>Budget Sync</h3>

        {!sessionToken && (
          <div className="fg">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              onKeyDown={async (event) => {
                if (event.key === 'Enter' && !syncing && password.trim()) {
                  const success = await onLogin(password);
                  if (success) setPassword('');
                }
              }}
            />
            {status && <div className="hint">{status}</div>}
          </div>
        )}

        <div className="sync-note">Status: {status}{dirty ? ' • local changes need backup' : ''}</div>

        <div className="sync-actions">
          <button className="btn btn-g" onClick={onClose}>Close</button>
          {sessionToken ? (
            <>
              <button className="btn btn-g" disabled={syncing} onClick={onPull}>⇣ Pull latest</button>
              <button className="btn btn-p" disabled={syncing} onClick={onPush}>⇡ Save local data</button>
              <button className="btn btn-g" disabled={syncing} onClick={onLogout}>Sign out</button>
            </>
          ) : (
            <button
              className="btn btn-p"
              disabled={syncing || !password.trim()}
              onClick={async () => {
                const success = await onLogin(password);
                if (success) setPassword('');
              }}
            >
              {syncing ? 'Signing in...' : 'Sign in'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
