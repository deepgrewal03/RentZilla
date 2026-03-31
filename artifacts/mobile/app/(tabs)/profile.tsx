import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StarRating } from "@/components/StarRating";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";
import { useApi } from "@/hooks/useApi";

const C = Colors.light;
const ORANGE = "#FF7A18";

interface MenuItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  color?: string;
  rightIcon?: string;
}

function MenuItem({ icon, label, value, onPress, color = C.text, rightIcon = "chevron-forward" }: MenuItemProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.menuIcon, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      </View>
      <Text style={[styles.menuLabel, { color }]} numberOfLines={1}>{label}</Text>
      {value ? <Text style={styles.menuValue} numberOfLines={1}>{value}</Text> : null}
      {onPress ? <Ionicons name={rightIcon as keyof typeof Ionicons.glyphMap} size={18} color={C.textTertiary} /> : null}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuth();
  const { put } = useApi();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [editMode, setEditMode]   = useState(false);
  const [name, setName]           = useState(user?.name || "");
  const [saving, setSaving]       = useState(false);

  const [photoLoading, setPhotoLoading] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const uploadingRef = useRef(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [manualLocation, setManualLocation]       = useState(user?.location || "");
  const [gpsLoading, setGpsLoading]               = useState(false);
  const [locationSaving, setLocationSaving]       = useState(false);

  const avatarScale = useRef(new Animated.Value(1)).current;

  const topPad = isWeb ? 67 : insets.top;

  function pulseAvatar() {
    Animated.sequence([
      Animated.spring(avatarScale, { toValue: 0.93, useNativeDriver: false, tension: 300, friction: 10 }),
      Animated.spring(avatarScale, { toValue: 1,    useNativeDriver: false, tension: 300, friction: 12 }),
    ]).start();
  }

  async function saveProfile() {
    setSaving(true);
    try {
      const updated = await put<{ id: string; name: string | null; location: string | null }>("/users/me", {
        name,
        location: user?.location,
        profileImage: user?.profileImage,
      });
      updateUser({ name: updated.name, location: updated.location });
      setEditMode(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  }

  // ── Compress an image URI to JPEG ≤200KB ─────────────────────────────────
  async function compressImage(uri: string): Promise<string> {
    try {
      // Try the new builder-style API (expo-image-manipulator v13+/SDK 51+)
      if ((ImageManipulator as any).manipulate) {
        const ctx = (ImageManipulator as any).manipulate(uri);
        ctx.resize({ width: 800 });
        const img = await ctx.renderAsync();
        const result = await img.saveAsync({
          compress: 0.72,
          format: (ImageManipulator as any).SaveFormat?.JPEG ?? "jpeg",
          base64: true,
        });
        if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
        return result.uri;
      }
      // Fall back to the old API (manipulateAsync)
      const result = await (ImageManipulator as any).manipulateAsync(
        uri,
        [{ resize: { width: 800 } }],
        { compress: 0.72, format: "jpeg", base64: true }
      );
      if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
      return result.uri;
    } catch {
      // If manipulator fails, fall back to raw URI
      return uri;
    }
  }

  // ── Shared upload function (after picker/camera) ──────────────────────────
  async function uploadPhoto(asset: ImagePicker.ImagePickerAsset) {
    if (uploadingRef.current) return;
    uploadingRef.current = true;

    // 1) Show preview instantly (raw URI so user sees it immediately)
    setPreviewUri(asset.uri);
    setShowPhotoMenu(false);
    setPhotoLoading(true);
    pulseAvatar();

    try {
      let profileImage: string;

      if (Platform.OS === "web") {
        // Web: blob URL — convert to base64 data URI
        if (asset.uri && asset.uri.startsWith("blob:")) {
          const response = await fetch(asset.uri);
          const blob = await response.blob();
          profileImage = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } else {
          profileImage = asset.uri;
        }
      } else {
        // Native: compress with ImageManipulator
        profileImage = await compressImage(asset.uri);
      }

      const updated = await put<{ profileImage: string | null }>("/users/me", {
        name: user?.name,
        location: user?.location,
        profileImage,
      });

      // Update global user state with the server-confirmed URL
      updateUser({ profileImage: updated.profileImage });
      setPreviewUri(null); // clear preview — show the confirmed image
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setPreviewUri(null); // revert to old image on error
      Alert.alert("Upload failed", "Could not save your photo. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setPhotoLoading(false);
      uploadingRef.current = false;
    }
  }

  async function pickPhotoFromGallery() {
    setShowPhotoMenu(false);
    // Small delay so modal closes before permission dialog appears
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission Required",
            "Please allow photo library access in your device Settings → RentZilla → Photos.",
            [{ text: "OK" }]
          );
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85, // kept high here — we compress in uploadPhoto
        });
        if (!result.canceled && result.assets[0]) {
          await uploadPhoto(result.assets[0]);
        }
      } catch {
        Alert.alert("Error", "Could not open photo library. Please try again.");
      }
    }, 200);
  }

  async function takePhoto() {
    setShowPhotoMenu(false);
    setTimeout(async () => {
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(
            "Permission Required",
            "Please allow camera access in your device Settings → RentZilla → Camera.",
            [{ text: "OK" }]
          );
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.85,
        });
        if (!result.canceled && result.assets[0]) {
          await uploadPhoto(result.assets[0]);
        }
      } catch {
        Alert.alert("Error", "Could not open camera. Please try again.");
      }
    }, 200);
  }

  async function removePhoto() {
    setShowPhotoMenu(false);
    setPhotoLoading(true);
    setPreviewUri(null);
    try {
      await put("/users/me", { name: user?.name, location: user?.location, profileImage: null });
      updateUser({ profileImage: null });
      Haptics.selectionAsync();
    } catch {
      Alert.alert("Error", "Could not remove photo.");
    } finally {
      setPhotoLoading(false);
    }
  }

  async function useGpsLocation() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission denied", "Enable location access in your device settings.");
        setGpsLoading(false);
        return;
      }
      const coords = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({
        latitude: coords.coords.latitude,
        longitude: coords.coords.longitude,
      });
      if (geocode.length > 0) {
        const g = geocode[0];
        const parts = [g.street, g.district, g.city, g.region].filter(Boolean);
        const addr = parts.length > 0 ? parts.join(", ") : (g.formattedAddress || "");
        setManualLocation(addr);
      }
    } catch {
      Alert.alert("Location error", "Could not fetch your location. Please enter it manually.");
    } finally {
      setGpsLoading(false);
    }
  }

  async function saveLocation() {
    if (!manualLocation.trim()) return;
    setLocationSaving(true);
    try {
      const updated = await put<{ location: string | null }>("/users/me", {
        name: user?.name,
        location: manualLocation.trim(),
        profileImage: user?.profileImage,
      });
      updateUser({ location: updated.location });
      setShowLocationModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Error", "Could not save location.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLocationSaving(false);
    }
  }

  async function handleLogout() {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/sign-in");
        },
      },
    ]);
  }

  if (!user) return null;

  const displayName = user.name || user.email || user.phone || "?";

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["#FF7A18", "#FF9F43"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: topPad + 14 }]}
      >
        <Text style={styles.headerTitle}>Profile</Text>
        <Pressable onPress={() => { Haptics.selectionAsync(); setEditMode(!editMode); }}>
          <Text style={styles.editText}>{editMode ? "Cancel" : "Edit"}</Text>
        </Pressable>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false}>

        {/* ─── Avatar & Info ─── */}
        <View style={styles.profileCard}>

          {/* Avatar */}
          <Pressable
            onPress={() => { if (!photoLoading) { Haptics.selectionAsync(); setShowPhotoMenu(true); } }}
            style={styles.avatarWrap}
            disabled={photoLoading}
          >
            <Animated.View style={[styles.avatarCircle, { transform: [{ scale: avatarScale }] }]}>
              {/* Show preview instantly, then confirmed image, then fallback */}
              {previewUri || user.profileImage ? (
                <Image
                  source={{ uri: (previewUri ?? user.profileImage) as string }}
                  style={styles.avatarImage}
                  contentFit="cover"
                  transition={250}
                  cachePolicy="memory"
                />
              ) : (
                <Text style={styles.avatarLetter}>{displayName[0]?.toUpperCase() || "?"}</Text>
              )}
              {/* Upload loading overlay */}
              {photoLoading && (
                <View style={styles.avatarLoadingOverlay}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={styles.avatarLoadingText}>Uploading...</Text>
                </View>
              )}
            </Animated.View>
            {!photoLoading && (
              <View style={styles.editPhotoTag}>
                <Ionicons name="camera" size={11} color="#fff" />
                <Text style={styles.editPhotoText}>Edit</Text>
              </View>
            )}
          </Pressable>

          {editMode ? (
            <View style={styles.editFields}>
              <TextInput
                style={styles.editInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={C.textTertiary}
              />
              <Pressable onPress={saveProfile} disabled={saving} style={styles.saveBtn}>
                <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Changes"}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.userName}>{user.name || "Set your name"}</Text>
              <Text style={styles.userPhone}>{user.email || user.phone}</Text>
              {user.location ? (
                <Pressable onPress={() => { setManualLocation(user.location || ""); setShowLocationModal(true); }} style={styles.locationRow}>
                  <Ionicons name="location" size={14} color={ORANGE} />
                  <Text style={styles.locationText}>{user.location}</Text>
                  <Ionicons name="pencil" size={11} color={C.textTertiary} />
                </Pressable>
              ) : (
                <Pressable onPress={() => { setManualLocation(""); setShowLocationModal(true); }} style={styles.addLocationBtn}>
                  <Ionicons name="location-outline" size={14} color={ORANGE} />
                  <Text style={styles.addLocationText}>Add your location</Text>
                </Pressable>
              )}
              <View style={styles.roleBadge}>
                <Ionicons name={user.role === "provider" ? "storefront-outline" : "search-outline"} size={13} color={C.tint} />
                <Text style={styles.roleText}>{user.role === "provider" ? "Provider" : "Customer"}</Text>
              </View>
              {user.rating != null && (
                <View style={styles.ratingRow}>
                  <StarRating rating={Math.round(user.rating)} size={16} />
                  <Text style={styles.ratingText}>{user.rating.toFixed(1)} ({user.reviewCount} reviews)</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Activity */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>Activity</Text>
          <MenuItem icon="heart-outline" label="Favourites" color="#FF3B5C" onPress={() => router.push("/(tabs)/favorites")} />
          {user.role === "provider" && (
            <MenuItem icon="list-outline" label="My Listings" color="#22C55E" onPress={() => router.push("/(tabs)/dashboard")} />
          )}
        </View>

        {/* Account */}
        <View style={styles.menuCard}>
          <Text style={styles.menuSection}>Account</Text>
          <MenuItem
            icon="camera-outline"
            label="Profile Photo"
            value={user.profileImage ? "Set" : "Not set"}
            color="#8B5CF6"
            onPress={() => setShowPhotoMenu(true)}
          />
          <MenuItem
            icon="location-outline"
            label="Location"
            value={user.location || "Not set"}
            color="#0EA5E9"
            onPress={() => { setManualLocation(user.location || ""); setShowLocationModal(true); }}
          />
          <MenuItem
            icon="phone-portrait-outline"
            label="Phone Number"
            value={user.phone}
            color={C.textSecondary}
          />
          <MenuItem
            icon="log-out-outline"
            label="Logout"
            color={C.error}
            onPress={handleLogout}
          />
        </View>

        <View style={{ height: isWeb ? 34 : 100 }} />
      </ScrollView>

      {/* ─── Photo Menu Modal ─── */}
      <Modal
        visible={showPhotoMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoMenu(false)}
        statusBarTranslucent
      >
        <Pressable style={styles.overlay} onPress={() => setShowPhotoMenu(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Profile Photo</Text>
            <Text style={styles.sheetSubtitle}>Choose how to update your photo</Text>

            {!isWeb && (
              <Pressable onPress={takePhoto} style={styles.sheetBtn}>
                <View style={[styles.sheetBtnIcon, { backgroundColor: "#F0FDF4" }]}>
                  <Ionicons name="camera-outline" size={22} color="#22C55E" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetBtnLabel}>📷  Take a Photo</Text>
                  <Text style={styles.sheetBtnSub}>Use your device camera</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
              </Pressable>
            )}

            <Pressable onPress={pickPhotoFromGallery} style={styles.sheetBtn}>
              <View style={[styles.sheetBtnIcon, { backgroundColor: "#EEF2FF" }]}>
                <Ionicons name="images-outline" size={22} color="#6366F1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetBtnLabel}>🖼  Choose from Gallery</Text>
                <Text style={styles.sheetBtnSub}>Pick an existing photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={C.textTertiary} />
            </Pressable>

            {(user.profileImage || previewUri) && (
              <Pressable onPress={removePhoto} style={styles.sheetBtn}>
                <View style={[styles.sheetBtnIcon, { backgroundColor: "#FEF2F2" }]}>
                  <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sheetBtnLabel, { color: "#EF4444" }]}>Remove Photo</Text>
                  <Text style={styles.sheetBtnSub}>Revert to initials</Text>
                </View>
              </Pressable>
            )}

            <Pressable onPress={() => setShowPhotoMenu(false)} style={[styles.sheetBtn, styles.sheetCancelBtn]}>
              <Text style={styles.sheetCancelText}>❌  Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Location Modal ─── */}
      <Modal
        visible={showLocationModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationModal(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowLocationModal(false)}>
          <Pressable style={styles.locationSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Set Location</Text>
            <Text style={styles.sheetSubtitle}>Used for service availability & recommendations</Text>

            {/* GPS button */}
            {!isWeb && (
              <Pressable
                onPress={useGpsLocation}
                disabled={gpsLoading}
                style={({ pressed }) => [styles.gpsBtn, pressed && { opacity: 0.8 }]}
              >
                <LinearGradient
                  colors={["#0EA5E9", "#0284C7"]}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.gpsBtnGrad}
                >
                  {gpsLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="navigate" size={18} color="#fff" />
                  )}
                  <Text style={styles.gpsBtnText}>
                    {gpsLoading ? "Detecting location..." : "Use My Current Location"}
                  </Text>
                </LinearGradient>
              </Pressable>
            )}

            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or enter manually</Text>
              <View style={styles.orLine} />
            </View>

            <View style={styles.locationInputWrap}>
              <Ionicons name="location-outline" size={20} color={ORANGE} style={{ marginLeft: 12 }} />
              <TextInput
                style={styles.locationInput}
                value={manualLocation}
                onChangeText={setManualLocation}
                placeholder="e.g. Ludhiana, Punjab"
                placeholderTextColor={C.textTertiary}
                returnKeyType="done"
                onSubmitEditing={saveLocation}
              />
              {manualLocation.length > 0 && (
                <Pressable onPress={() => setManualLocation("")} hitSlop={8} style={{ marginRight: 12 }}>
                  <Ionicons name="close-circle" size={18} color={C.textTertiary} />
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={saveLocation}
              disabled={locationSaving || !manualLocation.trim()}
              style={[styles.saveLocationBtn, (!manualLocation.trim() || locationSaving) && { opacity: 0.5 }]}
            >
              <LinearGradient
                colors={["#FF7A18", "#FF9F43"]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={styles.saveLocationGrad}
              >
                {locationSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={18} color="#fff" />
                )}
                <Text style={styles.saveLocationText}>
                  {locationSaving ? "Saving..." : "Save Location"}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => setShowLocationModal(false)} style={styles.cancelLocationBtn}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  editText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Inter_500Medium",
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  profileCard: {
    margin: 20,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: C.cardBorder,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrap: { position: "relative", marginBottom: 4 },
  avatarCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${ORANGE}20`,
    borderWidth: 3,
    borderColor: `${ORANGE}40`,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 88, height: 88, borderRadius: 44 },
  avatarLetter: {
    fontSize: 34,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: ORANGE,
  },
  avatarLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 44,
    gap: 4,
  },
  avatarLoadingText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  editPhotoTag: {
    position: "absolute",
    bottom: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 2,
    borderColor: "#fff",
  },
  editPhotoText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
  },
  userPhone: {
    fontSize: 14,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${ORANGE}10`,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  locationText: {
    fontSize: 13,
    color: ORANGE,
    fontFamily: "Inter_500Medium",
  },
  addLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${ORANGE}10`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${ORANGE}30`,
    borderStyle: "dashed",
  },
  addLocationText: {
    fontSize: 13,
    color: ORANGE,
    fontFamily: "Inter_500Medium",
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: `${C.tint}15`,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "Inter_600SemiBold",
    color: C.tint,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  ratingText: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  editFields: { width: "100%", gap: 10, marginTop: 8 },
  editInput: {
    backgroundColor: C.backgroundTertiary,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  saveBtn: {
    backgroundColor: C.tint,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  menuCard: {
    marginHorizontal: 20,
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.cardBorder,
    overflow: "hidden",
    marginBottom: 14,
  },
  menuSection: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.textTertiary,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  menuValue: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", maxWidth: 120 },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 4,
  },
  locationSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 14,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: "700",
    fontFamily: "Inter_700Bold",
    color: C.text,
    textAlign: "center",
  },
  sheetSubtitle: {
    fontSize: 13,
    color: C.textSecondary,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginBottom: 8,
  },
  sheetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
  },
  sheetBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetBtnLabel: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  sheetBtnSub:   { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 1 },
  sheetCancelBtn: { justifyContent: "center", marginTop: 4 },
  sheetCancelText: {
    textAlign: "center",
    fontSize: 15,
    color: C.textSecondary,
    fontFamily: "Inter_500Medium",
  },
  gpsBtn: { borderRadius: 14, overflow: "hidden" },
  gpsBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  gpsBtnText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  orRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  orLine: { flex: 1, height: 1, backgroundColor: C.borderLight },
  orText:  { fontSize: 13, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  locationInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.backgroundTertiary,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.border,
  },
  locationInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: C.text,
  },
  saveLocationBtn: { borderRadius: 14, overflow: "hidden" },
  saveLocationGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  saveLocationText: { color: "#fff", fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  cancelLocationBtn: { alignItems: "center", paddingVertical: 8 },
});
