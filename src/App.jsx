import React, { useMemo, useState } from 'react'

const TABLES = [
  { id: 'T1', name: 'Стол 1', seats: '2 места', status: 'Свободен', state: 'free', amount: 0 },
  { id: 'T2', name: 'Стол 2', seats: '4 места', status: 'Свободен', state: 'free', amount: 0 },
  { id: 'T3', name: 'Стол 3', seats: '2 места', status: 'Свободен', state: 'free', amount: 0 },
  { id: 'T4', name: 'Стол 4', seats: '4 места', status: 'Заказ 12:30', state: 'busy', amount: 1850 },
  { id: 'T5', name: 'Стол 5', seats: '6 мест', status: 'Свободен', state: 'free', amount: 0 },
  { id: 'T6', name: 'Стол 6', seats: '2 места', status: 'Напечатано', sub: '12:15', state: 'printed', amount: 0 },
  { id: 'T7', name: 'Стол 7', seats: '4 места', status: 'Свободен', state: 'free', amount: 0 },
  { id: 'T8', name: 'Стол 8', seats: '2 места', status: 'Напечатано', sub: '12:05', state: 'printed', amount: 0 },
  { id: 'T9', name: 'Стол 9', seats: '4 места', status: 'Пречек', sub: '12:40', state: 'precheck', amount: 0 },
  { id: 'T10', name: 'Стол 10', seats: '6 мест', status: 'Свободен', state: 'free', amount: 0 },
]

const SERVICE_CARDS = [
  { id: 'TA', title: 'С собой', subtitle: '0 заказов', icon: '👜' },
  { id: 'DL', title: 'Доставка', subtitle: '3 заказа', icon: '🛵' },
  { id: 'FAST', title: 'Быстрый чек', subtitle: 'Новый заказ', icon: '⚡' },
  { id: 'BAR', title: 'Бар', subtitle: 'Открыт', icon: '🍷' },
]

const CATEGORIES = ['Еда', 'Напитки', 'Бургеры', 'Пицца', 'Салаты', 'Кофе', 'Чай', 'Десерты', 'Снеки', 'Соусы']

const PRODUCTS = [
  { id: 'p1', category: 'Бургеры', type: 'Еда', name: 'Williams Burger', price: 790, emoji: '🍔' },
  { id: 'p2', category: 'Бургеры', type: 'Еда', name: 'Roosevelt Burger', price: 790, emoji: '🍔' },
  { id: 'p3', category: 'Бургеры', type: 'Еда', name: 'Cheese Burger', price: 690, emoji: '🍔' },
  { id: 'p4', category: 'Бургеры', type: 'Еда', name: 'BBQ Burger', price: 750, emoji: '🍔' },
  { id: 'p5', category: 'Пицца', type: 'Еда', name: 'Classic Pizza', price: 890, emoji: '🍕' },
  { id: 'p6', category: 'Пицца', type: 'Еда', name: 'Pepperoni Pizza', price: 950, emoji: '🍕' },
  { id: 'p7', category: 'Салаты', type: 'Еда', name: 'Caesar Salad', price: 560, emoji: '🥗' },
  { id: 'p8', category: 'Салаты', type: 'Еда', name: 'Greek Salad', price: 520, emoji: '🥗' },
  { id: 'p9', category: 'Снеки', type: 'Еда', name: 'Onion Rings', price: 320, emoji: '🧅' },
  { id: 'p10', category: 'Снеки', type: 'Еда', name: 'Sweet Potato Fries', price: 350, emoji: '🍟' },
  { id: 'p11', category: 'Снеки', type: 'Еда', name: 'Chicken Wings', price: 420, emoji: '🍗' },
  { id: 'p12', category: 'Снеки', type: 'Еда', name: 'Fish & Chips', price: 690, emoji: '🍤' },
  { id: 'p13', category: 'Кофе', type: 'Напитки', name: 'Cappuccino', price: 300, emoji: '☕' },
  { id: 'p14', category: 'Кофе', type: 'Напитки', name: 'Americano', price: 180, emoji: '☕' },
  { id: 'p15', category: 'Чай', type: 'Напитки', name: 'English Breakfast Tea', price: 190, emoji: '🍵' },
]

