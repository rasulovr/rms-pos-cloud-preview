import React, { useEffect, useMemo, useState } from 'react'
import { supabase, TERMINAL_ID } from './supabaseClient'

const fmt = (n) => Number(n || 0).toFixed(2)
const nowISO = () => new Date().toISOString()
const todayISO = () => new Date().toISOString().slice(0, 10)
const normalize = (v) => String(v || '').trim().replace(/\s+/g, ' ')
const key = (v) => normalize(v).toLowerCase()

const DEFAULT_TABLES = [
  ...Array.from({ length: 16 }, (_, i) => ({ id: `T${i + 1}`, label: `Стол ${i + 1}`, mode: 'hall' })),
  { id: 'TA', label: 'С собой', mode: 'takeaway' },
  { id: 'DL', label: 'Доставка', mode: 'delivery' },
  { id: 'FAST', label: 'Быстрый чек', mode: 'fastfood' },
  { id: 'BAR', label: 'Бар', mode: 'hall' }
]

const DEFAULT_HALLS = ['Основной зал', 'Терраса', 'VIP']

function inferItemType(item) {
  const value = key(`${item?.category || ''} ${item?.name || ''}`)
  if (
    value.includes('кофе') ||
    value.includes('чай') ||
    value.includes('напит') ||
    value.includes('bar') ||
    value.includes('coffee') ||
    value.includes('tea') ||
    value.includes('drink') ||
    value.includes('сок') ||
    value.includes('вода') ||
    value.includes('lemonade') ||
    value.includes('smoothie') ||
    value.includes('cola')
  ) return 'Бар'
  return 'Кухня'
}

function safeJson(value, fallback) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function ProductLogo() {
  return (
    <div className="rms-logo">
      <div className="rms-mark">RMS</div>
      <div>
        <strong>RMS POS</strong>
        <span>Restaurant Management System</span>
      </div>
    </div>
  )
}

