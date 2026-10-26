import { useContext } from 'react';
import { PDCAContext } from '@/pages/pdca/context/PDCAContext.jsx';

/**
 * Hook to access PDCA context and actions
 */
export function usePDCA() {
  const context = useContext(PDCAContext);
  if (!context) {
    return {
      data: [],
      setData: () => {},
      showToast: (msg) => { console.log(msg); },
      userContext: {},
      handleAddPDCA: () => {},
      handleUpdatePDCA: () => {},
      refreshData: () => {}
    };
  }
  return context;
}

export default usePDCA;
