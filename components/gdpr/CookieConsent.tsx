// ===============================================
// COOKIE CONSENT BANNER COMPONENT
// ===============================================
// GDPR-compliant cookie consent management

'use client';

import { useState, useEffect } from 'react';
import { useGDPR } from '@/services/gdpr/gdpr.service';
import { Cookie, Shield, Settings, X } from 'lucide-react';

interface CookieConsentProps {
  className?: string;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
  onCustomize?: (consents: Record<string, boolean>) => void;
}

export default function CookieConsent({
  className = '',
  onAcceptAll,
  onRejectAll,
  onCustomize
}: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [customConsents, setCustomConsents] = useState<Record<string, boolean>>({});
  const { 
    getCookieCategories, 
    setCookieConsent, 
    getCookieConsent, 
    isGDPREnabled,
    checkUserLocation 
  } = useGDPR();

  const categories = getCookieCategories();

  useEffect(() => {
    const checkConsentRequired = async () => {
      if (!isGDPREnabled()) return;

      // Check if user already has consent stored
      const existingConsent = getCookieConsent();
      if (existingConsent) {
        setIsVisible(false);
        return;
      }

      // Check if user is in EU (in production, use proper geo-location)
      const { isEU } = await checkUserLocation();
      if (isEU) {
        setIsVisible(true);
        
        // Initialize custom consents with defaults
        const initialConsents: Record<string, boolean> = {};
        categories.forEach(category => {
          initialConsents[category.name] = category.essential;
        });
        setCustomConsents(initialConsents);
      }
    };

    checkConsentRequired();
  }, [isGDPREnabled, getCookieConsent, checkUserLocation]);

  const handleAcceptAll = async () => {
          const allConsents: Record<string, boolean> = {};
      categories.forEach(category => {
        allConsents[category.name] = true;
      });

    await setCookieConsent(allConsents);
    setIsVisible(false);
    onAcceptAll?.();
  };

  const handleRejectAll = async () => {
          const essentialOnly: Record<string, boolean> = {};
      categories.forEach(category => {
        essentialOnly[category.name] = category.essential;
      });

    await setCookieConsent(essentialOnly);
    setIsVisible(false);
    onRejectAll?.();
  };

  const handleCustomize = async () => {
    await setCookieConsent(customConsents);
    setIsVisible(false);
    onCustomize?.(customConsents);
  };

  const handleToggleConsent = (categoryName: string, granted: boolean) => {
    const category = categories.find(cat => cat.name === categoryName);
    if (category?.essential) return; // Cannot toggle essential cookies

    setCustomConsents(prev => ({
      ...prev,
      [categoryName]: granted
    }));
  };

  if (!isVisible) return null;

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50 ${className}`}>
      {!showDetails ? (
        // Main consent banner
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="flex items-center space-x-2">
              <Cookie className="h-5 w-5 text-blue-600" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  We use cookies
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We use cookies to enhance your experience, analyze site traffic, and personalize content. 
                  By clicking "Accept All", you consent to our use of cookies.
                </p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2 md:ml-auto">
              <button
                onClick={() => setShowDetails(true)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Settings className="h-4 w-4 inline mr-1" />
                Customize
              </button>
              <button
                onClick={handleRejectAll}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={handleAcceptAll}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Accept All
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Detailed consent options
        <div className="max-w-4xl mx-auto p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Cookie Preferences
            </h3>
            <button
              onClick={() => setShowDetails(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close cookie preferences"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {categories.map(category => (
              <div key={category.name} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-gray-500" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </h4>
                    {category.essential && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        Essential
                      </span>
                    )}
                  </div>
                  <button
                    role="switch"
                    aria-checked={customConsents[category.name]}
                    onClick={() => handleToggleConsent(category.name, !customConsents[category.name])}
                    disabled={category.essential}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      customConsents[category.name] ? 'bg-blue-600' : 'bg-gray-200'
                    } ${category.essential ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span className="sr-only">
                      Toggle {category.name}
                    </span>
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        customConsents[category.name] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {category.purpose}
                </p>

                {/* Cookie details */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                  <h5 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cookie details:
                  </h5>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-600 dark:text-gray-400">
                        {category.name}
                      </span>
                      <span className="text-gray-500 dark:text-gray-500">
                        {category.duration}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={handleRejectAll}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Reject All
            </button>
            <button
              onClick={handleAcceptAll}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Accept All
            </button>
            <button
              onClick={handleCustomize}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors ml-auto"
            >
              Save Preferences
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 