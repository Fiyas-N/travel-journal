# Travel Journal

A travel journaling application built with React, Firebase, and Tailwind CSS.

## Features

- Record your travel experiences
- View and share destinations
- Personalized recommendations
- Multilingual support
- Authentication with phone verification

## Deployment

This application is deployed on Vercel.

<!-- Deployment trigger update -->

# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Phone Verification with OTP

The app now includes phone verification with OTP (One-Time Password) for enhanced security:

1. **Phone Number Input**: Users can enter their phone number with an international format picker
2. **Automatic Country Detection**: The app detects the user's country based on browser settings
3. **Real-time Validation**: Phone numbers are validated in real-time as users type
4. **reCAPTCHA Verification**: Implements reCAPTCHA v3 for security before sending OTP
5. **SMS Verification**: Users receive an SMS with a one-time password to verify their phone
6. **Multilingual Support**: All phone verification steps are available in multiple languages

This verification process ensures that only users with valid phone numbers can create accounts, adding an extra layer of security to the application.
