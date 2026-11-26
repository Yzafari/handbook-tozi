const appJson = require('./app.json');

/**
 * Android blocks cleartext HTTP by default (usesCleartextTraffic=false).
 *
 * A release build pointed at an on-premise / data-centre server that has no TLS
 * certificate cannot reach the API at all, and the app only shows generic
 * network errors. So allow cleartext only when the configured endpoint itself
 * is http://; an HTTPS endpoint keeps the secure default.
 */
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').trim();
const usesCleartextTraffic = /^http:\/\//i.test(apiUrl);

module.exports = () => {
  const { plugins = [], ...config } = appJson.expo;

  return {
    ...config,
    plugins: plugins.map(plugin => {
      if (Array.isArray(plugin) && plugin[0] === 'expo-build-properties') {
        return [
          plugin[0],
          {
            ...(plugin[1] ?? {}),
            android: { ...(plugin[1]?.android ?? {}), usesCleartextTraffic },
          },
        ];
      }
      return plugin;
    }),
  };
};
