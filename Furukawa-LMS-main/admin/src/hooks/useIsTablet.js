import { useState, useEffect } from 'react';

const TABLET_MIN = 768;
const TABLET_MAX = 1024;
const MOBILE_MAX = 767;

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

// True while the viewport width is at or below the mobile breakpoint.
export const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_MAX);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

export default useIsTablet;
