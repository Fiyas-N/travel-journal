import { Navigate } from 'react-router-dom'
import PropTypes from 'prop-types'

const ProtectedRoute = ({ user, children }) => {
  if (!user) {
    // Redirect to signin if user is not authenticated
    return <Navigate to="/auth" replace />
  }

  return children
}

ProtectedRoute.propTypes = {
  user: PropTypes.object,
  children: PropTypes.node.isRequired
}

export default ProtectedRoute 