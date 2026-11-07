import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquaplus.service',
  appName: 'AquaPlus Service',
  webDir: 'dist',
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      resetWhenUpdate: false,
    },
  },
};

export default config;
