
import React, { useEffect, useMemo, useState } from 'react'
import { supabase, TERMINAL_ID } from './supabaseClient'

const fmt = (n) => Number(n || 0).toFixed(2)
const todayISO = () => new Date().toISOString().slice(0, 10)
const normalize = (v) => String(v || '').trim().toLowerCase()
const DEFAULT_TABLES = [...Array.from({ length: 12 }, (_, i) => ({ id: `T${i + 1}`, label: `Стол ${i + 1}`, mode: 'hall' })), { id: 'TA', label: 'С собой', mode: 'takeaway' }, { id: 'DL', label: 'Доставка', mode: 'delivery' }, { id: 'BAR', label: 'Бар', mode: 'hall' }, { id: 'VIP', label: 'VIP', mode: 'hall' }]
const DEFAULT_HALLS = ['Основной зал', 'Терраса', 'VIP']

function inferItemType(item) {
  const value = normalize(`${item?.category || ''} ${item?.name || ''}`)
  if (value.includes('кофе') || value.includes('чай') || value.includes('напит') || value.includes('bar') || value.includes('coffee') || value.includes('tea') || value.includes('drink') || value.includes('сок') || value.includes('вода')) return 'Бар'
  return 'Кухня'
}

function printDoc(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:20px;color:#111}h1{margin:0 0 8px}.meta{color:#555;margin-bottom:12px}table{width:100%;border-collapse:collapse}th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}.right{text-align:right}.sum{font-size:24px;font-weight:900;margin-top:16px}</style></head><body>${html}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

function ProductLogo() {
  return <div className="rms-logo"><div className="rms-mark">RMS</div><div><strong>RMS POS</strong><span>Restaurant Management System</span></div></div>
}

export default function App() {
  const [screen, setScreen] = useState('login')
  const [pin, setPin] = useState('')
  const [cashier, setCashier] = useState(null)
  const [terminal, setTerminal] = useState(null)
  const [branch, setBranch] = useState(null)
  const [activeShift, setActiveShift] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [closedOrders, setClosedOrders] = useState([])
  const [hourlySales, setHourlySales] = useState([])
  const [dishSales, setDishSales] = useState([])
  const [selectedTable, setSelectedTable] = useState('T1')
  const [drafts, setDrafts] = useState({})
  const [selectedType, setSelectedType] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const tables = terminal?.settings?.tables || DEFAULT_TABLES
  const halls = terminal?.settings?.halls || DEFAULT_HALLS

  useEffect(() => { initTerminal() }, [])
  useEffect(() => { if (terminal?.branch_id) loadClosedOrders() }, [terminal?.branch_id, activeShift?.id])
  useEffect(() => { loadReports() }, [closedOrders.length])

  async function initTerminal() {
    if (!supabase) return setMessage('Supabase не настроен. Проверь Vercel Environment Variables.')
    setMessage('Загрузка POS-терминала...')

    const { data: terminalRow, error } = await supabase
      .from('pos_terminals')
      .select('*')
      .eq('terminal_code', TERMINAL_ID)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return setMessage(error.message)
    if (!terminalRow) return setMessage(`Терминал ${TERMINAL_ID} не найден. Создай его в pos_terminals и привяжи к филиалу.`)

    setTerminal(terminalRow)
    if (terminalRow.branch_name) setBranch({ id: terminalRow.branch_id, name: terminalRow.branch_name, is_active: true })

    const { data: branchRow, error: branchError } = await supabase
      .from('branches')
      .select('id,name,is_active')
      .eq('id', terminalRow.branch_id)
      .maybeSingle()

    if (branchError) {
      setBranch(terminalRow.branch_name ? { id: terminalRow.branch_id, name: terminalRow.branch_name, is_active: true } : null)
      setMessage(`Терминал найден, но филиал не загрузился: ${branchError.message}`)
    } else {
      setBranch(branchRow || (terminalRow.branch_name ? { id: terminalRow.branch_id, name: terminalRow.branch_name, is_active: true } : null))
    }

    const { data: shiftRows } = await supabase
      .from('pos_shifts')
      .select('*')
      .eq('terminal_id', terminalRow.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)

    setActiveShift(shiftRows?.[0] || null)
    await loadMenu()
    if (branchRow?.name) setMessage('')
  }

  async function loadMenu() {
    const { data, error } = await supabase.from('menu_items').select('id,name,category,sale_price,is_active').eq('is_active', true).order('category').order('name')
    if (error) return setMessage(error.message)
    setMenuItems((data || []).map(item => ({ ...item, item_type: inferItemType(item) })))
  }

  async function loadClosedOrders() {
    if (!terminal?.branch_id) return
    let query = supabase.from('pos_orders').select('*, pos_order_items(*)').eq('branch_id', terminal.branch_id).order('created_at', { ascending: false }).limit(60)
    if (activeShift?.id) query = query.eq('shift_id', activeShift.id)
    else query = query.eq('order_date', todayISO())
    const { data, error } = await query
    if (error) { setMessage(error.message); setClosedOrders([]); return }
    setClosedOrders(data || [])
  }

  function loadReports() {
    const rows = closedOrders || []
    const hourly = new Map()
    rows.forEach(order => {
      const dt = new Date(order.closed_at || order.created_at)
      const hour = Number.isFinite(dt.getHours()) ? `${String(dt.getHours()).padStart(2, '0')}:00` : '—'
      const current = hourly.get(hour) || { hour, amount: 0, checks: 0 }
      current.amount += Number(order.total_amount || 0)
      current.checks += 1
      hourly.set(hour, current)
    })
    setHourlySales(Array.from(hourly.values()).sort((a, b) => String(a.hour).localeCompare(String(b.hour))))
    const dishes = new Map()
    rows.flatMap(o => o.pos_order_items || []).forEach(item => {
      const key = item.item_name
      const current = dishes.get(key) || { name: key, qty: 0, amount: 0, type: item.item_type || '' }
      current.qty += Number(item.quantity || 0)
      current.amount += Number(item.total_amount || 0)
      dishes.set(key, current)
    })
    setDishSales(Array.from(dishes.values()).sort((a, b) => b.amount - a.amount).slice(0, 30))
  }

  function handlePin(key) {
    if (key === 'C') return setPin('')
    if (key === '⌫') return setPin(p => p.slice(0, -1))
    setPin(p => (p + String(key)).slice(0, 4))
  }

  async function loginByPin() {
    if (!terminal) return setMessage('Терминал не загружен')
    if (pin.length !== 4) return setMessage('Введите PIN из 4 цифр')
    const { data, error } = await supabase.from('pos_users').select('*').eq('pin_code', pin).eq('is_active', true).maybeSingle()
    if (error) return setMessage(error.message)
    if (!data) { setMessage('Неверный PIN'); setPin(''); return }
    setCashier(data)
    setScreen(activeShift ? 'pos' : 'shift')
    setPin('')
    setMessage('')
  }

  async function openShift() {
    if (!cashier || !terminal) return
    setLoading(true); setMessage('')
    try {
      const { data, error } = await supabase.from('pos_shifts').insert({ terminal_id: terminal.id, terminal_code: terminal.terminal_code, branch_id: terminal.branch_id, opened_by_user_id: cashier.id, opened_by_name: cashier.full_name, opened_at: new Date().toISOString(), opening_cash_amount: 0, status: 'open' }).select('*').single()
      if (error) throw error
      setActiveShift(data); setScreen('pos'); setMessage('Кассовая смена открыта')
    } catch (error) { setMessage(error.message || 'Не удалось открыть смену') }
    finally { setLoading(false) }
  }

  async function closeShift() {
    if (!activeShift || !cashier) return setMessage('Нет открытой смены')
    if (!window.confirm('Закрыть кассовую смену?')) return
    setLoading(true)
    try {
      const totalSales = closedOrders.reduce((s, o) => s + Number(o.total_amount || 0), 0)
      const cashSales = closedOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total_amount || 0), 0)
      const bankSales = closedOrders.filter(o => o.payment_method === 'bank').reduce((s, o) => s + Number(o.total_amount || 0), 0)
      const woltSales = closedOrders.filter(o => o.payment_method === 'wolt').reduce((s, o) => s + Number(o.total_amount || 0), 0)
      const { error } = await supabase.from('pos_shifts').update({ status: 'closed', closed_by_user_id: cashier.id, closed_by_name: cashier.full_name, closed_at: new Date().toISOString(), total_sales: totalSales, cash_sales: cashSales, bank_sales: bankSales, delivery_sales: woltSales, check_count: closedOrders.length }).eq('id', activeShift.id)
      if (error) throw error
      setActiveShift(null); setScreen('shift'); setMessage(`Смена закрыта. Выручка: ${fmt(totalSales)} AZN`)
    } catch (error) { setMessage(error.message || 'Не удалось закрыть смену') }
    finally { setLoading(false) }
  }

  function logout() { setCashier(null); setPin(''); setScreen('login') }

  function currentDraft() {
    return drafts[selectedTable] || { table_name: tables.find(t => t.id === selectedTable)?.label || selectedTable, hall_name: halls[0], order_mode: tables.find(t => t.id === selectedTable)?.mode || 'hall', guest_count: 1, payment_method: tables.find(t => t.id === selectedTable)?.mode === 'delivery' ? 'wolt' : 'cash', customer_name: '', items: [] }
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
    setDrafts(prev => prev[table.id] ? prev : { ...prev, [table.id]: { table_name: table.label, hall_name: halls[0], order_mode: table.mode, guest_count: 1, payment_method: table.mode === 'delivery' ? 'wolt' : 'cash', customer_name: '', items: [] } })
  }

  const categories = useMemo(() => Array.from(new Set(menuItems.filter(i => !selectedType || i.item_type === selectedType).map(i => i.category || 'Без категории'))).sort((a,b)=>String(a).localeCompare(String(b),'ru')), [menuItems, selectedType])
  const visibleItems = useMemo(() => {
    const q = normalize(search)
    return menuItems.filter(i => !selectedType || i.item_type === selectedType).filter(i => !selectedCategory || (i.category || 'Без категории') === selectedCategory).filter(i => !q || normalize(`${i.name} ${i.category}`).includes(q)).slice(0, 220)
  }, [menuItems, selectedType, selectedCategory, search])

  function addItem(item) {
    if (!activeShift) return setMessage('Сначала открой кассовую смену')
    setDraft(current => {
      const existing = (current.items || []).find(x => String(x.menu_item_id) === String(item.id))
      const nextItems = existing ? current.items.map(x => String(x.menu_item_id) === String(item.id) ? { ...x, quantity: Number(x.quantity || 0) + 1 } : x) : [...(current.items || []), { local_id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, menu_item_id: item.id, item_name: item.name, item_category: item.category || null, item_type: item.item_type || inferItemType(item), quantity: 1, unit_price: Number(item.sale_price || 0), comment: '' }]
      return { ...current, items: nextItems }
    })
  }

  function updateItem(localId, patch) { setDraft(current => ({ ...current, items: (current.items || []).map(item => item.local_id === localId ? { ...item, ...patch } : item).filter(item => Number(item.quantity || 0) > 0) })) }
  function clearOrder() { if (window.confirm('Очистить текущий заказ?')) setDraft({ ...draft, items: [] }) }

  function precheck() {
    if (!items.length) return setMessage('Заказ пуст')
    const rows = items.map(i => `<tr><td>${i.item_name}</td><td class="right">${fmt(i.quantity)}</td><td class="right">${fmt(i.unit_price)}</td><td class="right">${fmt(i.quantity * i.unit_price)}</td></tr>`).join('')
    printDoc('Пречек', `<h1>Пречек</h1><div class="meta">${draft.table_name} · гостей: ${draft.guest_count} · кассир: ${cashier?.full_name || ''}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th><th class="right">Цена</th><th class="right">Сумма</th></tr></thead><tbody>${rows}</tbody></table><div class="sum">Итого: ${fmt(total)} AZN</div>`)
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
    const { data } = await supabase.from('daily_revenue_entries').select('cash_amount,bank_amount,wolt_amount').eq('branch_id', activeBranchId).eq('revenue_date', activeDate).is('deleted_at', null)
    const totals = (data || []).reduce((acc, row) => { acc.cash_amount += Number(row.cash_amount || 0); acc.bank_amount += Number(row.bank_amount || 0); acc.wolt_amount += Number(row.wolt_amount || 0); return acc }, { cash_amount: 0, bank_amount: 0, wolt_amount: 0 })
    await supabase.from('daily_revenue').upsert({ branch_id: activeBranchId, revenue_date: activeDate, cash_amount: totals.cash_amount, bank_amount: totals.bank_amount, wolt_amount: totals.wolt_amount }, { onConflict: 'branch_id,revenue_date' })
  }

  async function closeCheck() {
    if (!activeShift) return setMessage('Сначала открой кассовую смену')
    if (!items.length) return setMessage('Заказ пуст')
    setLoading(true); setMessage('')
    try {
      const payment = draft.payment_method || 'cash'
      const { data: order, error: orderError } = await supabase.from('pos_orders').insert({ branch_id: terminal.branch_id, terminal_id: terminal.id, terminal_code: terminal.terminal_code, shift_id: activeShift.id, order_date: todayISO(), table_name: draft.table_name || selectedTable, customer_name: draft.customer_name || null, payment_method: payment, total_amount: total, status: 'closed', closed_at: new Date().toISOString(), hall_name: draft.hall_name || null, guest_count: Number(draft.guest_count || 1), order_mode: draft.order_mode || 'hall', cashier_name: cashier?.full_name || null, pos_user_id: cashier?.id || null }).select('*').single()
      if (orderError) throw orderError
      const rows = items.map(i => ({ order_id: order.id, menu_item_id: i.menu_item_id, item_name: i.item_name, item_category: i.item_category, item_type: i.item_type, quantity: Number(i.quantity || 0), unit_price: Number(i.unit_price || 0), total_amount: Number(i.quantity || 0) * Number(i.unit_price || 0) }))
      const { error: itemsError } = await supabase.from('pos_order_items').insert(rows)
      if (itemsError) throw itemsError
      const { error: revenueError } = await supabase.from('daily_revenue_entries').insert({ branch_id: terminal.branch_id, revenue_date: todayISO(), cash_amount: payment === 'cash' ? total : 0, bank_amount: payment === 'bank' ? total : 0, wolt_amount: payment === 'wolt' ? total : 0, comment: `RMS POS · ${draft.table_name || selectedTable} · гостей ${draft.guest_count || 1} · кассир ${cashier?.full_name || ''}` })
      if (revenueError) throw revenueError
      await recalcDailyRevenue(terminal.branch_id, todayISO())
      setDraft({ ...draft, items: [] })
      await loadClosedOrders()
      setMessage('Чек закрыт и отправлен в RMS')
    } catch (error) { setMessage(error?.message || 'Не удалось закрыть чек') }
    finally { setLoading(false) }
  }

  function tableSummary(tableId) {
    const d = drafts[tableId]; const list = d?.items || []
    return { count: list.length, total: list.reduce((s, i) => s + Number(i.quantity || 0) * Number(i.unit_price || 0), 0), guests: d?.guest_count || 1, mode: d?.order_mode || tables.find(t => t.id === tableId)?.mode || 'hall' }
  }

  const shiftTotals = useMemo(() => {
    const cash = closedOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const bank = closedOrders.filter(o => o.payment_method === 'bank').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const wolt = closedOrders.filter(o => o.payment_method === 'wolt').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    return { cash, bank, wolt, total: cash + bank + wolt, checks: closedOrders.length }
  }, [closedOrders])

  if (screen === 'login') return <div className="login-screen"><div className="login-card"><ProductLogo /><p>Вход только по PIN. Сотрудник и позиция определяются автоматически.</p><div className="terminal-info"><span>Терминал: <b>{TERMINAL_ID}</b></span><span>Филиал: <b>{branch?.name || terminal?.branch_name || 'не привязан'}</b></span></div>{message && <div className="message bad">{message}</div>}<label>PIN</label><input value={'•'.repeat(pin.length)} readOnly placeholder="4 цифры" /><div className="pin-grid">{[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map(k => <button key={k} onClick={() => handlePin(k)}>{k}</button>)}</div><button className="primary full" onClick={loginByPin}>Войти</button></div></div>

  if (screen === 'shift') return <div className="login-screen"><div className="login-card shift-card"><ProductLogo /><h2>Кассовая смена</h2><p>Сотрудник: <b>{cashier?.full_name}</b> · {cashier?.position || 'позиция не указана'}</p><p>Филиал: <b>{branch?.name || terminal?.branch_name}</b></p>{message && <div className={`message ${message.includes('закрыта') ? 'good' : 'bad'}`}>{message}</div>}{!activeShift && <button className="primary full" disabled={loading} onClick={openShift}>{loading ? 'Открытие...' : 'Открыть кассовую смену'}</button>}{activeShift && <button className="primary full" onClick={() => setScreen('pos')}>Перейти в POS</button>}<button className="ghost full" onClick={logout}>Выйти</button></div></div>

  return (
    <div className="pos-app">
      <header className="top"><ProductLogo /><div className="top-meta"><b>{cashier?.full_name}</b><span>{cashier?.position || '—'} · {branch?.name || terminal?.branch_name || 'филиал не привязан'} · смена #{String(activeShift?.id || '').slice(0, 8)}</span></div><button onClick={loadMenu}>Обновить меню</button><button onClick={() => setScreen('shift')}>Смена</button><button onClick={logout}>Выход</button></header>
      {message && <div className={`message ${message.includes('закрыт') || message.includes('отправлен') || message.includes('открыта') ? 'good' : ''}`}>{message}</div>}
      <main className="layout">
        <section className="order"><div className="section-title"><h2>Заказ</h2><span>{draft.table_name} · {draft.order_mode === 'takeaway' ? 'с собой' : draft.order_mode === 'delivery' ? 'доставка' : 'зал'}</span></div><div className="meta-grid"><input value={draft.table_name} onChange={e => setDraft({ table_name: e.target.value })} /><input type="number" min="1" value={draft.guest_count} onChange={e => setDraft({ guest_count: Number(e.target.value || 1) })} /><select value={draft.order_mode} onChange={e => setDraft({ order_mode: e.target.value })}><option value="hall">Зал</option><option value="takeaway">С собой</option><option value="delivery">Доставка</option></select><select value={draft.hall_name} onChange={e => setDraft({ hall_name: e.target.value })}>{halls.map(h => <option key={h}>{h}</option>)}</select></div><div className="order-list">{items.map(i => <div className="order-row" key={i.local_id}><div><b>{i.item_name}</b><small>{i.item_type} · {i.item_category || '—'}</small></div><input value={i.quantity} onChange={e => updateItem(i.local_id, { quantity: Number(e.target.value || 0) })} /><span>{fmt(i.unit_price)}</span><b>{fmt(i.quantity * i.unit_price)}</b><button onClick={() => updateItem(i.local_id, { quantity: 0 })}>×</button></div>)}{!items.length && <div className="empty">Выбери стол и позиции меню</div>}</div><div className="total"><span>Позиций: {items.length}</span><span>Кол-во: {fmt(qty)}</span><b>{fmt(total)} AZN</b></div><div className="pay-row">{[['cash','Наличные'],['bank','Карта'],['wolt','Wolt']].map(([key,label]) => <button key={key} className={draft.payment_method === key ? 'active' : ''} onClick={() => setDraft({ payment_method: key })}>{label}</button>)}</div><div className="actions"><button onClick={() => printStation('Кухня')}>Кухня</button><button onClick={() => printStation('Бар')}>Бар</button><button onClick={precheck}>Пречек</button><button onClick={splitCheck}>Разделить</button><button className="danger" onClick={clearOrder}>Отмена</button><button className="primary" disabled={loading} onClick={closeCheck}>{loading ? '...' : 'Чек'}</button></div></section>
        <section className="tables"><div className="section-title"><h2>Столы</h2><span>ячейки заказов</span></div><div className="table-grid">{tables.map(table => { const s = tableSummary(table.id); const busy = s.count > 0; return <button key={table.id} className={`${selectedTable === table.id ? 'active' : ''} ${busy ? 'busy' : ''}`} onClick={() => selectTable(table)}><b>{table.label}</b><span>{busy ? `${s.count} поз.` : 'свободен'}</span><small>{s.mode === 'takeaway' ? 'с собой' : s.mode === 'delivery' ? 'доставка' : `гостей: ${s.guests}`}</small><strong>{fmt(s.total)}</strong></button> })}</div></section>
        <section className="menu"><div className="menu-toolbar"><button onClick={() => { setSelectedType(''); setSelectedCategory('') }}>⌂</button><button onClick={() => { if (selectedCategory) setSelectedCategory(''); else setSelectedType('') }}>←</button><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск" /></div>{!selectedType && <div className="tile-grid root"><button onClick={() => setSelectedType('Кухня')}>Еда</button><button onClick={() => setSelectedType('Бар')}>Напитки</button></div>}{selectedType && !selectedCategory && <div className="tile-grid">{categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)}>{c}</button>)}{!categories.length && <div className="empty">Категорий нет</div>}</div>}{selectedType && selectedCategory && <div className="menu-grid">{visibleItems.map(item => <button key={item.id} onClick={() => addItem(item)}><small>{item.category || '—'}</small><b>{item.name}</b><span>{fmt(item.sale_price)} AZN</span></button>)}{!visibleItems.length && <div className="empty">Позиции не найдены</div>}</div>}</section>
      </main>
      <section className="closed"><div className="closed-head"><h3>Смена / отчёты</h3><button className="danger" disabled={loading || !activeShift} onClick={closeShift}>Закрыть смену</button></div><div className="report-grid"><div><span>Чеков</span><b>{shiftTotals.checks}</b></div><div><span>Наличные</span><b>{fmt(shiftTotals.cash)}</b></div><div><span>Карта</span><b>{fmt(shiftTotals.bank)}</b></div><div><span>Доставка</span><b>{fmt(shiftTotals.wolt)}</b></div><div><span>Итого</span><b>{fmt(shiftTotals.total)}</b></div></div><div className="mini-reports"><div><h4>Продажи по часам</h4>{hourlySales.map(h => <p key={h.hour}><span>{h.hour}</span><b>{fmt(h.amount)} AZN</b><small>{h.checks} чек.</small></p>)}{!hourlySales.length && <span className="muted">Нет данных</span>}</div><div><h4>Продажи блюд</h4>{dishSales.slice(0, 10).map(d => <p key={d.name}><span>{d.name}</span><b>{fmt(d.amount)} AZN</b><small>{fmt(d.qty)} шт.</small></p>)}{!dishSales.length && <span className="muted">Нет данных</span>}</div></div></section>
    </div>
  )
}
