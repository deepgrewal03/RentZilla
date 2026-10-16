import type { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
  const iosUrlScheme = iosClientId
    ? `com.googleusercontent.apps.${iosClientId.replace(".apps.googleusercontent.com", "")}`
    : "";

  const plugins: ExpoConfig["plugins"] = [
    [
      "expo-build-properties",
      {
        ios: {
          // AppCheckCore imports these Objective-C dependencies from Swift.
          // Generate module maps only for these pods, not all React Native pods.
          extraPods: [
            { name: "GoogleUtilities", modular_headers: true },
            { name: "RecaptchaInterop", modular_headers: true },
          ],
        },
        android: {
          compileSdkVersion: 36,
          targetSdkVersion: 36,
          buildToolsVersion: "36.0.0",
          // AGP 8.5.1+ packages uncompressed native libraries with the
          // 16 KB ZIP alignment required by Google Play.
          packagingOptions: {
            jniLibs: { useLegacyPackaging: false },
          },
        },
      },
    ],
    ["expo-router", { origin: "https://rent-organizer.replit.app" }],
    "expo-font",
    "expo-web-browser",
    [
      "expo-image-picker",
      {
        photosPermission:
          "RentZilla needs access to your photos to set your profile picture.",
        cameraPermission:
          "RentZilla needs camera access to take your profile photo.",
        microphonePermission: false,
      },
    ],
    ["expo-audio", { microphonePermission: false, recordAudioAndroid: false }],
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "RentZilla uses your location to auto-fill your service address and show nearby listings.",
      },
    ],
    "expo-apple-authentication",
    iosUrlScheme
      ? ["@react-native-google-signin/google-signin", { iosUrlScheme }]
      : "@react-native-google-signin/google-signin",
  ];

  return {
    ...config,
    name: "RentZilla",
    slug: "rentzilla",
    version: "24",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "rentzilla",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    runtimeVersion: { policy: "sdkVersion" },
    updates: {
      url: "https://u.expo.dev/975587e1-7c61-42ae-8995-b1c34641c478",
      enabled: true,
      fallbackToCacheTimeout: 0,
    },
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#FF7A18",
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: "com.rentzilla.app",
      buildNumber: "20",
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription:
          "RentZilla needs camera access to take your profile photo.",
        NSPhotoLibraryUsageDescription:
          "RentZilla needs photo library access to set your profile picture.",
        NSPhotoLibraryAddUsageDescription:
          "RentZilla needs access to save photos to your library.",
        NSLocationWhenInUseUsageDescription:
          "RentZilla uses your location to auto-fill your service address and show nearby listings.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "RentZilla uses your location to show nearby listings.",
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: "com.rentzillaapp.app",
      versionCode: 26,
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#FF7A18",
      },
      permissions: [
        "android.permission.INTERNET",
        "android.permission.CAMERA",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
      ],
      blockedPermissions: [
        // READ_MEDIA_IMAGES is blocked so Android 13+ uses the system Photo
        // Picker automatically — no broad storage permission required.
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.READ_MEDIA_VIDEO",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_EXTERNAL_STORAGE",
        "android.permission.WRITE_EXTERNAL_STORAGE",
      ],
    },
    web: { favicon: "./assets/images/icon.png" },
    plugins,
    experiments: { typedRoutes: true },
    extra: { eas: { projectId: "975587e1-7c61-42ae-8995-b1c34641c478" } },
  };
};
