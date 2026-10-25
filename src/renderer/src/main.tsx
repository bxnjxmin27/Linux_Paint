import { createRoot } from 'react-dom/client'
import App from './App'
import { controller } from './engine/controller'
import { useUI } from './state/store'
import './styles/global.css'

const root = document.getElementById('root')
if (!root) throw new Error('Root element missing')

;(window as unknown as { __paint: typeof controller; __paintUI: typeof useUI }).__paint = controller
;(window as unknown as { __paint: typeof controller; __paintUI: typeof useUI }).__paintUI = useUI

createRoot(root).render(<App />)
