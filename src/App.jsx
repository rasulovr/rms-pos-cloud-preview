import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './supabaseClient'

const TERMINAL_CODE = import.meta.env.VITE_POS_TERMINAL_CODE || 'cloud-preview-001'
const DEFAULT_BRANCH_ID = 'dfb59a96-524d-4328-a872-aa653e3faea3'
const DEFAULT_BRANCH_NAME = 'BC1'
const TEST_PIN = '1111'

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

const FALLBACK_MENU = [
  { id: 'fallback-1', name: 'Cappuccino', category: 'Кофе', price: 5.5 },
  { id: 'fallback-2', name: 'Latte', category: 'Кофе', price: 6 },
  { id: 'fallback-3', name: 'Americano', category: 'Кофе', price: 4.5 },
  { id: 'fallback-4', name: 'Flat White', category: 'Кофе', price: 6.5 },
  { id: 'fallback-5', name: 'Croissant Classic', category: 'Bakery', price: 4.5 },
  { id: 'fallback-6', name: 'Almond Croissant', category: 'Bakery', price: 6.5 },
  { id: 'fallback-7', name: 'Eggs Benedict', category: 'Breakfast', price: 13 },
  { id: 'fallback-8', name: 'Avocado Toast', category: 'Breakfast', price: 12 },
  { id: 'fallback-9', name: 'Caesar Salad', category: 'Kitchen', price: 15 },
  { id: 'fallback-10', name: 'Chicken Sandwich', category: 'Kitchen', price: 14 },
  { id: 'fallback-11', name: 'Pasta Pomodoro', category: 'Kitchen', price: 18 },
  { id: 'fallback-12', name: 'Tiramisu', category: 'Dessert', price: 9 }
]

