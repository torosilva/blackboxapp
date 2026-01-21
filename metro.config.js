const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro-config");
const { pathToFileURL } = require("url");

// Resolvemos el error de protocolo 'c:' en Windows forzando el esquema file://
const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/styles/global.css" });
