const createExpoWebpackConfigAsync = require('@expo/webpack-config');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);

  // Avoid eval() in dev bundles to satisfy strict CSP environments.
  if (env && env.mode === 'development') {
    config.devtool = 'source-map';
  }

  return config;
};
