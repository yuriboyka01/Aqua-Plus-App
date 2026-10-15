# Aqua Plus 💧

Aqua Plus is a modern mobile application built for water purifier (RO) sales and service operations. It streamlines customer management, service job logging, periodic maintenance reminders, and WhatsApp customer communications.

## 🚀 Key Features

- **Dashboard**: Real-time service metrics, upcoming reminders, and quick service actions.
- **Customer Directory**: Customer profiles with RO brand/model, installation dates, service history, and location tracking.
- **Service Job Logging**: Log periodic filter replacements, TDS readings, technician notes, and payment statuses.
- **Maintenance Reminders**: Automated follow-up schedules with direct WhatsApp notification integration.
- **Map & Routing**: Geolocation support with quick navigation to customer addresses.
- **Offline-ready & Responsive**: Smooth mobile-first UI with dark/light theme support.

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev) (SDK 57)
- **Routing**: [Expo Router](https://docs.expo.dev/router/introduction/) (File-based navigation)
- **Language**: TypeScript
- **Icons**: `lucide-react-native`
- **UI & Animations**: React Native Reanimated, Linear Gradient, SVG

## 🏁 Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npx expo start
   ```

3. **Run on your target platform:**
   - Press <kbd>a</kbd> for Android emulator / device
   - Press <kbd>i</kbd> for iOS simulator
   - Press <kbd>w</kbd> for Web browser
   - Scan the QR code using Expo Go on your mobile device

## 📋 Code Quality & Validation

```bash
# Typecheck
npx tsc --noEmit

# Lint
npx expo lint
```
