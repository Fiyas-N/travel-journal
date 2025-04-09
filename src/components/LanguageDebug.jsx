import React, { useState } from 'react';
import PropTypes from 'prop-types';
import translations from '../utils/translations';

/**
 * LanguageDebug component for diagnosing translation issues
 * @param {Object} props - Component props
 * @param {string} props.language - Current language code 
 */
const LanguageDebug = ({ language }) => {
  const [expanded, setExpanded] = useState(false);
  const currentTranslations = translations[language] || {};
  const translationCount = Object.keys(currentTranslations).length;
  
  return (
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
        <div><strong>Translation Count:</strong> {translationCount} keys</div>
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
                </tr>
              </thead>
              <tbody>
                {Object.entries(currentTranslations).slice(0, 10).map(([key, value]) => (
                  <tr key={key} className="border-b border-gray-100">
                    <td className="p-1 font-mono text-xs">{key}</td>
                    <td className="p-1">{value}</td>
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
              <p className="text-sm">Expected behavior: <code>t.home</code> should return <strong>{currentTranslations.home || 'undefined'}</strong></p>
              <p className="text-sm mt-2">
                If you're seeing English text instead of translated text, check that:
              </p>
              <ul className="list-disc pl-5 text-sm mt-1 space-y-1">
                <li>The language prop is being passed correctly</li>
                <li>The components are using the translations object properly</li>
                <li>The t object is being initialized with the right language</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

LanguageDebug.propTypes = {
  language: PropTypes.string.isRequired
};

export default LanguageDebug; 