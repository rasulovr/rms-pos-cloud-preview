import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const TERMINAL_CODE = import.meta.env.VITE_POS_TERMINAL_CODE || 'cloud-preview-001'
const DEFAULT_BRANCH_ID = 'dfb59a96-524d-4328-a872-aa653e3faea3'
const DEFAULT_BRANCH_NAME = 'BC1'

const DEFAULT_TABLES = [
  { id: 'T01', name: 'Стол 1', zone: 'Зал', seats: 2 },
  { id: 'T02', name: 'Стол 2', zone: 'Зал', seats: 2 },
  { id: 'T03', name: 'Стол 3', zone: 'Зал', seats: 4 },
  { id: 'T04', name: 'Стол 4', zone: 'Зал', seats: 4 },
  { id: 'T05', name: 'Стол 5', zone: 'Зал', seats: 6 },
  { id: 'T06', name: 'Стол 6', zone: 'Зал', seats: 4 },
  { id: 'T07', name: 'Терраса 1', zone: 'Терраса', seats: 4 },
  { id: 'T08', name: 'Терраса 2', zone: 'Терраса', seats: 4 },
  { id: 'T09', name: 'Терраса 3', zone: 'Терраса', seats: 6 },
  { id: 'TAKEAWAY', name: 'Take Away', zone: 'Касса', seats: 0 }
]

const DEMO_MENU = [
  { id: 'demo-1', name: 'Cappuccino', category: 'Кофе', price: 5.5 },
  { id: 'demo-2', name: 'Latte', category: 'Кофе', price: 6 },
  { id: 'demo-3', name: 'Americano', category: 'Кофе', price: 4.5 },
  { id: 'demo-4', name: 'Flat White', category: 'Кофе', price: 6.5 },
  { id: 'demo-5', name: 'Croissant Classic', category: 'Bakery', price: 4.5 },
  { id: 'demo-6', name: 'Almond Croissant', category: 'Bakery', price: 6.5 },
  { id: 'demo-7', name: 'Eggs Benedict', category: 'Breakfast', price: 13 },
  { id: 'demo-8', name: 'Avocado Toast', category: 'Breakfast', price: 12 },
  { id: 'demo-9', name: 'Caesar Salad', category: 'Kitchen', price: 15 },
  { id: 'demo-10', name: 'Chicken Sandwich', category: 'Kitchen', price: 14 },
  { id: 'demo-11', name: 'Pasta Pomodoro', category: 'Kitchen', price: 18 },
  { id: 'demo-12', name: 'Tiramisu', category: 'Dessert', price: 9 }
]

const PAYMENT_LABELS = {
  cash: 'Наличные',
  card: 'Карта'
}

function money(value) {
  return `${Number(value || 0).toFixed(2)} ₼`
}

function parseNum(value) {
  const n = Number(String(value ?? '0').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function normalizeTable(table, index) {
  if (!table || typeof table !== 'object') {
    return {
      id: `T${String(index + 1).padStart(2, '0')}`,
      name: `Стол ${index + 1}`,
      zone: 'Зал',
      seats: 2
    }
  }

  return {
    id: String(table.id || table.code || table.table_id || `T${String(index + 1).padStart(2, '0')}`),
    name: String(table.name || table.title || table.label || `Стол ${index + 1}`),
    zone: String(table.zone || table.area || 'Зал'),
    seats: parseNum(table.seats || table.capacity || 0)
  }
}

function normalizeMenuItem(row) {
  const name = row.name || row.title || row.product_name || row.item_name || row.menu_name
  const category = row.category || row.category_name || row.group_name || row.type || 'Меню'
  const rawPrice = row.price ?? row.sale_price ?? row.selling_price ?? row.unit_price ?? row.final_price ?? 0

  return {
    id: String(row.id),
    name: String(name || 'Без названия'),
    category: String(category || 'Меню'),
    price: parseNum(rawPrice),
    raw: row
  }
}

function calcOrderTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + parseNum(item.price) * parseNum(item.qty), 0)
  const service = subtotal > 0 ? subtotal * 0.1 : 0
  const total = subtotal + service

  return {
    subtotal,
    service,
    total
  }
}

