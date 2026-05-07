import React from 'react'

const tablesTop = [
  { name: 'Стол 1', seats: '2 места', status: 'Свободен', state: 'free', amount: '' },
  { name: 'Стол 2', seats: '4 места', status: 'Свободен', state: 'free', amount: '' },
  { name: 'Стол 3', seats: '2 места', status: 'Свободен', state: 'free', amount: '' },
  { name: 'Стол 4', seats: '4 места', status: 'Заказ 12:30', state: 'busy', amount: '1 850 ₽' },
  { name: 'Стол 5', seats: '6 мест', status: 'Свободен', state: 'free', amount: '' },
]

const tablesBottom = [
  { name: 'Стол 6', seats: '2 места', status: 'Напечатано', sub: '12:15', state: 'printed', amount: '' },
  { name: 'Стол 7', seats: '4 места', status: 'Свободен', state: 'free', amount: '' },
  { name: 'Стол 8', seats: '2 места', status: 'Напечатано', sub: '12:05', state: 'printed', amount: '' },
  { name: 'Стол 9', seats: '4 места', status: 'Пречек', sub: '12:40', state: 'precheck', amount: '' },
  { name: 'Стол 10', seats: '6 мест', status: 'Свободен', state: 'free', amount: '' },
]

const serviceCards = [
  { title: 'С собой', subtitle: '0 заказов', icon: '👜' },
  { title: 'Доставка', subtitle: '3 заказа', icon: '🛵' },
  { title: 'Быстрый чек', subtitle: 'Новый заказ', icon: '⚡' },
  { title: 'Бар', subtitle: 'Открыт', icon: '🍷' },
]

const orderItems = [
  { name: 'Williams Burger', note: 'Medium Rare', qty: 1, price: '790 ₽', img: '🍔' },
  { name: 'Roosevelt Burger', note: 'Well Done', qty: 2, price: '1 580 ₽', img: '🍔' },
  { name: 'Cappuccino', note: '', qty: 1, price: '300 ₽', img: '☕' },
  { name: 'Americano', note: '', qty: 1, price: '180 ₽', img: '☕' },
]

const categories = ['Еда', 'Напитки', 'Бургеры', 'Пицца', 'Салаты', 'Десерты', 'Снеки', 'Соусы']

const products = [
  { name: 'Williams Burger', price: '790 ₽', emoji: '🍔' },
  { name: 'Roosevelt Burger', price: '790 ₽', emoji: '🍔' },
  { name: 'Cheese Burger', price: '690 ₽', emoji: '🍔' },
  { name: 'BBQ Burger', price: '750 ₽', emoji: '🍔' },

  { name: 'Classic Pizza', price: '890 ₽', emoji: '🍕' },
  { name: 'Pepperoni Pizza', price: '950 ₽', emoji: '🍕' },
  { name: 'Caesar Salad', price: '560 ₽', emoji: '🥗' },
  { name: 'Greek Salad', price: '520 ₽', emoji: '🥗' },

  { name: 'Onion Rings', price: '320 ₽', emoji: '🧅' },
  { name: 'Sweet Potato Fries', price: '350 ₽', emoji: '🍟' },
  { name: 'Chicken Wings', price: '420 ₽', emoji: '🍗' },
  { name: 'Fish & Chips', price: '690 ₽', emoji: '🍤' },
]

const footerFeatures = [
  'Быстрое обслуживание',
  'Контроль и аналитика',
  'Интеграции с доставкой',
  'Поддержка 24/7',
]

const leftFeatures = [
  { icon: '☁', title: 'Облако', text: 'и синхронизация' },
  { icon: '📊', title: 'Аналитика', text: 'в реальном времени' },
  { icon: '🛡', title: 'Надёжность', text: 'и безопасность' },
  { icon: '⚙', title: 'Гибкость', text: 'и масштабируемость' },
]

function Logo() {
  return (
    <div className="rms-logo">
      <div className="rms-mark">R</div>
      <div>
        <div className="rms-title">RMS POS</div>
        <div className="rms-subtitle">Restaurant Management System</div>
      </div>
    </div>
  )
}