function printDoc(title, html) {
  const w = window.open('', '_blank', 'width=900,height=760')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,sans-serif;padding:20px;color:#111}
    h1{margin:0 0 8px}.meta{color:#555;margin-bottom:12px}
    table{width:100%;border-collapse:collapse} th,td{border-bottom:1px solid #ddd;padding:8px;text-align:left}
    .right{text-align:right}.sum{font-size:24px;font-weight:900;margin-top:16px}.small{font-size:12px;color:#666}
  </style></head><body>${html}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

export default function App() {
  const [screen, setScreen] = useState('login') // login | shift | tables | guest | order | pay | reports
  const [pin, setPin] = useState('')
  const [cashier, setCashier] = useState(null)
  const [terminal, setTerminal] = useState(null)
  const [branch, setBranch] = useState(null)
  const [activeShift, setActiveShift] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [openOrders, setOpenOrders] = useState([])
  const [closedOrders, setClosedOrders] = useState([])
  const [activeOrderId, setActiveOrderId] = useState(null)
  const [selectedTable, setSelectedTable] = useState('')
  const [guestCount, setGuestCount] = useState(2)
  const [selectedHall, setSelectedHall] = useState(DEFAULT_HALLS[0])
  const [selectedType, setSelectedType] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [search, setSearch] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [cashReceived, setCashReceived] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const terminalSettings = safeJson(terminal?.settings, {})
  const tables = terminalSettings.tables || DEFAULT_TABLES
  const halls = terminalSettings.halls || DEFAULT_HALLS
  const activeOrder = openOrders.find(o => String(o.id) === String(activeOrderId)) || null
  const activeItems = activeOrder?.pos_order_items || []
  const activeTotal = activeItems.reduce((s, i) => s + Number(i.total_amount || 0), 0)
  const activeQty = activeItems.reduce((s, i) => s + Number(i.quantity || 0), 0)

  useEffect(() => { initTerminal() }, [])
  useEffect(() => { if (terminal?.branch_id) refreshOrders() }, [terminal?.branch_id, activeShift?.id])

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
    if (!terminalRow) return setMessage(`Терминал ${TERMINAL_ID} не найден в pos_terminals.`)

    setTerminal(terminalRow)

    let branchRow = terminalRow.branch_name
      ? { id: terminalRow.branch_id, name: terminalRow.branch_name, is_active: true }
      : null

    if (!branchRow && terminalRow.branch_id) {
      const { data } = await supabase.from('branches').select('id,name,is_active').eq('id', terminalRow.branch_id).maybeSingle()
      branchRow = data || null
    }

    setBranch(branchRow)

    const { data: shiftRows } = await supabase
      .from('pos_shifts')
      .select('*')
      .eq('terminal_id', terminalRow.id)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)

    setActiveShift(shiftRows?.[0] || null)
    await loadMenu()
    setMessage('')
  }

  async function loadMenu() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('id,name,category,sale_price,is_active')
      .eq('is_active', true)
      .order('category')
      .order('name')

    if (error) {
      setMessage(`Меню не загрузилось: ${error.message}`)
      setMenuItems([])
      return
    }

    setMenuItems((data || []).map(item => ({
      ...item,
      category: item.category || 'Без категории',
      sale_price: Number(item.sale_price || 0),
      item_type: inferItemType(item)
    })))
  }

  async function refreshOrders() {
    if (!terminal?.branch_id) return
    const { data: openData, error: openError } = await supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('branch_id', terminal.branch_id)
      .eq('status', 'open')
      .order('created_at', { ascending: true })

    if (openError) setMessage(openError.message)
    else setOpenOrders((openData || []).map(o => ({ ...o, pos_order_items: o.pos_order_items || [] })))

    let closedQuery = supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('branch_id', terminal.branch_id)
      .eq('status', 'closed')
      .order('closed_at', { ascending: false })
      .limit(80)

    if (activeShift?.id) closedQuery = closedQuery.eq('shift_id', activeShift.id)
    else closedQuery = closedQuery.eq('order_date', todayISO())

    const { data: closedData } = await closedQuery
    setClosedOrders(closedData || [])
  }

  function handlePin(input) {
    if (input === 'C') return setPin('')
    if (input === '⌫') return setPin(p => p.slice(0, -1))
    setPin(p => (p + String(input)).slice(0, 4))
  }

  async function loginByPin() {
    if (!terminal) return setMessage('Терминал не загружен')
    if (pin.length !== 4) return setMessage('Введите PIN из 4 цифр')
    const { data, error } = await supabase
      .from('pos_users')
      .select('*')
      .eq('pin_code', pin)
      .eq('is_active', true)
      .maybeSingle()

    if (error) return setMessage(error.message)
    if (!data) {
      setPin('')
      return setMessage('Неверный PIN')
    }

    setCashier(data)
    setPin('')
    setMessage('')
    setScreen(activeShift ? 'tables' : 'shift')
  }

  async function openShift() {
    if (!cashier || !terminal) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pos_shifts')
        .insert({
          terminal_id: terminal.id,
          terminal_code: terminal.terminal_code,
          branch_id: terminal.branch_id,
          opened_by_user_id: cashier.id,
          opened_by_name: cashier.full_name,
          opened_at: nowISO(),
          opening_cash_amount: 0,
          status: 'open'
        })
        .select('*')
        .single()
      if (error) throw error
      setActiveShift(data)
      setMessage('Кассовая смена открыта')
      setScreen('tables')
    } catch (e) {
      setMessage(e.message || 'Не удалось открыть смену')
    } finally {
      setLoading(false)
    }
  }

  async function closeShift() {
    if (!activeShift) return setMessage('Нет открытой кассовой смены')
    if (openOrders.length) return setMessage(`Нельзя закрыть смену: есть открытые заказы (${openOrders.length})`)
    if (!window.confirm('Закрыть кассовую смену?')) return

    setLoading(true)
    try {
      const totals = shiftTotals
      const { error } = await supabase
        .from('pos_shifts')
        .update({
          status: 'closed',
          closed_by_user_id: cashier?.id || null,
          closed_by_name: cashier?.full_name || '',
          closed_at: nowISO(),
          total_sales: totals.total,
          cash_sales: totals.cash,
          bank_sales: totals.bank,
          delivery_sales: totals.wolt,
          check_count: totals.checks
        })
        .eq('id', activeShift.id)
      if (error) throw error

      setActiveShift(null)
      setScreen('shift')
      setMessage(`Смена закрыта. Выручка: ${fmt(totals.total)} AZN`)
    } catch (e) {
      setMessage(e.message || 'Не удалось закрыть смену')
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    setCashier(null)
    setPin('')
    setScreen('login')
  }

  function tableOrder(tableId) {
    return openOrders.find(o => String(o.table_code || o.table_name) === String(tableId) || String(o.table_name) === String(tables.find(t => t.id === tableId)?.label))
  }

  function tableState(table) {
    const order = tableOrder(table.id)
    if (!order) return { status: 'free', label: 'свободен', amount: 0, order: null }
    const stage = order.order_stage || 'open'
    if (stage === 'precheck') return { status: 'precheck', label: 'пречек', amount: Number(order.total_amount || 0), order }
    if (stage === 'printed') return { status: 'printed', label: 'на кухне/баре', amount: Number(order.total_amount || 0), order }
    return { status: 'busy', label: 'заказ открыт', amount: Number(order.total_amount || 0), order }
  }

  function chooseTable(table) {
    setSelectedTable(table.id)
    setSelectedHall(halls[0] || 'Основной зал')
    const existing = tableOrder(table.id)
    if (existing) {
      setActiveOrderId(existing.id)
      setScreen('order')
      return
    }
    setGuestCount(table.mode === 'fastfood' || table.mode === 'takeaway' || table.mode === 'delivery' ? 1 : 2)
    if (table.mode === 'fastfood') createOrder(table, 1, halls[0] || 'Основной зал')
    else setScreen('guest')
  }

  async function createOrder(table = tables.find(t => t.id === selectedTable), guests = guestCount, hall = selectedHall) {
    if (!activeShift) return setMessage('Сначала открой кассовую смену')
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('pos_orders')
        .insert({
          branch_id: terminal.branch_id,
          terminal_id: terminal.id,
          terminal_code: terminal.terminal_code,
          shift_id: activeShift.id,
          pos_user_id: cashier?.id || null,
          cashier_name: cashier?.full_name || '',
          order_date: todayISO(),
          table_code: table?.id || selectedTable,
          table_name: table?.label || selectedTable,
          hall_name: hall || halls[0] || 'Основной зал',
          order_mode: table?.mode || 'hall',
          guest_count: Number(guests || 1),
          payment_method: table?.mode === 'delivery' ? 'wolt' : 'cash',
          total_amount: 0,
          status: 'open',
          order_stage: 'open',
          opened_at: nowISO()
        })
        .select('*, pos_order_items(*)')
        .single()

      if (error) throw error
      setOpenOrders(prev => [...prev, { ...data, pos_order_items: [] }])
      setActiveOrderId(data.id)
      setSelectedType('')
      setSelectedCategory('')
      setScreen('order')
    } catch (e) {
      setMessage(e.message || 'Не удалось открыть заказ')
    } finally {
      setLoading(false)
    }
  }

  async function patchOrder(orderId, patch) {
    const { error } = await supabase.from('pos_orders').update(patch).eq('id', orderId)
    if (error) {
      setMessage(error.message)
      return false
    }
    setOpenOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...o, ...patch } : o))
    return true
  }

  async function addItem(item) {
    if (!activeOrder) return setMessage('Нет открытого заказа')
    const existing = activeItems.find(x => String(x.menu_item_id) === String(item.id))
    setLoading(true)
    try {
      if (existing) {
        const qty = Number(existing.quantity || 0) + 1
        const total = qty * Number(existing.unit_price || 0)
        const { error } = await supabase
          .from('pos_order_items')
          .update({ quantity: qty, total_amount: total })
          .eq('id', existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('pos_order_items').insert({
          order_id: activeOrder.id,
          menu_item_id: item.id,
          item_name: item.name,
          item_category: item.category || null,
          item_type: item.item_type || inferItemType(item),
          quantity: 1,
          unit_price: Number(item.sale_price || 0),
          total_amount: Number(item.sale_price || 0)
        })
        if (error) throw error
      }
      await reloadOrder(activeOrder.id)
    } catch (e) {
      setMessage(e.message || 'Не удалось добавить позицию')
    } finally {
      setLoading(false)
    }
  }

  async function updateOrderItem(itemId, patch) {
    const old = activeItems.find(i => String(i.id) === String(itemId))
    if (!old) return
    const nextQty = patch.quantity !== undefined ? Number(patch.quantity || 0) : Number(old.quantity || 0)
    if (nextQty <= 0) return deleteItem(itemId)
    const next = { ...patch, quantity: nextQty, total_amount: nextQty * Number(old.unit_price || 0) }
    const { error } = await supabase.from('pos_order_items').update(next).eq('id', itemId)
    if (error) return setMessage(error.message)
    await reloadOrder(activeOrder.id)
  }

  async function deleteItem(itemId) {
    const { error } = await supabase.from('pos_order_items').delete().eq('id', itemId)
    if (error) return setMessage(error.message)
    await reloadOrder(activeOrder.id)
  }

  async function reloadOrder(orderId) {
    const { data, error } = await supabase
      .from('pos_orders')
      .select('*, pos_order_items(*)')
      .eq('id', orderId)
      .maybeSingle()
    if (error || !data) {
      if (error) setMessage(error.message)
      return
    }
    const items = data.pos_order_items || []
    const newTotal = items.reduce((s, i) => s + Number(i.total_amount || 0), 0)
    if (Number(data.total_amount || 0) !== Number(newTotal || 0)) {
      await supabase.from('pos_orders').update({ total_amount: newTotal }).eq('id', orderId)
      data.total_amount = newTotal
    }
    setOpenOrders(prev => prev.map(o => String(o.id) === String(orderId) ? { ...data, pos_order_items: items } : o))
  }

  function printRows(rows, price = false) {
    return rows.map(i => `<tr><td>${i.item_name}</td><td class="right">${fmt(i.quantity)}</td>${price ? `<td class="right">${fmt(i.unit_price)}</td><td class="right">${fmt(i.total_amount)}</td>` : ''}</tr>`).join('')
  }

  async function printStation(type) {
    if (!activeOrder) return
    const rows = activeItems.filter(i => i.item_type === type)
    if (!rows.length) return setMessage(type === 'Бар' ? 'Нет позиций для бара' : 'Нет позиций для кухни')
    printDoc(type, `<h1>${type === 'Бар' ? 'Бар' : 'Кухня'}</h1><div class="meta">${activeOrder.table_name} · ${activeOrder.hall_name || ''} · гостей: ${activeOrder.guest_count || 1} · официант: ${activeOrder.cashier_name || cashier?.full_name || ''}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th></tr></thead><tbody>${printRows(rows)}</tbody></table>`)
    await patchOrder(activeOrder.id, {
      order_stage: 'printed',
      kitchen_printed_at: type === 'Кухня' ? nowISO() : activeOrder.kitchen_printed_at || null,
      bar_printed_at: type === 'Бар' ? nowISO() : activeOrder.bar_printed_at || null
    })
    setMessage(`${type === 'Бар' ? 'Печать в бар' : 'Печать на кухню'} выполнена`)
  }

  async function precheck() {
    if (!activeOrder || !activeItems.length) return setMessage('Заказ пуст')
    printDoc('Пречек', `<h1>Пречек</h1><div class="meta">${activeOrder.table_name} · гостей: ${activeOrder.guest_count || 1} · кассир: ${cashier?.full_name || ''}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th><th class="right">Цена</th><th class="right">Сумма</th></tr></thead><tbody>${printRows(activeItems, true)}</tbody></table><div class="sum">Итого: ${fmt(activeTotal)} AZN</div>`)
    await patchOrder(activeOrder.id, { order_stage: 'precheck', precheck_printed_at: nowISO() })
    setMessage('Пречек распечатан')
  }

  async function cancelPrecheck() {
    if (!activeOrder) return
    await patchOrder(activeOrder.id, { order_stage: 'open', precheck_printed_at: null })
    setMessage('Пречек отменён')
  }

  async function cancelOrder() {
    if (!activeOrder) return
    if (!window.confirm('Отменить заказ?')) return
    const { error } = await supabase.from('pos_orders').update({ status: 'cancelled', order_stage: 'cancelled' }).eq('id', activeOrder.id)
    if (error) return setMessage(error.message)
    setOpenOrders(prev => prev.filter(o => String(o.id) !== String(activeOrder.id)))
    setActiveOrderId(null)
    setScreen('tables')
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
    if (!activeOrder || !activeItems.length) return setMessage('Заказ пуст')
    setLoading(true)
    try {
      const pay = paymentMethod || activeOrder.payment_method || 'cash'
      const { error } = await supabase
        .from('pos_orders')
        .update({
          status: 'closed',
          order_stage: 'closed',
          payment_method: pay,
          total_amount: activeTotal,
          closed_at: nowISO()
        })
        .eq('id', activeOrder.id)
      if (error) throw error

      const { error: revError } = await supabase.from('daily_revenue_entries').insert({
        branch_id: terminal.branch_id,
        revenue_date: todayISO(),
        cash_amount: pay === 'cash' ? activeTotal : 0,
        bank_amount: pay === 'bank' ? activeTotal : 0,
        wolt_amount: pay === 'wolt' ? activeTotal : 0,
        comment: `RMS POS · ${activeOrder.table_name} · гостей ${activeOrder.guest_count || 1} · кассир ${cashier?.full_name || ''}`
      })
      if (revError) throw revError
      await recalcDailyRevenue(terminal.branch_id, todayISO())

      printDoc('Чек', `<h1>Чек</h1><div class="meta">${activeOrder.table_name} · ${pay === 'cash' ? 'Наличные' : pay === 'bank' ? 'Карта' : 'Доставка'} · кассир: ${cashier?.full_name || ''}</div><table><thead><tr><th>Позиция</th><th class="right">Кол-во</th><th class="right">Цена</th><th class="right">Сумма</th></tr></thead><tbody>${printRows(activeItems, true)}</tbody></table><div class="sum">Итого: ${fmt(activeTotal)} AZN</div>`)

      setOpenOrders(prev => prev.filter(o => String(o.id) !== String(activeOrder.id)))
      setActiveOrderId(null)
      setPaymentMethod('cash')
      setCashReceived('')
      await refreshOrders()
      setScreen('tables')
      setMessage('Чек закрыт и отправлен в RMS')
    } catch (e) {
      setMessage(e.message || 'Не удалось закрыть чек')
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const list = menuItems
      .filter(i => !selectedType || i.item_type === selectedType)
      .map(i => i.category || 'Без категории')
    return Array.from(new Set(list)).sort((a, b) => String(a).localeCompare(String(b), 'ru'))
  }, [menuItems, selectedType])

  const visibleItems = useMemo(() => {
    const q = key(search)
    return menuItems
      .filter(i => !selectedType || i.item_type === selectedType)
      .filter(i => !selectedCategory || (i.category || 'Без категории') === selectedCategory)
      .filter(i => !q || key(`${i.name} ${i.category}`).includes(q))
      .slice(0, 240)
  }, [menuItems, selectedType, selectedCategory, search])

  const shiftTotals = useMemo(() => {
    const cash = closedOrders.filter(o => o.payment_method === 'cash').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const bank = closedOrders.filter(o => o.payment_method === 'bank').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    const wolt = closedOrders.filter(o => o.payment_method === 'wolt').reduce((s, o) => s + Number(o.total_amount || 0), 0)
    return { cash, bank, wolt, total: cash + bank + wolt, checks: closedOrders.length }
  }, [closedOrders])

  const hourlySales = useMemo(() => {
    const map = new Map()
    closedOrders.forEach(order => {
      const dt = new Date(order.closed_at || order.created_at)
      const hour = Number.isFinite(dt.getHours()) ? `${String(dt.getHours()).padStart(2, '0')}:00` : '—'
      const row = map.get(hour) || { hour, amount: 0, checks: 0 }
      row.amount += Number(order.total_amount || 0)
      row.checks += 1
      map.set(hour, row)
    })
    return Array.from(map.values()).sort((a, b) => String(a.hour).localeCompare(String(b.hour)))
  }, [closedOrders])

  const dishSales = useMemo(() => {
    const map = new Map()
    closedOrders.flatMap(o => o.pos_order_items || []).forEach(item => {
      const row = map.get(item.item_name) || { name: item.item_name, qty: 0, amount: 0, type: item.item_type || '' }
      row.qty += Number(item.quantity || 0)
      row.amount += Number(item.total_amount || 0)
      map.set(item.item_name, row)
    })
    return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 30)
  }, [closedOrders])

  function Header() {
    return (
      <header className="top">
        <ProductLogo />
        <div className="top-meta">
          <b>{cashier?.full_name || '—'}</b>
          <span>{cashier?.position || '—'} · {branch?.name || terminal?.branch_name || 'филиал не привязан'} · {activeShift ? `смена #${String(activeShift.id).slice(0, 8)}` : 'смена закрыта'}</span>
        </div>
        <button onClick={loadMenu}>Обновить меню</button>
        <button onClick={() => setScreen('tables')}>Столы</button>
        <button onClick={() => setScreen('reports')}>Отчёты</button>
        <button onClick={logout}>Выход</button>
      </header>
    )
  }

  if (screen === 'login') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <ProductLogo />
          <p>Вход только по PIN. Сотрудник и позиция определяются автоматически.</p>
          <div className="terminal-info">
            <span>Терминал: <b>{TERMINAL_ID}</b></span>
            <span>Филиал: <b>{branch?.name || terminal?.branch_name || 'не привязан'}</b></span>
          </div>
          {message && <div className="message bad">{message}</div>}
          <input value={'•'.repeat(pin.length)} readOnly placeholder="PIN" />
          <div className="pin-grid">{[1,2,3,4,5,6,7,8,9,'C',0,'⌫'].map(x => <button key={x} onClick={() => handlePin(x)}>{x}</button>)}</div>
          <button className="primary full" onClick={loginByPin}>Войти</button>
        </div>
      </div>
    )
  }

  if (screen === 'shift') {
    return (
      <div className="login-screen">
        <div className="login-card shift-card">
          <ProductLogo />
          <h2>Кассовая смена</h2>
          <p>Сотрудник: <b>{cashier?.full_name}</b> · {cashier?.position || 'позиция не указана'}</p>
          <p>Филиал: <b>{branch?.name || terminal?.branch_name}</b></p>
          {message && <div className="message">{message}</div>}
          {!activeShift && <button className="primary full" disabled={loading} onClick={openShift}>{loading ? 'Открытие...' : 'Открыть кассовую смену'}</button>}
          {activeShift && <button className="primary full" onClick={() => setScreen('tables')}>Перейти к столам</button>}
          <button className="ghost full" onClick={logout}>Выйти</button>
        </div>
      </div>
    )
  }

  if (screen === 'guest') {
    const table = tables.find(t => t.id === selectedTable)
    return (
      <div className="pos-app">
        <Header />
        <div className="guest-screen">
          <div className="guest-card">
            <h1>{table?.label || selectedTable}</h1>
            <p>Укажи количество гостей и зал</p>
            <div className="guest-grid">
              {[1,2,3,4,5,6,7,8].map(n => <button key={n} className={guestCount === n ? 'active' : ''} onClick={() => setGuestCount(n)}>{n}</button>)}
              <button onClick={() => setGuestCount(Number(prompt('Количество гостей', guestCount) || guestCount))}>...</button>
            </div>
            <select value={selectedHall} onChange={e => setSelectedHall(e.target.value)}>
              {halls.map(h => <option key={h}>{h}</option>)}
            </select>
            <div className="wide-actions">
              <button onClick={() => setScreen('tables')}>Отмена</button>
              <button className="primary" disabled={loading} onClick={() => createOrder(table, guestCount, selectedHall)}>Открыть заказ</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (screen === 'pay' && activeOrder) {
    const change = paymentMethod === 'cash' ? Number(cashReceived || 0) - activeTotal : 0
    return (
      <div className="pos-app">
        <Header />
        <div className="pay-screen">
          <section className="pay-card">
            <h1>Касса</h1>
            <p>{activeOrder.table_name} · сумма к оплате</p>
            <div className="pay-total">{fmt(activeTotal)} AZN</div>
            <div className="payment-types">
              {[
                ['cash', 'Наличные'],
                ['bank', 'Карта'],
                ['wolt', 'Доставка / Wolt']
              ].map(([value, label]) => <button key={value} className={paymentMethod === value ? 'active' : ''} onClick={() => setPaymentMethod(value)}>{label}</button>)}
            </div>
            {paymentMethod === 'cash' && (
              <>
                <input value={cashReceived} onChange={e => setCashReceived(e.target.value)} placeholder="Получено наличными" />
                <div className={change < 0 ? 'pay-change bad-text' : 'pay-change'}>Сдача: {fmt(Math.max(change, 0))} AZN</div>
              </>
            )}
            <div className="wide-actions">
              <button onClick={() => setScreen('order')}>Назад</button>
              <button className="primary" disabled={loading || (paymentMethod === 'cash' && Number(cashReceived || 0) < activeTotal)} onClick={closeCheck}>Оплатить / Чек</button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (screen === 'reports') {
    return (
      <div className="pos-app">
        <Header />
        {message && <div className="message">{message}</div>}
        <section className="reports-page">
          <div className="closed-head">
            <h2>Смена / отчёты</h2>
            <button className="danger" onClick={closeShift}>Закрыть смену</button>
          </div>
          <div className="report-grid">
            <div><span>Чеков</span><b>{shiftTotals.checks}</b></div>
            <div><span>Наличные</span><b>{fmt(shiftTotals.cash)}</b></div>
            <div><span>Карта</span><b>{fmt(shiftTotals.bank)}</b></div>
            <div><span>Доставка</span><b>{fmt(shiftTotals.wolt)}</b></div>
            <div><span>Итого</span><b>{fmt(shiftTotals.total)}</b></div>
          </div>
          <div className="reports-columns">
            <div className="report-box">
              <h3>Продажи по часам</h3>
              {hourlySales.map(h => <p key={h.hour}><span>{h.hour}</span><b>{fmt(h.amount)} AZN</b><small>{h.checks} чек.</small></p>)}
              {!hourlySales.length && <span className="muted">Нет данных</span>}
            </div>
            <div className="report-box">
              <h3>Продажи блюд</h3>
              {dishSales.map(d => <p key={d.name}><span>{d.name}</span><b>{fmt(d.amount)} AZN</b><small>{fmt(d.qty)} шт.</small></p>)}
              {!dishSales.length && <span className="muted">Нет данных</span>}
            </div>
          </div>
        </section>
      </div>
    )
  }

  if (screen === 'order' && activeOrder) {
    return (
      <div className="pos-app">
        <Header />
        {message && <div className={`message ${message.includes('выполн') || message.includes('распечатан') || message.includes('отправлен') ? 'good' : ''}`}>{message}</div>}
        <main className="order-layout">
          <section className="order-panel">
            <div className="order-title">
              <div>
                <h2>{activeOrder.table_name}</h2>
                <span>{activeOrder.hall_name || 'зал'} · гостей: {activeOrder.guest_count || 1} · {activeOrder.order_stage || 'open'}</span>
              </div>
              <button onClick={() => setScreen('tables')}>← Столы</button>
            </div>
            <div className="order-list">
              {activeItems.map(i => (
                <div className="order-row" key={i.id}>
                  <div>
                    <b>{i.item_name}</b>
                    <small>{i.item_type} · {i.item_category || '—'}</small>
                  </div>
                  <button onClick={() => updateOrderItem(i.id, { quantity: Number(i.quantity || 0) - 1 })}>−</button>
                  <input value={i.quantity} onChange={e => updateOrderItem(i.id, { quantity: Number(e.target.value || 0) })} />
                  <button onClick={() => updateOrderItem(i.id, { quantity: Number(i.quantity || 0) + 1 })}>+</button>
                  <b>{fmt(i.total_amount)}</b>
                  <button className="danger mini" onClick={() => deleteItem(i.id)}>×</button>
                </div>
              ))}
              {!activeItems.length && <div className="empty">Выбери позиции меню</div>}
            </div>
            <div className="total">
              <span>Позиций: {activeItems.length}</span>
              <span>Кол-во: {fmt(activeQty)}</span>
              <b>{fmt(activeTotal)} AZN</b>
            </div>
            <div className="actions">
              <button onClick={() => printStation('Кухня')}>Кухня</button>
              <button onClick={() => printStation('Бар')}>Бар</button>
              <button onClick={precheck}>Пречек</button>
              <button onClick={cancelPrecheck}>Отмена пречека</button>
              <button className="danger" onClick={cancelOrder}>Отмена</button>
              <button className="primary" onClick={() => setScreen('pay')}>Касса</button>
            </div>
          </section>

          <section className="menu-panel">
            <div className="menu-toolbar">
              <button onClick={() => { setSelectedType(''); setSelectedCategory('') }}>⌂</button>
              <button onClick={() => { if (selectedCategory) setSelectedCategory(''); else setSelectedType('') }}>←</button>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск блюда" />
            </div>
            {!selectedType && (
              <div className="tile-grid root">
                <button onClick={() => setSelectedType('Кухня')}>Еда</button>
                <button onClick={() => setSelectedType('Бар')}>Напитки</button>
                <button onClick={() => { setSelectedType(''); setSelectedCategory(''); setSearch('') }}>Все меню</button>
                <button onClick={loadMenu}>Обновить</button>
              </div>
            )}
            {selectedType && !selectedCategory && (
              <div className="tile-grid">
                {categories.map(c => <button key={c} onClick={() => setSelectedCategory(c)}>{c}</button>)}
                {!categories.length && <div className="empty">Категорий нет. Активных позиций: {menuItems.length}</div>}
              </div>
            )}
            {((selectedType && selectedCategory) || search) && (
              <div className="menu-grid">
                {visibleItems.map(item => (
                  <button key={item.id} onClick={() => addItem(item)}>
                    <small>{item.category || '—'} · {item.item_type}</small>
                    <b>{item.name}</b>
                    <span>{fmt(item.sale_price)} AZN</span>
                  </button>
                ))}
                {!visibleItems.length && <div className="empty">Позиции не найдены. Активных позиций: {menuItems.length}</div>}
              </div>
            )}
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="pos-app">
      <Header />
      {message && <div className={`message ${message.includes('открыта') || message.includes('отправлен') ? 'good' : ''}`}>{message}</div>}
      <section className="tables-page">
        <div className="tables-head">
          <div>
            <h1>Столы</h1>
            <p>Свободные, занятые, пречек, с собой, доставка</p>
          </div>
          <div className="head-stats">
            <span>Открытых: <b>{openOrders.length}</b></span>
            <span>Меню: <b>{menuItems.length}</b></span>
            <span>Смена: <b>{activeShift ? 'открыта' : 'закрыта'}</b></span>
          </div>
        </div>
        <div className="table-grid">
          {tables.map(table => {
            const state = tableState(table)
            return (
              <button key={table.id} className={`table-tile ${state.status}`} onClick={() => chooseTable(table)}>
                <b>{table.label}</b>
                <span>{state.label}</span>
                <small>{table.mode === 'takeaway' ? 'с собой' : table.mode === 'delivery' ? 'доставка' : table.mode === 'fastfood' ? 'быстрый чек' : 'зал'}</small>
                <strong>{fmt(state.amount)} AZN</strong>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