function orderKey(tableId) {
  return String(tableId || 'TAKEAWAY')
}

function sortByName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), 'ru')
}

export default function App() {
  const [bootStatus, setBootStatus] = useState('loading')
  const [screen, setScreen] = useState('login')
  const [terminal, setTerminal] = useState(null)
  const [branch, setBranch] = useState({ id: DEFAULT_BRANCH_ID, name: DEFAULT_BRANCH_NAME })
  const [tables, setTables] = useState(DEFAULT_TABLES)
  const [menu, setMenu] = useState([])
  const [orders, setOrders] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [activeZone, setActiveZone] = useState('Все')
  const [activeCategory, setActiveCategory] = useState('Все')
  const [selectedTableId, setSelectedTableId] = useState('TAKEAWAY')
  const [busyAction, setBusyAction] = useState('')
  const [toast, setToast] = useState('')
  const [search, setSearch] = useState('')
  const toastTimer = useRef(null)

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || tables[0] || DEFAULT_TABLES[0],
    [selectedTableId, tables]
  )

  const currentOrder = orders[orderKey(selectedTableId)] || null
  const currentItems = currentOrder?.items || []
  const totals = useMemo(() => calcOrderTotals(currentItems), [currentItems])

  const zones = useMemo(() => ['Все', ...Array.from(new Set(tables.map((table) => table.zone || 'Зал')))], [tables])
  const categories = useMemo(() => ['Все', ...Array.from(new Set(menu.map((item) => item.category || 'Меню'))).sort()], [menu])

  const filteredTables = useMemo(() => {
    return tables.filter((table) => activeZone === 'Все' || table.zone === activeZone)
  }, [activeZone, tables])

  const filteredMenu = useMemo(() => {
    const needle = search.trim().toLowerCase()

    return menu
      .filter((item) => activeCategory === 'Все' || item.category === activeCategory)
      .filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.category.toLowerCase().includes(needle))
      .sort(sortByName)
  }, [activeCategory, menu, search])

  const openedOrdersCount = useMemo(
    () => Object.values(orders).filter((order) => order && order.items?.length).length,
    [orders]
  )

  function showToast(message) {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2200)
  }

  function localPatchOrder(tableId, patcher) {
    setOrders((prev) => {
      const key = orderKey(tableId)
      const current = prev[key] || {
        id: null,
        table_id: key,
        table_name: tables.find((table) => table.id === tableId)?.name || key,
        status: 'draft',
        items: []
      }

      return {
        ...prev,
        [key]: patcher(current)
      }
    })
  }

  const loadTerminal = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setTerminal({
        id: 'demo-terminal',
        terminal_code: TERMINAL_CODE,
        branch_id: DEFAULT_BRANCH_ID,
        branch_name: DEFAULT_BRANCH_NAME,
        settings: { tables: DEFAULT_TABLES }
      })
      setTables(DEFAULT_TABLES)
      setMenu(DEMO_MENU)
      setBootStatus('ready')
      return
    }

    setBootStatus('loading')

    try {
      const { data: terminalData, error: terminalError } = await supabase
        .from('pos_terminals')
        .select('*')
        .eq('terminal_code', TERMINAL_CODE)
        .maybeSingle()

      if (terminalError) throw terminalError
      if (!terminalData) throw new Error(`Терминал ${TERMINAL_CODE} не найден в pos_terminals`)

      setTerminal(terminalData)

      const nextBranch = {
        id: terminalData.branch_id || DEFAULT_BRANCH_ID,
        name: terminalData.branch_name || DEFAULT_BRANCH_NAME
      }

      if (terminalData.branch_id) {
        const { data: branchData } = await supabase
          .from('branches')
          .select('id,name')
          .eq('id', terminalData.branch_id)
          .maybeSingle()

        if (branchData?.name) {
          nextBranch.name = branchData.name
        }
      }

      setBranch(nextBranch)

      const settingsTables = Array.isArray(terminalData.settings?.tables)
        ? terminalData.settings.tables.map(normalizeTable)
        : DEFAULT_TABLES

      setTables(settingsTables.length ? settingsTables : DEFAULT_TABLES)
      setSelectedTableId(settingsTables[0]?.id || DEFAULT_TABLES[0].id)

      await loadMenu(nextBranch.id)
      await loadOrders(terminalData.id, nextBranch.id, settingsTables.length ? settingsTables : DEFAULT_TABLES)

      setBootStatus('ready')
    } catch (error) {
      console.error(error)
      setBootStatus('error')
      showToast(error.message || 'Ошибка загрузки терминала')
    }
  }, [])

  async function loadMenu(branchId) {
    if (!isSupabaseConfigured || !supabase) {
      setMenu(DEMO_MENU)
      return
    }

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('name', { ascending: true })

    if (error) {
      console.warn('menu_items load error:', error)
      setMenu(DEMO_MENU)
      showToast('Меню из Supabase не загрузилось, показан demo-набор')
      return
    }

    const normalized = (data || [])
      .filter((row) => row.deleted_at == null)
      .filter((row) => row.is_active !== false)
      .filter((row) => !row.branch_id || !branchId || row.branch_id === branchId)
      .map(normalizeMenuItem)
      .filter((item) => item.id && item.name)

    setMenu(normalized.length ? normalized : DEMO_MENU)
  }

  async function loadOrders(terminalId, branchId, tableList) {
    if (!isSupabaseConfigured || !supabase || !terminalId) {
      setOrders({})
      return
    }

    const { data: orderRows, error: orderError } = await supabase
      .from('pos_orders')
      .select('*')
      .eq('terminal_id', terminalId)
      .eq('branch_id', branchId)
      .in('status', ['open', 'saved'])
      .order('opened_at', { ascending: true })

    if (orderError) {
      console.warn('pos_orders load error:', orderError)
      setOrders({})
      return
    }

    const orderIds = (orderRows || []).map((row) => row.id)
    let itemRows = []

    if (orderIds.length) {
      const { data: itemsData, error: itemsError } = await supabase
        .from('pos_order_items')
        .select('*')
        .in('order_id', orderIds)
        .order('created_at', { ascending: true })

      if (itemsError) {
        console.warn('pos_order_items load error:', itemsError)
      } else {
        itemRows = itemsData || []
      }
    }

    const byId = new Map((orderRows || []).map((row) => [row.id, { ...row, items: [] }]))

    itemRows.forEach((item) => {
      const target = byId.get(item.order_id)
      if (!target) return

      target.items.push({
        id: item.id,
        menu_item_id: item.menu_item_id,
        name: item.item_name || item.name || 'Позиция',
        category: item.category || 'Меню',
        price: parseNum(item.price),
        qty: parseNum(item.qty),
        status: item.status || 'active'
      })
    })

    const next = {}
    const tableNames = new Map((tableList || tables).map((table) => [table.id, table.name]))

    Array.from(byId.values()).forEach((order) => {
      const key = orderKey(order.table_id || order.table_code || order.table_name || 'TAKEAWAY')
      next[key] = {
        ...order,
        table_id: key,
        table_name: order.table_name || tableNames.get(key) || key,
        items: order.items || []
      }
    })

    setOrders(next)
  }

  useEffect(() => {
    loadTerminal()
  }, [loadTerminal])

  async function reloadAll() {
    setBusyAction('reload')
    try {
      await loadTerminal()
      showToast('Данные обновлены')
    } finally {
      setBusyAction('')
    }
  }

  function pressPin(value) {
    setPinError('')
    if (pin.length >= 8) return
    setPin((prev) => prev + value)
  }

  function clearPin() {
    setPin('')
    setPinError('')
  }

  function removePinDigit() {
    setPin((prev) => prev.slice(0, -1))
    setPinError('')
  }

  async function login() {
    if (!pin.trim()) {
      setPinError('Введите PIN')
      return
    }

    setBusyAction('login')
    setPinError('')

    try {
      if (!isSupabaseConfigured || !supabase) {
        if (pin === '1111') {
          setCurrentUser({ id: 'demo-user', full_name: 'Demo Cashier', role: 'cashier' })
          setScreen('pos')
          setPin('')
          showToast('Demo-вход выполнен')
          return
        }

        throw new Error('Demo PIN: 1111')
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc('pos_login', {
        p_terminal_code: TERMINAL_CODE,
        p_pin: pin
      })

      if (!rpcError && rpcData?.ok) {
        const user = rpcData.user || {}
        setCurrentUser(user)
        setScreen('pos')
        setPin('')
        showToast(`Вход выполнен: ${user.full_name || user.name || 'кассир'}`)
        return
      }

      const { data: users, error: userError } = await supabase
        .from('pos_users')
        .select('*')
        .eq('pin_code', pin)
        .limit(1)

      if (userError) throw userError
      if (!users?.length) throw new Error(rpcData?.error || 'Неверный PIN')

      const user = users[0]
      setCurrentUser(user)
      setScreen('pos')
      setPin('')
      showToast(`Вход выполнен: ${user.full_name || user.name || 'кассир'}`)
    } catch (error) {
      console.error(error)
      setPinError(error.message || 'Не удалось войти')
      setPin('')
    } finally {
      setBusyAction('')
    }
  }

  async function ensureOrder(table) {
    const key = orderKey(table.id)
    const existing = orders[key]

    if (existing?.id) return existing

    const draft = {
      id: null,
      terminal_id: terminal?.id,
      branch_id: branch.id,
      user_id: currentUser?.id || null,
      table_id: key,
      table_name: table.name,
      status: 'open',
      items: [],
      subtotal: 0,
      service_amount: 0,
      total_amount: 0
    }

    if (!isSupabaseConfigured || !supabase || String(terminal?.id || '').startsWith('demo')) {
      localPatchOrder(table.id, () => ({ ...draft, id: `local-${Date.now()}` }))
      return { ...draft, id: `local-${Date.now()}` }
    }

    const payload = {
      terminal_id: terminal.id,
      branch_id: branch.id,
      user_id: currentUser?.id || null,
      table_id: key,
      table_name: table.name,
      status: 'open',
      opened_at: new Date().toISOString(),
      subtotal: 0,
      service_amount: 0,
      total_amount: 0
    }

    const { data, error } = await supabase
      .from('pos_orders')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    const created = { ...data, items: [] }
    setOrders((prev) => ({ ...prev, [key]: created }))
    return created
  }

  async function persistTotals(orderId, items) {
    if (!isSupabaseConfigured || !supabase || !orderId || String(orderId).startsWith('local-')) return

    const nextTotals = calcOrderTotals(items)

    const { error } = await supabase
      .from('pos_orders')
      .update({
        subtotal: nextTotals.subtotal,
        service_amount: nextTotals.service,
        total_amount: nextTotals.total,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) console.warn('persist totals error:', error)
  }

  async function addItem(menuItem) {
    if (!selectedTable) return

    setBusyAction(`add-${menuItem.id}`)

    try {
      const order = await ensureOrder(selectedTable)

      const existing = (order.items || []).find((item) => item.menu_item_id === menuItem.id || item.id === menuItem.id)
      let nextItems

      if (existing) {
        nextItems = (order.items || []).map((item) =>
          (item.menu_item_id === menuItem.id || item.id === menuItem.id)
            ? { ...item, qty: parseNum(item.qty) + 1 }
            : item
        )

        if (isSupabaseConfigured && supabase && !String(order.id).startsWith('local-') && existing.id) {
          const { error } = await supabase
            .from('pos_order_items')
            .update({
              qty: parseNum(existing.qty) + 1,
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

          if (error) throw error
        }
      } else {
        const localItem = {
          id: `local-item-${Date.now()}`,
          menu_item_id: menuItem.id,
          name: menuItem.name,
          category: menuItem.category,
          price: menuItem.price,
          qty: 1,
          status: 'active'
        }

        if (isSupabaseConfigured && supabase && !String(order.id).startsWith('local-')) {
          const payload = {
            order_id: order.id,
            menu_item_id: menuItem.id,
            item_name: menuItem.name,
            category: menuItem.category,
            price: menuItem.price,
            qty: 1,
            total_amount: menuItem.price,
            status: 'active'
          }

          const { data, error } = await supabase
            .from('pos_order_items')
            .insert(payload)
            .select('*')
            .single()

          if (error) throw error

          localItem.id = data.id
        }

        nextItems = [...(order.items || []), localItem]
      }

      localPatchOrder(selectedTable.id, (prev) => ({
        ...prev,
        id: order.id,
        terminal_id: order.terminal_id,
        branch_id: order.branch_id,
        user_id: order.user_id,
        table_id: selectedTable.id,
        table_name: selectedTable.name,
        status: 'open',
        items: nextItems
      }))

      await persistTotals(order.id, nextItems)
      showToast(`${menuItem.name} добавлен`)
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Не удалось добавить позицию')
    } finally {
      setBusyAction('')
    }
  }

  async function changeQty(item, delta) {
    if (!currentOrder) return

    const nextQty = parseNum(item.qty) + delta
    const nextItems = currentItems
      .map((row) => (row.id === item.id ? { ...row, qty: nextQty } : row))
      .filter((row) => parseNum(row.qty) > 0)

    localPatchOrder(selectedTableId, (prev) => ({
      ...prev,
      items: nextItems
    }))

    try {
      if (isSupabaseConfigured && supabase && currentOrder.id && !String(currentOrder.id).startsWith('local-')) {
        if (nextQty <= 0) {
          const { error } = await supabase.from('pos_order_items').delete().eq('id', item.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('pos_order_items')
            .update({
              qty: nextQty,
              total_amount: parseNum(item.price) * nextQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)

          if (error) throw error
        }

        await persistTotals(currentOrder.id, nextItems)
      }
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Количество изменено локально, но не записано в базу')
    }
  }

  async function setOrderStatus(status) {
    if (!currentOrder?.id || !currentItems.length) {
      showToast('Нет открытого заказа')
      return
    }

    setBusyAction(status)

    try {
      localPatchOrder(selectedTableId, (prev) => ({ ...prev, status }))

      if (isSupabaseConfigured && supabase && !String(currentOrder.id).startsWith('local-')) {
        const { error } = await supabase
          .from('pos_orders')
          .update({
            status,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOrder.id)

        if (error) throw error
      }

      showToast(status === 'saved' ? 'Заказ сохранён' : 'Заказ открыт')
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Не удалось обновить заказ')
    } finally {
      setBusyAction('')
    }
  }

  async function clearOrder() {
    if (!currentOrder?.id || !currentItems.length) {
      showToast('Чек пустой')
      return
    }

    setBusyAction('clear')

    try {
      if (isSupabaseConfigured && supabase && !String(currentOrder.id).startsWith('local-')) {
        const { error: itemsError } = await supabase.from('pos_order_items').delete().eq('order_id', currentOrder.id)
        if (itemsError) throw itemsError

        const { error: orderError } = await supabase
          .from('pos_orders')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOrder.id)

        if (orderError) throw orderError
      }

      setOrders((prev) => {
        const next = { ...prev }
        delete next[orderKey(selectedTableId)]
        return next
      })

      showToast('Чек очищен')
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Не удалось очистить чек')
    } finally {
      setBusyAction('')
    }
  }

  async function closeOrder(paymentMethod) {
    if (!currentOrder?.id || !currentItems.length) {
      showToast('Нет позиций для оплаты')
      return
    }

    setBusyAction(`pay-${paymentMethod}`)

    try {
      const totalPayload = calcOrderTotals(currentItems)

      if (isSupabaseConfigured && supabase && !String(currentOrder.id).startsWith('local-')) {
        const { data, error } = await supabase.rpc('pos_close_order', {
          p_order_id: currentOrder.id,
          p_payment_method: paymentMethod,
          p_paid_amount: totalPayload.total
        })

        if (error) throw error
        if (data?.ok === false) throw new Error(data.error || 'Оплата не проведена')
      }

      setOrders((prev) => {
        const next = { ...prev }
        delete next[orderKey(selectedTableId)]
        return next
      })

      showToast(`Оплата проведена: ${PAYMENT_LABELS[paymentMethod]}`)
    } catch (error) {
      console.error(error)
      showToast(error.message || 'Не удалось закрыть чек')
    } finally {
      setBusyAction('')
    }
  }

  function printPrecheck() {
    if (!currentItems.length) {
      showToast('Нет позиций для пречека')
      return
    }

    showToast('Пречек подготовлен. Печать подключим на этапе локальной версии.')
  }

  function logout() {
    setScreen('login')
    setCurrentUser(null)
    setPin('')
  }

  const terminalLabel = terminal?.terminal_code || TERMINAL_CODE

  if (bootStatus === 'loading') {
    return (
      <div className="loadingShell">
        <div className="loadingCard">
          <div className="loadingLogo">RMS</div>
          <h1>Загрузка RMS POS</h1>
          <p>Подключение к терминалу {TERMINAL_CODE} и загрузка меню.</p>
        </div>
      </div>
    )
  }

  if (bootStatus === 'error') {
    return (
      <div className="loadingShell">
        <div className="loadingCard errorCard">
          <div className="loadingLogo">!</div>
          <h1>POS не загрузился</h1>
          <p>Проверь SQL patch, `.env` и наличие терминала `{TERMINAL_CODE}` в `pos_terminals`.</p>
          <button type="button" onClick={reloadAll}>Повторить загрузку</button>
        </div>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div className="loginShell">
        {toast ? <div className="toast">{toast}</div> : null}

        <section className="loginVisual">
          <div className="loginBrand">
            <div className="brandBadge">RMS</div>
            <p>Cloud POS · IIKO-style workflow</p>
            <h1>Быстрая касса для ресторана</h1>
            <span>Столы · Чек · Меню · Оплата · Синхронизация с RMS</span>
          </div>

          <div className="loginStats">
            <div>
              <small>Терминал</small>
              <strong>{terminalLabel}</strong>
            </div>
            <div>
              <small>Филиал</small>
              <strong>{branch.name}</strong>
            </div>
            <div>
              <small>Supabase</small>
              <strong>{isSupabaseConfigured ? 'Connected' : 'Demo mode'}</strong>
            </div>
          </div>
        </section>

        <section className="pinPanel">
          <div className="pinTop">
            <div>
              <p className="eyebrow">Авторизация кассира</p>
              <h2>Введите PIN</h2>
            </div>
            <button type="button" onClick={reloadAll} disabled={busyAction === 'reload'}>↻</button>
          </div>

          <div className="pinDots">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className={pin.length > index ? 'filled' : ''} />
            ))}
          </div>

          {pinError ? <div className="pinError">{pinError}</div> : <div className="pinHint">Тестовый PIN после SQL patch: 1111</div>}

          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <button key={value} type="button" onClick={() => pressPin(String(value))}>{value}</button>
            ))}
            <button type="button" className="mutedKey" onClick={clearPin}>C</button>
            <button type="button" onClick={() => pressPin('0')}>0</button>
            <button type="button" className="mutedKey" onClick={removePinDigit}>⌫</button>
          </div>

          <button type="button" className="loginButton" onClick={login} disabled={busyAction === 'login'}>
            {busyAction === 'login' ? 'Проверка...' : 'Войти'}
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="posShell">
      {toast ? <div className="toast">{toast}</div> : null}

      <header className="posTopbar">
        <div className="topIdentity">
          <div className="topLogo">RMS</div>
          <div>
            <h1>RMS POS</h1>
            <p>{branch.name} · {terminalLabel} · {currentUser?.full_name || currentUser?.name || 'кассир'}</p>
          </div>
        </div>

        <div className="topMetrics">
          <div>
            <span>Открыто</span>
            <strong>{openedOrdersCount}</strong>
          </div>
          <div>
            <span>Текущий чек</span>
            <strong>{money(totals.total)}</strong>
          </div>
          <button type="button" onClick={reloadAll} disabled={busyAction === 'reload'}>Обновить</button>
          <button type="button" className="darkTopButton" onClick={logout}>Выход</button>
        </div>
      </header>

      <main className="posLayout">
        <aside className="hallPanel">
          <div className="panelTitle">
            <div>
              <p className="eyebrow">Hall plan</p>
              <h2>Столы</h2>
            </div>
            <span>{filteredTables.length}</span>
          </div>

          <div className="pillRow">
            {zones.map((zone) => (
              <button
                key={zone}
                type="button"
                className={activeZone === zone ? 'active' : ''}
                onClick={() => setActiveZone(zone)}
              >
                {zone}
              </button>
            ))}
          </div>

          <div className="tablesGrid">
            {filteredTables.map((table) => {
              const order = orders[orderKey(table.id)]
              const orderTotal = calcOrderTotals(order?.items || []).total
              const busy = Boolean(order?.items?.length)
              const selected = table.id === selectedTableId

              return (
                <button
                  key={table.id}
                  type="button"
                  className={`tableTile ${selected ? 'selected' : ''} ${busy ? 'busy' : ''}`}
                  onClick={() => setSelectedTableId(table.id)}
                >
                  <span>{table.zone}</span>
                  <strong>{table.name}</strong>
                  <small>{table.seats ? `${table.seats} мест` : 'быстрый чек'}</small>
                  <em>{busy ? money(orderTotal) : 'Свободно'}</em>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="menuPanel">
          <div className="menuHeader">
            <div>
              <p className="eyebrow">Menu</p>
              <h2>Товары</h2>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Поиск позиции..."
            />
          </div>

          <div className="categoryStrip">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="productsGrid">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                type="button"
                className="productTile"
                onClick={() => addItem(item)}
                disabled={busyAction === `add-${item.id}`}
              >
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <em>{money(item.price)}</em>
              </button>
            ))}

            {!filteredMenu.length ? (
              <div className="emptyBlock">
                <strong>Меню пустое</strong>
                <p>Проверь таблицу `menu_items` или категорию поиска.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="checkPanel">
          <div className="checkHeader">
            <div>
              <p className="eyebrow">Current order</p>
              <h2>{selectedTable?.name || 'Заказ'}</h2>
              <span>{currentOrder?.status === 'saved' ? 'Сохранён' : 'Открыт'}</span>
            </div>
            <b>{currentItems.length} поз.</b>
          </div>

          <div className="checkItems">
            {!currentItems.length ? (
              <div className="emptyCheck">
                <strong>Чек пустой</strong>
                <p>Выберите стол и добавьте позиции из меню. Логика повторяет кассовой workflow: стол → заказ → пречек → оплата.</p>
              </div>
            ) : (
              currentItems.map((item) => (
                <div key={item.id} className="checkItem">
                  <div className="checkItemInfo">
                    <strong>{item.name}</strong>
                    <span>{money(item.price)} · {item.category}</span>
                  </div>

                  <div className="qtyStepper">
                    <button type="button" onClick={() => changeQty(item, -1)}>−</button>
                    <b>{item.qty}</b>
                    <button type="button" onClick={() => changeQty(item, 1)}>+</button>
                  </div>

                  <em>{money(parseNum(item.price) * parseNum(item.qty))}</em>
                </div>
              ))
            )}
          </div>

          <div className="totalCard">
            <div>
              <span>Сумма</span>
              <strong>{money(totals.subtotal)}</strong>
            </div>
            <div>
              <span>Service 10%</span>
              <strong>{money(totals.service)}</strong>
            </div>
            <div className="grand">
              <span>Итого</span>
              <strong>{money(totals.total)}</strong>
            </div>
          </div>

          <div className="commandGrid">
            <button type="button" onClick={() => setOrderStatus('saved')} disabled={busyAction === 'saved'}>
              Сохранить
            </button>
            <button type="button" onClick={printPrecheck}>
              Пречек
            </button>
            <button type="button" onClick={() => setOrderStatus('open')} disabled={busyAction === 'open'}>
              Открыть
            </button>
            <button type="button" className="danger" onClick={clearOrder} disabled={busyAction === 'clear'}>
              Удалить
            </button>
          </div>

          <div className="paymentBlock">
            <button
              type="button"
              className="cashPay"
              onClick={() => closeOrder('cash')}
              disabled={busyAction === 'pay-cash'}
            >
              {busyAction === 'pay-cash' ? 'Проведение...' : 'Наличные'}
            </button>
            <button
              type="button"
              className="cardPay"
              onClick={() => closeOrder('card')}
              disabled={busyAction === 'pay-card'}
            >
              {busyAction === 'pay-card' ? 'Проведение...' : 'Карта'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  )
}