function toNumber(value) {
  const n = Number(String(value ?? '0').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

function money(value) {
  return `${toNumber(value).toFixed(2)} ₼`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  return String(value)
}

function normalizeTable(table, index) {
  return {
    id: safeText(table?.id || table?.code || table?.table_id || `T${String(index + 1).padStart(2, '0')}`),
    name: safeText(table?.name || table?.title || table?.label || `Стол ${index + 1}`),
    zone: safeText(table?.zone || table?.area || 'Зал'),
    seats: toNumber(table?.seats || table?.capacity || 0)
  }
}

function normalizeMenuItem(row) {
  const name = row?.name || row?.title || row?.product_name || row?.item_name || row?.menu_name || 'Без названия'
  const category = row?.category || row?.category_name || row?.group_name || row?.type || 'Меню'
  const price = row?.price ?? row?.sale_price ?? row?.selling_price ?? row?.unit_price ?? row?.final_price ?? 0

  return {
    id: safeText(row?.id || `menu-${name}`),
    name: safeText(name),
    category: safeText(category || 'Меню'),
    price: toNumber(price)
  }
}

function calcTotals(items) {
  const subtotal = items.reduce((sum, item) => sum + toNumber(item.price) * toNumber(item.qty), 0)
  const service = subtotal > 0 ? subtotal * 0.1 : 0
  return {
    subtotal,
    service,
    total: subtotal + service
  }
}

function tableKey(tableId) {
  return safeText(tableId || 'TAKEAWAY')
}

export default function App() {
  const [screen, setScreen] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [terminal, setTerminal] = useState({
    id: null,
    terminal_code: TERMINAL_CODE,
    branch_id: DEFAULT_BRANCH_ID,
    branch_name: DEFAULT_BRANCH_NAME,
    settings: { tables: DEFAULT_TABLES }
  })
  const [branch, setBranch] = useState({ id: DEFAULT_BRANCH_ID, name: DEFAULT_BRANCH_NAME })
  const [tables, setTables] = useState(DEFAULT_TABLES)
  const [menu, setMenu] = useState(FALLBACK_MENU)
  const [orders, setOrders] = useState({})
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [user, setUser] = useState(null)
  const [activeZone, setActiveZone] = useState('Все')
  const [activeCategory, setActiveCategory] = useState('Все')
  const [selectedTableId, setSelectedTableId] = useState('T01')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState('')

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) || tables[0] || DEFAULT_TABLES[0],
    [tables, selectedTableId]
  )

  const currentOrder = orders[tableKey(selectedTable?.id)] || {
    id: null,
    table_id: selectedTable?.id || 'T01',
    table_name: selectedTable?.name || 'Стол',
    status: 'open',
    items: []
  }

  const currentItems = currentOrder.items || []
  const totals = useMemo(() => calcTotals(currentItems), [currentItems])

  const zones = useMemo(() => ['Все', ...Array.from(new Set(tables.map((t) => t.zone || 'Зал')))], [tables])
  const categories = useMemo(() => ['Все', ...Array.from(new Set(menu.map((m) => m.category || 'Меню')))], [menu])

  const filteredTables = useMemo(() => {
    return tables.filter((table) => activeZone === 'Все' || table.zone === activeZone)
  }, [tables, activeZone])

  const filteredMenu = useMemo(() => {
    const q = search.trim().toLowerCase()
    return menu
      .filter((item) => activeCategory === 'Все' || item.category === activeCategory)
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
  }, [menu, activeCategory, search])

  const openedTables = useMemo(() => {
    return Object.values(orders).filter((order) => order?.items?.length).length
  }, [orders])

  function notify(message) {
    setToast(message)
    window.clearTimeout(window.__rmsPosToast)
    window.__rmsPosToast = window.setTimeout(() => setToast(''), 2200)
  }

  async function boot() {
    setLoadError('')
    setScreen('loading')

    let nextTerminal = {
      id: null,
      terminal_code: TERMINAL_CODE,
      branch_id: DEFAULT_BRANCH_ID,
      branch_name: DEFAULT_BRANCH_NAME,
      settings: { tables: DEFAULT_TABLES }
    }

    let nextTables = DEFAULT_TABLES
    let nextBranch = { id: DEFAULT_BRANCH_ID, name: DEFAULT_BRANCH_NAME }
    let nextMenu = FALLBACK_MENU

    try {
      if (isSupabaseConfigured && supabase) {
        const terminalResult = await supabase
          .from('pos_terminals')
          .select('*')
          .eq('terminal_code', TERMINAL_CODE)
          .maybeSingle()

        if (!terminalResult.error && terminalResult.data) {
          nextTerminal = terminalResult.data
          nextBranch = {
            id: terminalResult.data.branch_id || DEFAULT_BRANCH_ID,
            name: terminalResult.data.branch_name || DEFAULT_BRANCH_NAME
          }

          const rawTables = terminalResult.data.settings?.tables
          if (Array.isArray(rawTables) && rawTables.length) {
            nextTables = rawTables.map(normalizeTable)
          }
        } else if (terminalResult.error) {
          setLoadError(`Supabase terminal warning: ${terminalResult.error.message}`)
        }

        const menuResult = await supabase
          .from('menu_items')
          .select('*')
          .limit(300)

        if (!menuResult.error && Array.isArray(menuResult.data) && menuResult.data.length) {
          nextMenu = menuResult.data
            .filter((row) => row?.is_active !== false)
            .map(normalizeMenuItem)
            .filter((item) => item.name)
        } else if (menuResult.error) {
          setLoadError((prev) => `${prev ? `${prev}\n` : ''}Menu warning: ${menuResult.error.message}`)
        }
      }
    } catch (error) {
      console.error('Boot failed, fallback mode used:', error)
      setLoadError(error.message || 'Supabase загрузка не удалась, включён fallback')
    }

    setTerminal(nextTerminal)
    setBranch(nextBranch)
    setTables(nextTables)
    setMenu(nextMenu.length ? nextMenu : FALLBACK_MENU)
    setSelectedTableId(nextTables[0]?.id || 'T01')
    setScreen('login')
  }

  useEffect(() => {
    boot()
  }, [])

  function pressPin(value) {
    if (pin.length >= 8) return
    setPinError('')
    setPin((prev) => prev + value)
  }

  function clearPin() {
    setPin('')
    setPinError('')
  }

  function backspacePin() {
    setPin((prev) => prev.slice(0, -1))
    setPinError('')
  }

  async function login() {
    setBusy('login')
    setPinError('')

    try {
      if (!pin) throw new Error('Введите PIN')

      if (isSupabaseConfigured && supabase) {
        const rpc = await supabase.rpc('pos_login', {
          p_terminal_code: TERMINAL_CODE,
          p_pin: pin
        })

        if (!rpc.error && rpc.data?.ok) {
          setUser(rpc.data.user || { full_name: 'Cashier' })
          setPin('')
          setScreen('pos')
          notify('Вход выполнен')
          return
        }

        const direct = await supabase
          .from('pos_users')
          .select('*')
          .eq('pin_code', pin)
          .eq('is_active', true)
          .limit(1)

        if (!direct.error && direct.data?.length) {
          setUser(direct.data[0])
          setPin('')
          setScreen('pos')
          notify('Вход выполнен')
          return
        }
      }

      if (pin === TEST_PIN) {
        setUser({ id: 'fallback-user', full_name: 'Test Cashier', role: 'cashier' })
        setPin('')
        setScreen('pos')
        notify('Fallback-вход выполнен')
        return
      }

      throw new Error('Неверный PIN. Для теста: 1111')
    } catch (error) {
      setPin('')
      setPinError(error.message || 'Ошибка входа')
    } finally {
      setBusy('')
    }
  }

  function patchOrder(tableId, patcher) {
    const key = tableKey(tableId)
    setOrders((prev) => {
      const oldOrder = prev[key] || {
        id: `local-${Date.now()}`,
        table_id: key,
        table_name: tables.find((t) => t.id === tableId)?.name || key,
        status: 'open',
        items: []
      }

      return {
        ...prev,
        [key]: patcher(oldOrder)
      }
    })
  }

  async function createOrderInSupabase(table) {
    if (!isSupabaseConfigured || !supabase || !terminal?.id) return null

    const payload = {
      terminal_id: terminal.id,
      branch_id: branch.id,
      user_id: user?.id && !String(user.id).startsWith('fallback') ? user.id : null,
      table_id: table.id,
      table_name: table.name,
      status: 'open',
      subtotal: 0,
      service_amount: 0,
      total_amount: 0,
      opened_at: new Date().toISOString()
    }

    const result = await supabase.from('pos_orders').insert(payload).select('*').single()
    if (result.error) throw result.error
    return result.data
  }

  async function addItem(item) {
    const table = selectedTable
    const key = tableKey(table.id)
    const oldOrder = orders[key]
    let orderId = oldOrder?.id

    setBusy(`add-${item.id}`)

    try {
      if (!orderId || String(orderId).startsWith('local-')) {
        try {
          const created = await createOrderInSupabase(table)
          if (created?.id) orderId = created.id
        } catch (error) {
          console.warn('Supabase order create skipped:', error)
          orderId = oldOrder?.id || `local-${Date.now()}`
        }
      }

      const existing = (oldOrder?.items || []).find((row) => row.menu_item_id === item.id || row.name === item.name)
      let itemId = existing?.id || `local-item-${Date.now()}`
      let nextItems = []

      if (existing) {
        nextItems = (oldOrder?.items || []).map((row) =>
          row.id === existing.id ? { ...row, qty: toNumber(row.qty) + 1 } : row
        )

        if (isSupabaseConfigured && supabase && orderId && !String(orderId).startsWith('local-') && existing.id && !String(existing.id).startsWith('local-')) {
          const updateResult = await supabase
            .from('pos_order_items')
            .update({
              qty: toNumber(existing.qty) + 1,
              total_amount: toNumber(existing.price) * (toNumber(existing.qty) + 1),
              updated_at: new Date().toISOString()
            })
            .eq('id', existing.id)

          if (updateResult.error) console.warn(updateResult.error)
        }
      } else {
        if (isSupabaseConfigured && supabase && orderId && !String(orderId).startsWith('local-') && !String(item.id).startsWith('fallback')) {
          const insertResult = await supabase
            .from('pos_order_items')
            .insert({
              order_id: orderId,
              menu_item_id: item.id,
              item_name: item.name,
              category: item.category,
              price: item.price,
              qty: 1,
              total_amount: item.price,
              status: 'active'
            })
            .select('*')
            .single()

          if (!insertResult.error && insertResult.data?.id) {
            itemId = insertResult.data.id
          } else if (insertResult.error) {
            console.warn(insertResult.error)
          }
        }

        nextItems = [
          ...(oldOrder?.items || []),
          {
            id: itemId,
            menu_item_id: item.id,
            name: item.name,
            category: item.category,
            price: item.price,
            qty: 1
          }
        ]
      }

      patchOrder(table.id, (order) => ({
        ...order,
        id: orderId || order.id,
        table_id: table.id,
        table_name: table.name,
        status: 'open',
        items: nextItems
      }))

      notify(`${item.name} добавлен`)
    } catch (error) {
      console.error(error)
      notify(error.message || 'Ошибка добавления позиции')
    } finally {
      setBusy('')
    }
  }

  async function changeQty(item, delta) {
    const nextQty = toNumber(item.qty) + delta
    const nextItems = currentItems
      .map((row) => (row.id === item.id ? { ...row, qty: nextQty } : row))
      .filter((row) => row.qty > 0)

    patchOrder(selectedTable.id, (order) => ({
      ...order,
      items: nextItems
    }))

    try {
      if (isSupabaseConfigured && supabase && currentOrder.id && !String(currentOrder.id).startsWith('local-') && item.id && !String(item.id).startsWith('local-')) {
        if (nextQty <= 0) {
          await supabase.from('pos_order_items').delete().eq('id', item.id)
        } else {
          await supabase
            .from('pos_order_items')
            .update({
              qty: nextQty,
              total_amount: toNumber(item.price) * nextQty,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)
        }
      }
    } catch (error) {
      console.warn(error)
    }
  }

  function saveOrder() {
    if (!currentItems.length) {
      notify('Нет позиций для сохранения')
      return
    }

    patchOrder(selectedTable.id, (order) => ({ ...order, status: 'saved' }))
    notify('Заказ сохранён')
  }

  function printPrecheck() {
    if (!currentItems.length) {
      notify('Нет позиций для пречека')
      return
    }

    notify('Пречек подготовлен')
  }

  async function clearOrder() {
    if (!currentItems.length) {
      notify('Чек пустой')
      return
    }

    try {
      if (isSupabaseConfigured && supabase && currentOrder.id && !String(currentOrder.id).startsWith('local-')) {
        await supabase.from('pos_order_items').delete().eq('order_id', currentOrder.id)
        await supabase.from('pos_orders').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }).eq('id', currentOrder.id)
      }
    } catch (error) {
      console.warn(error)
    }

    setOrders((prev) => {
      const next = { ...prev }
      delete next[tableKey(selectedTable.id)]
      return next
    })

    notify('Чек очищен')
  }

  async function pay(method) {
    if (!currentItems.length) {
      notify('Нет позиций для оплаты')
      return
    }

    setBusy(`pay-${method}`)

    try {
      if (isSupabaseConfigured && supabase && currentOrder.id && !String(currentOrder.id).startsWith('local-')) {
        const result = await supabase.rpc('pos_close_order', {
          p_order_id: currentOrder.id,
          p_payment_method: method,
          p_paid_amount: totals.total
        })

        if (result.error) {
          console.warn(result.error)

          await supabase.from('pos_orders').update({
            status: 'closed',
            subtotal: totals.subtotal,
            service_amount: totals.service,
            total_amount: totals.total,
            payment_method: method,
            paid_amount: totals.total,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', currentOrder.id)
        }
      }
    } catch (error) {
      console.warn(error)
    }

    setOrders((prev) => {
      const next = { ...prev }
      delete next[tableKey(selectedTable.id)]
      return next
    })

    notify(method === 'cash' ? 'Оплата наличными проведена' : 'Оплата картой проведена')
    setBusy('')
  }

  if (screen === 'loading') {
    return (
      <div className="loadingShell">
        <div className="loadingCard">
          <div className="loadingLogo">RMS</div>
          <h1>Загрузка RMS POS</h1>
          <p>Терминал: {TERMINAL_CODE}</p>
        </div>
      </div>
    )
  }

  if (screen === 'login') {
    return (
      <div className="loginShell">
        {toast ? <div className="toast">{toast}</div> : null}

        <section className="loginVisual">
          <div>
            <div className="brandBadge">RMS</div>
            <p className="loginKicker">Cloud POS · visual + Supabase</p>
            <h1>RMS POS</h1>
            <span>Интерфейс кассы: столы, меню, чек и оплата в одном экране.</span>
          </div>

          <div className="loginStats">
            <div>
              <small>Терминал</small>
              <strong>{terminal?.terminal_code || TERMINAL_CODE}</strong>
            </div>
            <div>
              <small>Филиал</small>
              <strong>{branch.name}</strong>
            </div>
            <div>
              <small>Режим</small>
              <strong>{isSupabaseConfigured ? 'Supabase' : 'Fallback'}</strong>
            </div>
          </div>

          {loadError ? <pre className="loadWarning">{loadError}</pre> : null}
        </section>

        <section className="pinPanel">
          <div className="pinTop">
            <div>
              <p className="eyebrow">Вход кассира</p>
              <h2>Введите PIN</h2>
            </div>
            <button type="button" onClick={boot}>↻</button>
          </div>

          <div className="pinDots">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className={pin.length > index ? 'filled' : ''} />
            ))}
          </div>

          {pinError ? <div className="pinError">{pinError}</div> : <div className="pinHint">Тестовый PIN: 1111</div>}

          <div className="keypad">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((value) => (
              <button key={value} type="button" onClick={() => pressPin(String(value))}>{value}</button>
            ))}
            <button type="button" className="mutedKey" onClick={clearPin}>C</button>
            <button type="button" onClick={() => pressPin('0')}>0</button>
            <button type="button" className="mutedKey" onClick={backspacePin}>⌫</button>
          </div>

          <button type="button" className="loginButton" onClick={login} disabled={busy === 'login'}>
            {busy === 'login' ? 'Проверка...' : 'Войти'}
          </button>
        </section>
      </div>
    )
  }

  return (
    <div className="posShell">
      {toast ? <div className="toast">{toast}</div> : null}

      <header className="posTop">
        <div className="topLeft">
          <div className="topLogo">RMS</div>
          <div>
            <h1>RMS POS</h1>
            <p>{branch.name} · {terminal?.terminal_code || TERMINAL_CODE} · {user?.full_name || user?.name || 'Cashier'}</p>
          </div>
        </div>

        <div className="topCards">
          <div>
            <span>Открытые</span>
            <strong>{openedTables}</strong>
          </div>
          <div>
            <span>Текущий чек</span>
            <strong>{money(totals.total)}</strong>
          </div>
          <button type="button" onClick={boot}>Обновить</button>
          <button type="button" className="logoutButton" onClick={() => setScreen('login')}>Выход</button>
        </div>
      </header>

      <main className="posGrid">
        <aside className="tablesPanel">
          <div className="panelHeader">
            <div>
              <p className="eyebrow">Hall</p>
              <h2>Столы</h2>
            </div>
            <span>{filteredTables.length}</span>
          </div>

          <div className="tabs">
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

          <div className="tableGrid">
            {filteredTables.map((table) => {
              const order = orders[tableKey(table.id)]
              const busyTable = Boolean(order?.items?.length)
              const orderTotal = calcTotals(order?.items || []).total

              return (
                <button
                  key={table.id}
                  type="button"
                  className={`tableCard ${selectedTable?.id === table.id ? 'selected' : ''} ${busyTable ? 'busy' : ''}`}
                  onClick={() => setSelectedTableId(table.id)}
                >
                  <span>{table.zone}</span>
                  <strong>{table.name}</strong>
                  <small>{table.seats ? `${table.seats} мест` : 'быстрый заказ'}</small>
                  <em>{busyTable ? money(orderTotal) : 'Свободно'}</em>
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск..."
            />
          </div>

          <div className="tabs">
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

          <div className="productGrid">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                type="button"
                className="productCard"
                onClick={() => addItem(item)}
                disabled={busy === `add-${item.id}`}
              >
                <span>{item.category}</span>
                <strong>{item.name}</strong>
                <em>{money(item.price)}</em>
              </button>
            ))}
          </div>
        </section>

        <aside className="orderPanel">
          <div className="orderHeader">
            <div>
              <p className="eyebrow">Current check</p>
              <h2>{selectedTable?.name}</h2>
            </div>
            <span>{currentItems.length} поз.</span>
          </div>

          <div className="orderList">
            {!currentItems.length ? (
              <div className="emptyOrder">
                <strong>Чек пустой</strong>
                <p>Выберите товар из меню. Все клики должны работать даже при ошибке Supabase.</p>
              </div>
            ) : (
              currentItems.map((item) => (
                <div key={item.id} className="orderItem">
                  <div>
                    <strong>{item.name}</strong>
                    <span>{money(item.price)} · {item.category}</span>
                  </div>
                  <div className="qty">
                    <button type="button" onClick={() => changeQty(item, -1)}>−</button>
                    <b>{item.qty}</b>
                    <button type="button" onClick={() => changeQty(item, 1)}>+</button>
                  </div>
                  <em>{money(toNumber(item.price) * toNumber(item.qty))}</em>
                </div>
              ))
            )}
          </div>

          <div className="totals">
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

          <div className="actions">
            <button type="button" onClick={saveOrder}>Сохранить</button>
            <button type="button" onClick={printPrecheck}>Пречек</button>
            <button type="button" className="danger" onClick={clearOrder}>Удалить</button>
            <button type="button" onClick={() => notify('Скидка будет добавлена следующим этапом')}>Скидка</button>
          </div>

          <div className="payments">
            <button type="button" onClick={() => pay('cash')} disabled={busy === 'pay-cash'}>
              {busy === 'pay-cash' ? 'Проведение...' : 'Наличные'}
            </button>
            <button type="button" onClick={() => pay('card')} disabled={busy === 'pay-card'}>
              {busy === 'pay-card' ? 'Проведение...' : 'Карта'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  )
}
