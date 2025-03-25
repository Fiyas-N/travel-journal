# Travel Journal - LibreTranslate Integration

This project has been enhanced with LibreTranslate integration to provide dynamic translation capabilities beyond the static translations defined in the application.

## What is LibreTranslate?

[LibreTranslate](https://libretranslate.com/) is a free and open-source machine translation API that can be used to translate text between different languages. It's a self-hosted alternative to services like Google Translate.

## How the Translation System Works

The Travel Journal application now uses a hybrid translation approach:

1. **Static Translations**: Predefined translations in `src/utils/translations.js` for supported languages
2. **Dynamic Translations**: On-the-fly translations via LibreTranslate for missing translations or unsupported languages

## Configuration

The LibreTranslate integration can be configured in `src/utils/config.js`:

```javascript
// LibreTranslate configuration
export const libreTranslateConfig = {
  // Main API URL - change to your preferred instance
  apiUrl: 'https://libretranslate.de/',
  
  // Fallback API URLs if the main one fails
  fallbackApiUrls: [
    'https://translate.argosopentech.com/',
    'https://translate.terraprint.co/'
  ],
  
  // Whether to use LibreTranslate 
  enabled: true,
  
  // API key if required (some instances require an API key)
  // apiKey: 'your-api-key',
  
  // More configuration options...
};
```

## Using Translations in Components

### 1. Using the Translation Context

```jsx
import { useTranslationContext } from '../components/TranslationProvider';

function MyComponent() {
  const { t, language, translateRawText } = useTranslationContext();
  
  return (
    <div>
      <h1>{t('welcomeMessage')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

### 2. Using the TranslateText Component

The `TranslateText` component can be used to dynamically translate any text:

```jsx
import TranslateText from '../components/TranslateText';

function TextDisplay({ description }) {
  return (
    <div>
      <TranslateText 
        text={description}
        sourceLanguage="auto"
        showOriginal={false}
      />
    </div>
  );
}
```

## Debug Mode

The application includes a debug mode that can be accessed by clicking the "Debug" button at the bottom right corner of the screen. This will show:

- Current language and available languages
- Translation status
- LibreTranslate connection status
- Sample translations

## Self-Hosting LibreTranslate

For better performance and reliability, you can self-host LibreTranslate:

1. Follow the [official instructions](https://github.com/LibreTranslate/LibreTranslate#install)
2. Update the `apiUrl` in `src/utils/config.js` to point to your instance

## Supported Languages

The application supports the following languages out of the box:

- English (en)
- Hindi (hi)
- Malayalam (ml)

When LibreTranslate is enabled, additional languages may be available depending on the LibreTranslate instance.

## Fallback Mechanism

If LibreTranslate is unavailable or a translation fails:

1. The system will try to use static translations
2. If no static translation exists, it falls back to English
3. If no English translation exists, it will use the key as the text

## Adding New Static Translations

To add new static translations, update the `src/utils/translations.js` file:

```javascript
const translations = {
  en: {
    newKey: 'New text in English',
    // ...
  },
  hi: {
    newKey: 'नई हिंदी पाठ',
    // ...
  },
  ml: {
    newKey: 'പുതിയ മലയാളം പാഠം',
    // ...
  }
};
```

## Libraries Used

- **axios**: For making HTTP requests to LibreTranslate
- **React Context API**: For providing translations throughout the app

## Performance Considerations

- Translations are cached to avoid repeated API calls
- Long texts are split into chunks for better translation quality
- The system includes fallback URLs if the main LibreTranslate instance fails
