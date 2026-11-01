const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'fbjs/lib/warning' || moduleName === 'fbjs/lib/warning.js') {
    return {
      filePath: path.resolve(__dirname, 'src/shims/warning.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

