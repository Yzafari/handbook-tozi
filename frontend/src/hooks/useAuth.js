import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth باید داخل AuthProvider استفاده شود.');
  }

  return context;
}

export default useAuth;