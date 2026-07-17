import { useState, useEffect } from 'react';

const TABLET_MIN = 768;
const TABLET_MAX = 1024;

// True while the viewport width falls within the tablet breakpoint range.
export const useIsTablet = () => {
  const [isTablet, setIsTablet] = useState(
    () => typeof window !== 'undefined' &&
      window.innerWidth >= TABLET_MIN &&
      window.innerWidth <= TABLET_MAX
  );

  useEffect(() => {
    const handleResize = () => {
      setIsTablet(window.innerWidth >= TABLET_MIN && window.innerWidth <= TABLET_MAX);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isTablet;
};

export default useIsTablet;
