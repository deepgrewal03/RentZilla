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
        android: {
          compileSdkVersion: 35,
          targetSdkVersion: 35,
          buildToolsVersion: "35.0.0",
          // Required for 16 KB memory page size support on Android 15.
          // Packages .so libs compressed so Play Store's page-alignment
          // scanner passes even for third-party native libraries.
          packagingOptions: {
            jniLibs: { useLegacyPackaging: true },
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
      },
    ],
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
      package: "com.rentzilla.app",
      versionCode: 24,
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
