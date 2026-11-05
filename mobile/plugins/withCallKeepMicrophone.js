const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

// @config-plugins/react-native-callkeep only declares the VoiceConnectionService's
// foregroundServiceType as "phoneCall". Android 14+ (API 34) requires every
// foreground-service type the service actually uses to be declared, and CallKeep's
// service also holds the mic for the call — without "microphone" here the service
// start is rejected on API 34+ once the app targets it.
module.exports = function withCallKeepMicrophone(config) {
  return withAndroidManifest(config, (config) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(config.modResults);
    app.service = app.service ?? [];
    const service = app.service.find(
      (item) => item.$["android:name"] === "io.wazo.callkeep.VoiceConnectionService"
    );
    if (service) {
      service.$["android:foregroundServiceType"] = "phoneCall|microphone";
    }
    return config;
  });
};
