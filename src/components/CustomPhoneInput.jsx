import React, { useState } from 'react';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import PropTypes from 'prop-types';
import flags from 'react-phone-number-input/flags';

const CustomPhoneInput = ({ value, onChange, defaultCountry = 'IN', disabled, ...props }) => {
  const [showCountrySelect, setShowCountrySelect] = useState(false);
  
  // Common country codes for quick selection
  const commonCountries = [
    { code: 'IN', name: 'India (+91)' },
    { code: 'US', name: 'United States (+1)' },
    { code: 'UK', name: 'United Kingdom (+44)' },
    { code: 'CA', name: 'Canada (+1)' },
    { code: 'AU', name: 'Australia (+61)' },
    { code: 'DE', name: 'Germany (+49)' },
    { code: 'FR', name: 'France (+33)' },
  ];

  const handleCountrySelect = (country) => {
    // Create a placeholder phone number with the country code
    const placeholder = `+${country}`;
    onChange(placeholder);
    setShowCountrySelect(false);
  };

  return (
    <div className="custom-phone-input-wrapper">
      <PhoneInput
        international
        defaultCountry={defaultCountry}
        value={value}
        onChange={onChange}
        disabled={disabled}
        countryCallingCodeEditable={true}
        {...props}
      />
      
      {/* Direct country select option */}
      <button 
        type="button" 
        onClick={() => setShowCountrySelect(!showCountrySelect)}
        className="text-sm text-blue-600 hover:text-blue-800 mt-1 flex items-center"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
        </svg>
        Select country directly
      </button>
      
      {showCountrySelect && (
        <div className="bg-white shadow-lg border rounded-lg mt-1 p-2 absolute z-50 w-full max-h-60 overflow-y-auto">
          {commonCountries.map(country => (
            <button
              key={country.code}
              className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center"
              onClick={() => handleCountrySelect(country.code)}
              type="button"
            >
              {flags[country.code] && (
                <img 
                  src={flags[country.code]} 
                  alt={country.code} 
                  className="mr-2 h-4 w-6 object-cover"
                />
              )}
              {country.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

CustomPhoneInput.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  defaultCountry: PropTypes.string,
  disabled: PropTypes.bool
};

export default CustomPhoneInput; 