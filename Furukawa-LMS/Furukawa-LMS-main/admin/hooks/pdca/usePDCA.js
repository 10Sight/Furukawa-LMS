import { useContext } from 'react';
import { PDCAContext } from '@/pages/pdca/context/PDCAContext.jsx';

/**
 * Hook to access PDCA context and actions
 */
export function usePDCA() {
  const context = useContext(PDCAContext);
  if (!context) {
    throw new Error('usePDCA must be used within a PDCAProvider');
  }
  return context;
}

export default usePDCA;
