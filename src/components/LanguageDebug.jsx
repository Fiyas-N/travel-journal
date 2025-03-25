import React, { useState } from 'react';
import translations from '../utils/translations';
import { useTranslationContext } from './TranslationProvider';

/**
 * LanguageDebug component for diagnosing translation issues
 * Now using TranslationContext instead of props
 */
const LanguageDebug = () => {
  const [expanded, setExpanded] = useState(false);
  const { 
    language, 
    languages, 
    setLanguage, 
    libreTranslateAvailable, 
    hasStaticTranslation,
    t,
    debugMode,
    toggleDebugMode,
    availableLanguages,
    staticLanguages
  } = useTranslationContext();
  
  const currentTranslations = translations[language] || {};
  const translationCount = Object.keys(currentTranslations).length;
  
  // If debug mode is disabled, don't render anything
  if (!debugMode) {
    return (
      <button
        onClick={toggleDebugMode}
        className="fixed bottom-3 right-3 z-50 bg-blue-600 text-white px-3 py-1 rounded-md shadow-md hover:bg-blue-700 transition-colors text-sm font-medium"
      >
        Debug
      </button>
    );
  }
  
  return (
    <>
      <div className="fixed top-20 right-4 z-50 bg-white border border-gray-200 shadow-lg rounded-lg p-4 max-w-md">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-bold text-lg">Language Debug</h3>
          <button 
            onClick={() => setExpanded(!expanded)} 
            className="text-blue-600 hover:text-blue-800"
          >
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
        
        <div className="mb-3">
          <div><strong>Current Language:</strong> {language}</div>
          <div><strong>Available Languages:</strong> {Object.keys(translations).join(', ')}</div>
          <div><strong>LibreTranslate Available:</strong> {libreTranslateAvailable ? 'Yes' : 'No'}</div>
          <div><strong>Translation Count:</strong> {translationCount} keys</div>
        </div>
        
        {/* Language switcher */}
        <div className="mb-4">
          <div className="font-bold text-sm mb-2">Switch Language:</div>
          <div className="flex flex-wrap gap-2">
            {languages.map(lang => (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`px-2 py-1 text-sm rounded ${
                  language === lang.code 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
        
        {expanded && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Sample Translations:</h4>
            <div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-200">
                    <th className="p-1 text-left">Key</th>
                    <th className="p-1 text-left">Translation</th>
                    <th className="p-1 text-left">Static</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(currentTranslations).slice(0, 10).map(([key, value]) => (
                    <tr key={key} className="border-b border-gray-100">
                      <td className="p-1 font-mono text-xs">{key}</td>
                      <td className="p-1">{value}</td>
                      <td className="p-1">
                        {hasStaticTranslation(key) ? 
                          <span className="text-green-600">✓</span> : 
                          <span className="text-red-600">✗</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {Object.keys(currentTranslations).length > 10 && (
                <div className="text-center text-gray-500 mt-2 text-xs">
                  ... and {Object.keys(currentTranslations).length - 10} more
                </div>
              )}
            </div>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Translation Usage:</h4>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                <p className="text-sm">Expected behavior: <code>t.home</code> should return <strong>{t('home')}</strong></p>
                <p className="text-sm mt-2">
                  If you're seeing English text instead of translated text, check that:
                </p>
                <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                  <li>The components are using the TranslationContext properly</li>
                  <li>Static translations exist for the current language</li>
                  <li>LibreTranslate is working for dynamic translations</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-semibold mb-2">LibreTranslate Status:</h4>
              <div className="bg-gray-50 p-3 rounded border border-gray-200">
                {libreTranslateAvailable ? (
                  <div className="text-green-600 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    LibreTranslate is available for dynamic translations
                  </div>
                ) : (
                  <div className="text-red-600 flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    LibreTranslate is not available - falling back to static translations
                  </div>
                )}
              </div>
            </div>
            
            {availableLanguages.length > 0 && (
              <div className="mt-4">
                <h4 className="font-semibold mb-2">LibreTranslate Languages:</h4>
                <div className="bg-gray-50 p-3 rounded border border-gray-200 max-h-48 overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    {availableLanguages.map(lang => (
                      <div key={lang.code} className="p-1 hover:bg-gray-100">
                        <span className="font-semibold">{lang.code}:</span> {lang.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="mt-4 pt-3 border-t border-gray-200 text-right">
          <button
            onClick={toggleDebugMode}
            className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
          >
            Close Debug
          </button>
        </div>
      </div>
    </>
  );
};

export default LanguageDebug; 