const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro-config");

// Fix para Windows: Convertimos la ruta absoluta a un formato compatible (forward slashes)
// y nos aseguramos de que no haya caracteres que confundan al loader de ESM.
const projectRoot = __dirname.replace(/\\/g, '/');
const config = getDefaultConfig(projectRoot);

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
