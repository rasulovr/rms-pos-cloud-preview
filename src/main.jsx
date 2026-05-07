import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('RMS POS render error:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fatalShell">
          <div className="fatalCard">
            <div className="fatalLogo">!</div>
            <h1>RMS POS не отрисовался</h1>
            <p>Это ошибка React-render. Откройте Console в браузере и посмотрите красную ошибку.</p>
            <pre>{String(this.state.error?.message || this.state.error || 'Unknown error')}</pre>
            <button type="button" onClick={() => window.location.reload()}>Перезагрузить</button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
)