const formatMoney = (value) => `${Number(value || 0).toLocaleString('ru-RU')} ₽`

function Logo() {
  return <div className="rms-logo"><div className="rms-mark">R</div><div><div className="rms-title">RMS POS</div><div className="rms-subtitle">Restaurant Management System</div></div></div>
}

function TableCard({ item, onClick }) {
  return <button type="button" className={`table-card ${item.state}`} onClick={onClick}>
    <div className="table-card__head"><div><div className="table-card__title">{item.name}</div><div className="table-card__meta">{item.seats}</div></div><div className="table-card__icon">{item.state === 'printed' ? '🖨' : item.state === 'precheck' ? '🧾' : item.state === 'busy' ? '🕘' : '🪑'}</div></div>
    <div className="table-card__footer"><div><div className={`table-status ${item.state}`}>{item.status}</div>{item.sub ? <div className="table-sub">{item.sub}</div> : null}</div>{item.amount ? <div className="table-amount">{formatMoney(item.amount)}</div> : null}</div>
  </button>
}

export default function App() {
  const [pin, setPin] = useState('')
  const [message, setMessage] = useState('')
  const [selectedTable, setSelectedTable] = useState(TABLES[3])
  const [selectedCategory, setSelectedCategory] = useState('Еда')
  const [orderItems, setOrderItems] = useState([
    { id: 'p1', name: 'Williams Burger', note: 'Medium Rare', qty: 1, price: 790, emoji: '🍔' },
    { id: 'p2', name: 'Roosevelt Burger', note: 'Well Done', qty: 2, price: 790, emoji: '🍔' },
    { id: 'p13', name: 'Cappuccino', note: '', qty: 1, price: 300, emoji: '☕' },
    { id: 'p14', name: 'Americano', note: '', qty: 1, price: 180, emoji: '☕' },
  ])

  const total = useMemo(() => orderItems.reduce((sum, item) => sum + item.qty * item.price, 0), [orderItems])
  const visibleProducts = useMemo(() => {
    if (selectedCategory === 'Еда') return PRODUCTS.filter((p) => p.type === 'Еда')
    if (selectedCategory === 'Напитки') return PRODUCTS.filter((p) => p.type === 'Напитки')
    return PRODUCTS.filter((p) => p.category === selectedCategory)
  }, [selectedCategory])

  function pressPin(value) {
    setMessage('')
    if (value === 'clear') return setPin('')
    if (value === 'back') return setPin((prev) => prev.slice(0, -1))
    if (value === 'enter') {
      if (pin.length < 4) return setMessage('Введите PIN из 4 цифр')
      return setMessage('PIN принят. Смена открыта.')
    }
    setPin((prev) => (prev + String(value)).slice(0, 4))
  }

  function addProduct(product) {
    setMessage('')
    setOrderItems((prev) => {
      const existing = prev.find((item) => item.id === product.id)
      if (existing) return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item)
      return [...prev, { id: product.id, name: product.name, note: '', qty: 1, price: product.price, emoji: product.emoji }]
    })
  }

  function changeQty(id, diff) {
    setOrderItems((prev) => prev.map((item) => item.id === id ? { ...item, qty: item.qty + diff } : item).filter((item) => item.qty > 0))
  }

  function openTable(table) {
    setSelectedTable(table)
    setMessage(`${table.name} открыт`)
  }

  function action(name) {
    if (name === 'Пречек') return setMessage('Пречек распечатан')
    if (name === 'Кухня') return setMessage('Заказ отправлен на кухню')
    if (name === 'Бар') return setMessage('Заказ отправлен в бар')
    if (name === 'Отмена') { setOrderItems([]); return setMessage('Заказ очищен') }
    if (name === 'Касса') return setMessage('Переход к оплате')
  }

  return <div className="pos-render"><div className="layout">
    <aside className="left-column">
      <div className="panel login-panel">
        <Logo />
        <div className="pin-title">🔒 Вход по PIN</div>
        <div className="pin-dots">{[0,1,2,3].map(i => <div key={i} className={`dot-box ${pin.length === i + 1 ? 'active' : ''}`}>{pin[i] ? '•' : ''}</div>)}</div>
        <div className="pin-pad">
          {[1,2,3,4,5,6,7,8,9].map(n => <button key={n} type="button" onClick={() => pressPin(n)}>{n}</button>)}
          <button type="button" onClick={() => pressPin('back')}>⌫</button><button type="button" onClick={() => pressPin(0)}>0</button><button type="button" className="pin-confirm" onClick={() => pressPin('enter')}>✓</button>
        </div>
        <button type="button" className="clear-pin" onClick={() => pressPin('clear')}>Очистить PIN</button>
        {message && <div className="inline-message">{message}</div>}
        <div className="terminal-meta"><span>Терминал: cloud-preview-001</span><span>Филиал: BC1</span></div>
      </div>
      <div className="left-promo"><h1>RMS POS —</h1><p>современная POS-система<br/>для ресторанов<br/>и кафе</p><div className="left-feature-grid">{[['☁','Облако','и синхронизация'],['📊','Аналитика','в реальном времени'],['🛡','Надёжность','и безопасность'],['⚙','Гибкость','и масштабируемость']].map(f => <div className="left-feature" key={f[1]}><div className="left-feature__icon">{f[0]}</div><div className="left-feature__title">{f[1]}</div><div className="left-feature__text">{f[2]}</div></div>)}</div></div>
    </aside>

    <main className="center-column">
      <section className="panel top-panel">
        <div className="topbar"><div className="topbar-left"><button type="button" className="menu-btn">☰</button><span className="brand-inline">RMS POS</span><div className="topbar-meta"><span>Кассир</span><b>Иван Петров</b></div><div className="topbar-meta"><span>Филиал</span><b>BC1 · Большой зал</b></div><div className="topbar-meta"><span>Смена</span><b className="green">Открыта 09:00</b></div></div><div className="topbar-right"><button type="button" className="top-icon">⌕</button><button type="button" className="top-icon">🔔</button><div className="time-box"><b>12:45</b><span>19 мая, пн</span></div></div></div>
        <div className="hall-row"><div className="hall-title">Зал: <b>Основной зал</b></div><div className="hall-actions"><button type="button" className="icon-btn">▦</button><button type="button" className="icon-btn">☰</button><button type="button" className="filter-btn">⎚ Фильтр</button></div></div>
        <div className="tables-grid">{TABLES.slice(0,5).map(item => <TableCard key={item.id} item={item} onClick={() => openTable(item)} />)}</div>
        <div className="tables-grid">{TABLES.slice(5,10).map(item => <TableCard key={item.id} item={item} onClick={() => openTable(item)} />)}</div>
        <div className="services-grid">{SERVICE_CARDS.map(item => <button type="button" className="service-card" key={item.id} onClick={() => { setSelectedTable({id:item.id,name:item.title}); setMessage(`${item.title} открыт`) }}><div><div className="service-card__title">{item.title}</div><div className="service-card__subtitle">{item.subtitle}</div></div><div className="service-card__icon">{item.icon}</div></button>)}</div>
        <div className="tables-summary"><div className="summary-left"><span>Всего столов: 10</span><span><i className="legend free"></i> Свободно 6</span><span><i className="legend busy"></i> Занято 1</span><span><i className="legend printed"></i> Напечатано 2</span><span><i className="legend precheck"></i> Пречек 1</span></div><button type="button" className="plan-btn">⌘ План зала</button></div>
      </section>

      <section className="panel order-panel">
        <div className="order-topbar"><div className="order-topbar-left"><button type="button" className="menu-btn">☰</button><span className="brand-inline">RMS POS</span><div className="order-meta-strong">{selectedTable.name}</div><div className="order-meta">👥 4 гостя</div><div className="order-meta">Кассир <b>Иван Петров</b></div><div className="order-meta">Время заказа <b>12:30</b></div></div><div className="order-topbar-right"><button type="button">⌕ Поиск</button><button type="button">% Скидка</button><button type="button">✎ Заметка</button><button type="button">⋮</button></div></div>
        <div className="order-content"><div className="order-left"><div className="order-list">{orderItems.map(item => <div className="order-row" key={item.id}><div className="order-row__thumb">{item.emoji}</div><div><div className="order-row__name">{item.name}</div>{item.note && <div className="order-row__note">{item.note}</div>}</div><div className="qty-box"><button type="button" onClick={() => changeQty(item.id,-1)}>-</button><span>{item.qty}</span><button type="button" onClick={() => changeQty(item.id,1)}>+</button></div><div className="order-row__price">{formatMoney(item.qty * item.price)}</div></div>)}{!orderItems.length && <div className="empty-order">Заказ пуст</div>}</div><div className="order-total-box"><div><div className="order-total-label">Итого</div><div className="order-total-sub">{orderItems.length} позиции</div></div><div className="order-total-price">{formatMoney(total)}</div></div><div className="order-actions"><button type="button" className="dark-btn" onClick={() => action('Отмена')}>Отмена заказа</button><button type="button" className="dark-btn" onClick={() => setMessage('Заказ сохранён')}>Сохранить</button><button type="button" className="green-btn" onClick={() => action('Касса')}>Оплатить</button></div><div className="station-actions"><button type="button" onClick={() => action('Кухня')}>Кухня</button><button type="button" onClick={() => action('Бар')}>Бар</button><button type="button" onClick={() => action('Пречек')}>Пречек</button></div></div><div className="category-column">{CATEGORIES.map(cat => <button type="button" key={cat} className={`category-btn ${selectedCategory===cat?'active':''}`} onClick={() => setSelectedCategory(cat)}>{cat}</button>)}</div><div className="products-grid">{visibleProducts.map(item => <button type="button" className="product-card" key={item.id} onClick={() => addProduct(item)}><div className="product-card__image">{item.emoji}</div><div className="product-card__name">{item.name}</div><div className="product-card__price">{formatMoney(item.price)}</div><div className="info-dot">i</div></button>)}</div></div>
      </section>
      <div className="bottom-features">{['Быстрое обслуживание','Контроль и аналитика','Интеграции с доставкой','Поддержка 24/7'].map(item => <div className="bottom-feature" key={item}><span className="bottom-feature__icon">◌</span><span>{item}</span></div>)}</div>
    </main>

    <aside className="right-column"><div className="hardware-mock"><div className="device-screen"><div className="device-logo">R</div><div className="device-text">RMS POS</div></div><div className="device-base"></div><div className="receipt-box"><div className="receipt-paper"><b>RMS POS</b><span>Williams Burger</span><span>Roosevelt Burger</span><span>Cappuccino</span><span>Total: {formatMoney(total)}</span></div></div></div><div className="panel payment-panel"><div className="payment-head"><span>Оплата заказа</span><button type="button" onClick={() => setMessage('Оплата закрыта')}>✕</button></div><div className="payment-sum-label">К оплате</div><div className="payment-sum">{formatMoney(total)}</div><div className="payment-buttons"><button type="button" className="pay-btn cash" onClick={() => setMessage('Оплата наличными выбрана')}>💵 Наличные</button><button type="button" className="pay-btn" onClick={() => setMessage('Оплата картой выбрана')}>💳 Карта</button><button type="button" className="pay-btn blue" onClick={() => setMessage('Оплата через доставку выбрана')}>🛵 Доставка / Wolt</button><button type="button" className="split-btn" onClick={() => setMessage('Разделение счёта пока в демо-режиме')}>Разделить счёт</button></div></div></aside>
  </div></div>
}
