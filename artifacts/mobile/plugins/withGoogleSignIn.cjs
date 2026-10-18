// Preserve the existing build-environment Google iOS scheme while keeping Expo's
// application configuration static. This does not alter the sign-in flow.
const withGoogleSignIn = require("@react-native-google-signin/google-signin/app.plugin.js").default;
module.exports = function (config) {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
  const iosUrlScheme = clientId
    ? `com.googleusercontent.apps.${clientId.replace(".apps.googleusercontent.com", "")}`
    : undefined;
  return withGoogleSignIn(config, iosUrlScheme ? { iosUrlScheme } : undefined);
};