function TableCard({ item }) {
  return (
    <div className={`table-card ${item.state}`}>
      <div className="table-card__head">
        <div>
          <div className="table-card__title">{item.name}</div>
          <div className="table-card__meta">{item.seats}</div>
        </div>
        <div className="table-card__icon">
          {item.state === 'printed' ? '🖨' : item.state === 'precheck' ? '🧾' : item.state === 'busy' ? '🕘' : '🪑'}
        </div>
      </div>

      <div className="table-card__footer">
        <div>
          <div className={`table-status ${item.state}`}>{item.status}</div>
          {item.sub ? <div className="table-sub">{item.sub}</div> : null}
        </div>
        {item.amount ? <div className="table-amount">{item.amount}</div> : null}
      </div>
    </div>
  )
}

function App() {
  return (
    <div className="pos-render">
      <div className="layout">
        {/* LEFT */}
        <aside className="left-column">
          <div className="panel login-panel">
            <Logo />

            <div className="pin-title">🔒 Вход по PIN</div>

            <div className="pin-dots">
              <div className="dot-box">•</div>
              <div className="dot-box">•</div>
              <div className="dot-box">•</div>
              <div className="dot-box active">◉</div>
            </div>

            <div className="pin-pad">
              <button>1</button>
              <button>2</button>
              <button>3</button>
              <button>4</button>
              <button>5</button>
              <button>6</button>
              <button>7</button>
              <button>8</button>
              <button>9</button>
              <button>⌫</button>
              <button>0</button>
              <button className="pin-confirm">✓</button>
            </div>

            <div className="terminal-meta">
              <span>Терминал: cloud-preview-001</span>
              <span>Филиал: BC1</span>
            </div>
          </div>

          <div className="left-promo">
            <h1>RMS POS —</h1>
            <p>
              современная POS-система
              <br />
              для ресторанов
              <br />
              и кафе
            </p>

            <div className="left-feature-grid">
              {leftFeatures.map((f) => (
                <div className="left-feature" key={f.title}>
                  <div className="left-feature__icon">{f.icon}</div>
                  <div className="left-feature__title">{f.title}</div>
                  <div className="left-feature__text">{f.text}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <main className="center-column">
          {/* TOP TABLES PANEL */}
          <section className="panel top-panel">
            <div className="topbar">
              <div className="topbar-left">
                <span className="menu-btn">☰</span>
                <span className="brand-inline">RMS POS</span>

                <div className="topbar-meta">
                  <span>Кассир</span>
                  <b>Иван Петров</b>
                </div>

                <div className="topbar-meta">
                  <span>Филиал</span>
                  <b>BC1 · Большой зал</b>
                </div>

                <div className="topbar-meta">
                  <span>Смена</span>
                  <b className="green">Открыта 09:00</b>
                </div>
              </div>

              <div className="topbar-right">
                <span>⌕</span>
                <span>🔔</span>
                <div className="time-box">
                  <b>12:45</b>
                  <span>19 мая, пн</span>
                </div>
              </div>
            </div>

            <div className="hall-row">
              <div className="hall-title">Зал: <b>Основной зал</b></div>
              <div className="hall-actions">
                <button className="icon-btn">▦</button>
                <button className="icon-btn">☰</button>
                <button className="filter-btn">⎚ Фильтр</button>
              </div>
            </div>

            <div className="tables-grid">
              {tablesTop.map((item) => (
                <TableCard key={item.name} item={item} />
              ))}
            </div>

            <div className="tables-grid">
              {tablesBottom.map((item) => (
                <TableCard key={item.name} item={item} />
              ))}
            </div>

            <div className="services-grid">
              {serviceCards.map((item) => (
                <div className="service-card" key={item.title}>
                  <div className="service-card__text">
                    <div className="service-card__title">{item.title}</div>
                    <div className="service-card__subtitle">{item.subtitle}</div>
                  </div>
                  <div className="service-card__icon">{item.icon}</div>
                </div>
              ))}
            </div>

            <div className="tables-summary">
              <div className="summary-left">
                <span>Всего столов: 10</span>
                <span><i className="legend free"></i> Свободно 6</span>
                <span><i className="legend busy"></i> Занято 1</span>
                <span><i className="legend printed"></i> Напечатано 2</span>
                <span><i className="legend precheck"></i> Пречек 1</span>
              </div>
              <button className="plan-btn">⌘ План зала</button>
            </div>
          </section>

          {/* ORDER PANEL */}
          <section className="panel order-panel">
            <div className="order-topbar">
              <div className="order-topbar-left">
                <span className="menu-btn">☰</span>
                <span className="brand-inline">RMS POS</span>
                <div className="order-meta-strong">Стол 4</div>
                <div className="order-meta">👥 4 гостя</div>
                <div className="order-meta">Кассир <b>Иван Петров</b></div>
                <div className="order-meta">Время заказа <b>12:30</b></div>
              </div>
              <div className="order-topbar-right">
                <span>⌕ Поиск</span>
                <span>% Скидка</span>
                <span>✎ Заметка</span>
                <span>⋮</span>
              </div>
            </div>

            <div className="order-content">
              {/* LEFT ORDER */}
              <div className="order-left">
                <div className="order-list">
                  {orderItems.map((item) => (
                    <div className="order-row" key={item.name}>
                      <div className="order-row__thumb">{item.img}</div>
                      <div className="order-row__info">
                        <div className="order-row__name">{item.name}</div>
                        {item.note ? <div className="order-row__note">{item.note}</div> : null}
                      </div>
                      <div className="qty-box">
                        <button>-</button>
                        <span>{item.qty}</span>
                        <button>+</button>
                      </div>
                      <div className="order-row__price">{item.price}</div>
                    </div>
                  ))}
                </div>

                <div className="order-total-box">
                  <div>
                    <div className="order-total-label">Итого</div>
                    <div className="order-total-sub">4 позиции</div>
                  </div>
                  <div className="order-total-price">2 850 ₽</div>
                </div>

                <div className="order-actions">
                  <button className="dark-btn">Отмена заказа</button>
                  <button className="dark-btn">Сохранить</button>
                  <button className="green-btn">Оплатить</button>
                </div>
              </div>

              {/* CATEGORY */}
              <div className="category-column">
                {categories.map((cat, idx) => (
                  <button key={cat} className={`category-btn ${idx === 0 ? 'active' : ''}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* PRODUCTS */}
              <div className="products-grid">
                {products.map((item) => (
                  <div className="product-card" key={item.name}>
                    <div className="product-card__image">{item.emoji}</div>
                    <div className="product-card__name">{item.name}</div>
                    <div className="product-card__price">{item.price}</div>
                    <div className="info-dot">i</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FOOTER FEATURES */}
          <div className="bottom-features">
            {footerFeatures.map((item) => (
              <div className="bottom-feature" key={item}>
                <span className="bottom-feature__icon">◌</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </main>

        {/* RIGHT */}
        <aside className="right-column">
          <div className="hardware-mock">
            <div className="device-screen">
              <div className="device-logo">R</div>
              <div className="device-text">RMS POS</div>
            </div>
            <div className="device-base"></div>
            <div className="receipt-box">
              <div className="receipt-paper">
                <b>RMS POS</b>
                <span>Williams Burger</span>
                <span>Roosevelt Burger</span>
                <span>Cappuccino</span>
                <span>Total: 2 850 ₽</span>
              </div>
            </div>
          </div>

          <div className="panel payment-panel">
            <div className="payment-head">
              <span>Оплата заказа</span>
              <span>✕</span>
            </div>

            <div className="payment-sum-label">К оплате</div>
            <div className="payment-sum">2 850 ₽</div>

            <div className="payment-buttons">
              <button className="pay-btn cash">💵 Наличные</button>
              <button className="pay-btn">💳 Карта</button>
              <button className="pay-btn blue">🛵 Доставка / Wolt</button>
              <button className="split-btn">Разделить счёт</button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default App
