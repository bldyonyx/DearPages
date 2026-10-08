import { createPortal } from 'react-dom'

function Portal({ children }) {
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(children, document.body)
}

export default Portal
