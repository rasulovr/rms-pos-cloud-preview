import React, { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabaseClient'

const fmt = (n) => Number(n || 0).toFixed(2)
const todayISO = () => new Date().toISOString().slice(0, 10)
const uuidLocal = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`
const normalize = (v) => String(v || '').trim().toLowerCase()

const TABLES = [
  ...Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, label: `Стол ${i + 1}`, mode: 'hall' })),
  { id: 'TA', label: 'С собой', mode: 'takeaway' },
  { id: 'DL', label: 'Доставка', mode: 'delivery' },
  { id: 'BAR', label: 'Бар', mode: 'hall' },
  { id: 'VIP', label: 'VIP', mode: 'hall' }
]

const HALLS = ['Основной зал', 'Терраса', 'VIP']

function inferItemType(item) {
  const value = normalize(`${item?.category || ''} ${item?.name || ''}`)
  if (
    value.includes('кофе') ||
    value.includes('чай') ||
    value.includes('напит') ||
    value.includes('bar') ||
    value.includes('coffee') ||
    value.includes('tea') ||
    value.includes('drink') ||
    value.includes('сок') ||
    value.includes('вода')
  ) return 'Бар'
  return 'Кухня'
}

function printDoc(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#111}
    h1{margin:0 0 8px}.meta{color:#555;margin-bottom:12px}
    table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
    .right{text-align:right}.sum{font-size:24px;font-weight:900;margin-top:16px}
  </style></head><body>${html}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [cashierName, setCashierName] = useState('')
  const [pin, setPin] = useState('')
  const [cashier, setCashier] = useState(null)

  const [branches, setBranches] = useState([])
  const [branchId, setBranchId] = useState('')
  const [menuItems, setMenuItems] = useState([])
  const [closedOrders, setClosedOrders] = useState([])
  const [date, setDate] = useState(todayISO())

  const [selectedTable, setSelectedTable] = useState('T1')
  const [drafts, setDrafts] = useState({})
  const [menuLevel, setMenuLevel] = useState('root')
  const [selectedType, setSelectedType] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('rms_pos_cloud_cashier')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed?.name) {
          setCashier(parsed)
          setScreen('pos')
        }
      } catch (_e) {}
    }
    loadBase()
  }, [])

  useEffect(() => { loadClosedOrders() }, [branchId, date])

  async function loadBase() {
    if (!supabase) {
      setMessage('Supabase не настроен. Заполни Vercel Environment Variables.')
      return
    }

    const [{ data: branchRows, error: branchError }, { data: menuRows, error: menuError }] = await Promise.all([
      supabase.from('branches').select('id,name,is_active').eq('is_active', true).order('name'),
      supabase.from('menu_items').select('id,name,category,sale_price,is_active').eq('is_active', true).order('category').order('name')
    ])

    if (branchError) setMessage(branchError.message)
    if (menuError) setMessage(menuError.message)

    setBranches(branchRows || [])
    setMenuItems((menuRows || []).map(item => ({ ...item, item_type: inferItemType(item) })))

    if (!branchId && branchRows?.[0]) setBranchId(branchRows[0].id)
  }

  async function loadClosedOrders() {
    if (!supabase || !branchId) return
    const { data, error } = await supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('branch_id', branchId)
      .eq('order_date', date)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      if (String(error.message || '').includes('pos_orders')) {
        setMessage('В Supabase нужно выполнить SQL: rms_pos_cloud_preview_tables.sql')
      } else {
        setMessage(error.message)
      }
      setClosedOrders([])
      return
    }

    setClosedOrders(data || [])
  }

  function handlePin(key) {
    if (key === 'C') return setPin('')
    if (key === '⌫') return setPin(p => p.slice(0, -1))
    setPin(p => (p + String(key)).slice(0, 4))
  }

  function login() {
    if (!cashierName.trim()) return setMessage('Введите имя сотрудника')
    if (pin.length !== 4) return setMessage('PIN должен состоять из 4 цифр')
    const next = { name: cashierName.trim(), pin, login_at: new Date().toISOString() }
    setCashier(next)
    localStorage.setItem('rms_pos_cloud_cashier', JSON.stringify(next))
    setPin('')
    setMessage('')
    setScreen('pos')
  }

  function logout() {
    localStorage.removeItem('rms_pos_cloud_cashier')
    setCashier(null)
    setScreen('login')
  }

  function currentDraft() {
    return drafts[selectedTable] || {
      table_name: TABLES.find(t => t.id === selectedTable)?.label || selectedTable,
      hall_name: HALLS[0],
      order_mode: TABLES.find(t => t.id === selectedTable)?.mode || 'hall',
      guest_count: 1,
      payment_method: TABLES.find(t => t.id === selectedTable)?.mode === 'delivery' ? 'wolt' : 'cash',
      customer_name: '',
      items: []
    }
  }

  const draft = currentDraft()
  const items = draft.items || []
  const total = items.reduce((s, item) => s + Number(item.quantity || 0) * Number(item.unit_price || 0), 0)
  const qty = items.reduce((s, item) => s + Number(item.quantity || 0), 0)

  function setDraft(patchOrFn) {
    setDrafts(prev => {
      const current = currentDraft()
      const next = typeof patchOrFn === 'function' ? patchOrFn(current) : { ...current, ...patchOrFn }
      return { ...prev, [selectedTable]: next }
    })
  }

  function selectTable(table) {
    setSelectedTable(table.id)
    setDrafts(prev => {
      if (prev[table.id]) return prev
      return {
        ...prev,
        [table.id]: {
          table_name: table.label,
          hall_name: HALLS[0],
          order_mode: table.mode,
          guest_count: 1,
          payment_method: table.mode === 'delivery' ? 'wolt' : 'cash',
          customer_name: '',
          items: []
        }
      }
    })
  }

  const categories = useMemo(() => {
    const set = new Set(
      menuItems
        .filter(i => !selectedType || i.item_type === selectedType)
        .map(i => i.category || 'Без категории')
    )
    return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'ru'))
  }, [menuItems, selectedType])

  const visibleItems = useMemo(() => {
    const q = normalize(search)
    return menuItems
      .filter(i => !selectedType || i.item_type === selectedType)
      .filter(i => !selectedCategory || (i.category || 'Без категории') === selectedCategory)
      .filter(i => !q || normalize(`${i.name} ${i.category}`).includes(q))
      .slice(0, 220)
  }, [menuItems, selectedType, selectedCategory, search])

  function addItem(item) {
    setDraft(current => {
      const existing = (current.items || []).find(x => String(x.menu_item_id) === String(item.id))
      const nextItems = existing
        ? current.items.map(x => String(x.menu_item_id) === String(item.id) ? { ...x, quantity: Number(x.quantity || 0) + 1 } : x)
        : [...(current.items || []), {
            local_id: uuidLocal(),
            menu_item_id: item.id,
            item_name: item.name,
            item_category: item.category || null,
            item_type: item.item_type || inferItemType(item),
            quantity: 1,
            unit_price: Number(item.sale_price || 0),
            comment: ''
          }]
      return { ...current, items: nextItems }
    })
  }

  function updateItem(localId, patch) {
    setDraft(current => ({
      ...current,
      items: (current.items || []).map(item => item.local_id === localId ? { ...item, ...patch } : item).filter(item => Number(item.quantity || 0) > 0)
    }))
  }

  function clearOrder() {
    if (!window.confirm('Очистить текущий заказ?')) return
    setDraft({ ...draft, items: [] })
  }

  function precheck() {
    if (!items.length) return setMessage('Заказ пуст')
    const rows = items.map(i => `<tr><td>${i.item_name}</td><td class="right">${fmt(i.quantity)}</td><td class="right">${fmt(i.unit_price)}</td><td class="right">${fmt(i.quantity * i.unit_price)}</td></tr>`).join('')
    printDoc('Пречек', `<h1>Пречек</h1><div class="meta">${draft.table_name} · гостей: ${draft.guest_count} · кассир: ${cashier?.name || ''}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th><th class="right">Цена</th><th class="right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="sum">Итого: ${fmt(total)} AZN</div>`)
  }

  function printStation(type) {
    const filtered = items.filter(i => i.item_type === type)
    if (!filtered.length) return setMessage(type === 'Бар' ? 'Нет позиций для бара' : 'Нет позиций для кухни')
    const rows = filtered.map(i => `<tr><td>${i.item_name}</td><td class="right">${fmt(i.quantity)}</td><td>${i.comment || ''}</td></tr>`).join('')
    printDoc(type === 'Бар' ? 'Бар' : 'Кухня', `<h1>${type === 'Бар' ? 'Печать в бар' : 'Печать на кухню'}</h1><div class="meta">${draft.table_name} · гостей: ${draft.guest_count}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th><th>Комментарий</th></tr></thead><tbody>${rows}</tbody></table>`)
  }

  function splitCheck() {
    if (!items.length) return setMessage('Заказ пуст')
    const partA = items.filter((_, idx) => idx % 2 === 0)
    const partB = items.filter((_, idx) => idx % 2 === 1)
    const block = (title, part) => {
      const sum = part.reduce((s, i) => s + i.quantity * i.unit_price, 0)
      return `<h1>${title}</h1><table><tbody>${part.map(i => `<tr><td>${i.item_name}</td><td class="right">${fmt(i.quantity)}</td><td class="right">${fmt(i.quantity * i.unit_price)}</td></tr>`).join('')}</tbody></table><div class="sum">${fmt(sum)} AZN</div>`
    }
    printDoc('Разделить чек', `${block('Часть 1', partA)}${block('Часть 2', partB)}`)
  }

  async function recalcDailyRevenue(activeBranchId, activeDate) {
    const { data } = await supabase
      .from('daily_revenue_entries')
      .select('cash_amount,bank_amount,wolt_amount')
      .eq('branch_id', activeBranchId)
      .eq('revenue_date', activeDate)
      .is('deleted_at', null)

    const totals = (data || []).reduce((acc, row) => {
      acc.cash_amount += Number(row.cash_amount || 0)
      acc.bank_amount += Number(row.bank_amount || 0)
      acc.wolt_amount += Number(row.wolt_amount || 0)
      return acc
    }, { cash_amount: 0, bank_amount: 0, wolt_amount: 0 })

    await supabase.from('daily_revenue').upsert({
      branch_id: activeBranchId,
      revenue_date: activeDate,
      cash_amount: totals.cash_amount,
      bank_amount: totals.bank_amount,
      wolt_amount: totals.wolt_amount
    }, { onConflict: 'branch_id,revenue_date' })
  }

  async function closeCheck() {
    if (!supabase) return setMessage('Supabase не настроен')
    if (!branchId) return setMessage('Выберите филиал')
    if (!items.length) return setMessage('Заказ пуст')

    setLoading(true)
    setMessage('')

    try {
      const { data: order, error: orderError } = await supabase.from('pos_orders').insert({
        branch_id: branchId,
        order_date: date,
        table_name: draft.table_name || selectedTable,
        customer_name: draft.customer_name || null,
        payment_method: draft.payment_method || 'cash',
        total_amount: total,
        status: 'closed',
        closed_at: new Date().toISOString(),
        hall_name: draft.hall_name || null,
        guest_count: Number(draft.guest_count || 1),
        order_mode: draft.order_mode || 'hall',
        cashier_name: cashier?.name || null
      }).select('*').single()

      if (orderError) throw orderError

      const rows = items.map(i => ({
        order_id: order.id,
        menu_item_id: i.menu_item_id,
        item_name: i.item_name,
        item_category: i.item_category,
        item_type: i.item_type,
        quantity: Number(i.quantity || 0),
        unit_price: Number(i.unit_price || 0),
        total_amount: Number(i.quantity || 0) * Number(i.unit_price || 0)
      }))

      const { error: itemsError } = await supabase.from('pos_order_items').insert(rows)
      if (itemsError) throw itemsError

      const payment = draft.payment_method || 'cash'
      const { error: revenueError } = await supabase.from('daily_revenue_entries').insert({
        branch_id: branchId,
        revenue_date: date,
        cash_amount: payment === 'cash' ? total : 0,
        bank_amount: payment === 'bank' ? total : 0,
        wolt_amount: payment === 'wolt' ? total : 0,
        comment: `Cloud POS · ${draft.table_name || selectedTable} · гостей ${draft.guest_count || 1} · кассир ${cashier?.name || ''}`
      })

      if (revenueError) throw revenueError

      await recalcDailyRevenue(branchId, date)

      setDraft({ ...draft, items: [] })
      await loadClosedOrders()
      setMessage('Чек закрыт и отправлен в RMS')
    } catch (error) {
      setMessage(error?.message || 'Не удалось закрыть чек')
    } finally {
      setLoading(false)
    }
  }

  function tableSummary(tableId) {
    const d = drafts[tableId]
    const list = d?.items || []
    return {
      count: list.length,
      total: list.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0),
      guests: d?.guest_count || 1,
      mode: d?.order_mode || TABLES.find(t => t.id === tableId)?.mode || 'hall'
    }
  }

  if (screen === 'login') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <h1>RMS POS Cloud</h1>
          <p>Тестовая cloud-версия POS. Вход сотрудника по 4-значному PIN.</p>
          {message && <div className="message bad">{message}</div>}
          <label>Сотрудник / кассир</label>
          <input value={cashierName} onChange={e => setCashierName(e.target.value)} placeholder="Например, Murad" />
          <label>PIN</label>
          <input value={'•'.repeat(pin.length)} readOnly placeholder="4 цифры" />
          <div className="pin-grid">
            {[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map(k => <button key={k} onClick={() => handlePin(k)}>{k}</button>)}
          </div>
          <button className="primary full" onClick={login}>Войти</button>
        </div>
      </div>
    )
  }

  return (
    <div className="pos-app">
      <header className="top">
        <div>
          <b>RMS POS Cloud Preview</b>
          <span>{cashier?.name} · {branches.find(b => String(b.id) === String(branchId))?.name || 'Филиал не выбран'}</span>
        </div>
        <select value={branchId} onChange={e => setBranchId(e.target.value)}>
          <option value="">Филиал</option>
          {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        <button onClick={loadBase}>Обновить</button>
        <button onClick={logout}>Выход</button>
      </header>

      {message && <div className={`message ${message.includes('закрыт') || message.includes('отправлен') ? 'good' : ''}`}>{message}</div>}

      <main className="layout">
        <section className="order">
          <div className="section-title">
            <h2>Заказ</h2>
            <span>{draft.table_name} · {draft.order_mode === 'takeaway' ? 'с собой' : draft.order_mode === 'delivery' ? 'доставка' : 'зал'}</span>
          </div>

          <div className="meta-grid">
            <input value={draft.table_name} onChange={e => setDraft({ table_name: e.target.value })} />
            <input type="number" min="1" value={draft.guest_count} onChange={e => setDraft({ guest_count: Number(e.target.value || 1) })} />
            <select value={draft.order_mode} onChange={e => setDraft({ order_mode: e.target.value })}>
              <option value="hall">Зал</option>
              <option value="takeaway">С собой</option>
              <option value="delivery">Доставка</option>
            </select>
            <select value={draft.hall_name} onChange={e => setDraft({ hall_name: e.target.value })}>
              {HALLS.map(h => <option key={h}>{h}</option>)}
            </select>
          </div>

          <div className="order-list">
            {items.map(i => (
              <div className="order-row" key={i.local_id}>
                <div>
                  <b>{i.item_name}</b>
                  <small>{i.item_type} · {i.item_category || '—'}</small>
                </div>
                <input value={i.quantity} onChange={e => updateItem(i.local_id, { quantity: Number(e.target.value || 0) })} />
                <span>{fmt(i.unit_price)}</span>
                <b>{fmt(i.quantity * i.unit_price)}</b>
                <button onClick={() => updateItem(i.local_id, { quantity: 0 })}>×</button>
              </div>
            ))}
            {!items.length && <div className="empty">Выбери стол и позиции меню</div>}
          </div>

          <div className="total">
            <span>Позиций: {items.length}</span>
            <span>Кол-во: {fmt(qty)}</span>
            <b>{fmt(total)} AZN</b>
          </div>

          <div className="pay-row">
            {[
              ['cash', 'Наличные'],
              ['bank', 'Карта'],
              ['wolt', 'Wolt']
            ].map(([key, label]) => <button key={key} className={draft.payment_method === key ? 'active' : ''} onClick={() => setDraft({ payment_method: key })}>{label}</button>)}
          </div>

          <div className="actions">
            <button onClick={() => printStation('Кухня')}>Кухня</button>
            <button onClick={() => printStation('Бар')}>Бар</button>
            <button onClick={precheck}>Пречек</button>
            <button onClick={splitCheck}>Разделить</button>
            <button className="danger" onClick={clearOrder}>Отмена</button>
            <button className="primary" disabled={loading} onClick={closeCheck}>{loading ? '...' : 'Чек'}</button>
          </div>
        </section>

        <section className="tables">
          <div className="section-title">
            <h2>Столы</h2>
            <span>ячейки заказов</span>
          </div>
          <div className="table-grid">
            {TABLES.map(table => {
              const s = tableSummary(table.id)
              const busy = s.count > 0
              return (
                <button key={table.id} className={`${selectedTable === table.id ? 'active' : ''} ${busy ? 'busy' : ''}`} onClick={() => selectTable(table)}>
                  <b>{table.label}</b>
                  <span>{busy ? `${s.count} поз.` : 'свободен'}</span>
                  <small>{s.mode === 'takeaway' ? 'с собой' : s.mode === 'delivery' ? 'доставка' : `гостей: ${s.guests}`}</small>
                  <strong>{fmt(s.total)}</strong>
                </button>
              )
            })}
          </div>
        </section>

        <section className="menu">
          <div className="menu-toolbar">
            <button onClick={() => { setSelectedType(''); setSelectedCategory('') }}>⌂</button>
            <button onClick={() => {
              if (selectedCategory) setSelectedCategory('')
              else setSelectedType('')
            }}>←</button>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск" />
          </div>

          {!selectedType && (
            <div className="tile-grid root">
              <button onClick={() => setSelectedType('Кухня')}>Еда</button>
              <button onClick={() => setSelectedType('Бар')}>Напитки</button>
            </div>
          )}

          {selectedType && !selectedCategory && (
            <div className="tile-grid">
              {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)}>{c}</button>)}
              {!categories.length && <div className="empty">Категорий нет</div>}
            </div>
          )}

          {selectedType && selectedCategory && (
            <div className="menu-grid">
              {visibleItems.map(item => (
                <button key={item.id} onClick={() => addItem(item)}>
                  <small>{item.category || '—'}</small>
                  <b>{item.name}</b>
                  <span>{fmt(item.sale_price)} AZN</span>
                </button>
              ))}
              {!visibleItems.length && <div className="empty">Позиции не найдены</div>}
            </div>
          )}
        </section>
      </main>

      <section className="closed">
        <h3>Закрытые чеки за дату</h3>
        <div className="closed-list">
          {closedOrders.map(o => (
            <div key={o.id}>
              <b>{o.table_name || '—'}</b>
              <span>{o.payment_method}</span>
              <strong>{fmt(o.total_amount)} AZN</strong>
              <small>{(o.pos_order_items || []).slice(0, 3).map(i => i.item_name).join(', ')}</small>
            </div>
          ))}
          {!closedOrders.length && <span className="muted">Чеков пока нет</span>}
        </div>
      </section>
    </div>
  )
}
