import { Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SplashScreen({ onComplete }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = window.setTimeout(() => setIsExiting(true), 4300);
    const completeTimer = window.setTimeout(onComplete, 4520);
    return () => {
      window.clearTimeout(exitTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return <div className={`splash-screen${isExiting ? ' splash-screen-exiting' : ''}`} role="status" aria-label="Loading LeadPulse AI">
    <div className="splash-brand-mark"><Activity size={22} strokeWidth={2} /></div>
    <h1 className="splash-title">LeadPulse <span>AI</span></h1>
    <p className="splash-subtitle">Smart AI Lead Qualification &amp; CRM</p>
    <div className="splash-loader" aria-hidden="true"><span /></div>
  </div>;
}
