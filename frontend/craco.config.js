const path = require('path');
const webpack = require('webpack');
const dotenv = require('dotenv');

// Load environment variables from .env file AND process.env (for CI/CD like Vercel)
const envFile = dotenv.config().parsed || {};
const env = { ...process.env, ...envFile };

// Define which keys we want to inject (to avoid injecting sensitive system env vars)
const keysToInject = ['API_URL', 'APP_SOCKET_URL', 'APP_ENCRYPTION_KEY'];

const envKeys = keysToInject.reduce((prev, next) => {
  if (env[next]) {
    prev[`process.env.${next}`] = JSON.stringify(env[next]);
  }
  return prev;
}, {});

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    plugins: {
      add: [
        new webpack.DefinePlugin(envKeys)
      ]
    }
  },
  jest: {
    configure: {
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
    },
  },
};
