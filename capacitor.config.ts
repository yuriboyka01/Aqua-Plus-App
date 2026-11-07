import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aquaplus.service',
  appName: 'AquaPlus Service',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: false,
    },
  },
};

export default config;
