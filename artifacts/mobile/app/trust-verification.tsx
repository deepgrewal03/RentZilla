import Button3D from "@/components/Button3D";
import { Ionicons } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { useAuth } from "@/context/AuthContext";

// ─── Theme ───────────────────────────────────────────────────────────────────
const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const BG = "#F5F6FA";
const CARD = "#FFFFFF";
const TEXT = "#2C2C2C";
const MUTED = "#8A8A9A";
const GREEN = "#059669";
const RED = "#EF4444";
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";

import { API_BASE_URL } from "@/constants/apiUrl";
const BASE_URL = API_BASE_URL;

// ─── Types ────────────────────────────────────────────────────────────────────
type VerifStatus = "none" | "pending" | "approved" | "rejected";

interface VerifItem {
  key: string;
  label: string;
  description: string;
  status: VerifStatus;
  doc_id?: string;
  required?: boolean;
  points?: number;
}

interface VerifData {
  trust_score: number;
  verification_level: string;
  admin_note: string | null;
  items: VerifItem[];
}

interface UploadPreview {
  docKey: string;
  docLabel: string;
  uri: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
  fileName: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusColor(s: VerifStatus) {
  if (s === "approved") return GREEN;
  if (s === "pending") return AMBER;
  if (s === "rejected") return RED;
  return MUTED;
}
function statusIcon(s: VerifStatus) {
  if (s === "approved") return "checkmark-circle";
  if (s === "pending") return "time-outline";
  if (s === "rejected") return "close-circle";
  return "ellipse-outline";
}
function statusLabel(s: VerifStatus) {
  if (s === "approved") return "Verified";
  if (s === "pending") return "Under Review";
  if (s === "rejected") return "Rejected – Tap to Resubmit";
  return "Not Submitted";
}
function levelLabel(level: string) {
  if (level === "trusted") return "Trusted Member";
  if (level === "verified") return "Verified";
  if (level === "basic") return "Basic Verified";
  return "Unverified";
}
function levelColor(level: string) {
  if (level === "trusted") return "#7C3AED";
  if (level === "verified") return GREEN;
  if (level === "basic") return BLUE;
  return MUTED;
}
function levelIcon(level: string) {
  if (level === "trusted") return "ribbon";
  if (level === "verified") return "shield-checkmark";
  if (level === "basic") return "shield-half";
  return "shield-outline";
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ─── Trust Score Ring ─────────────────────────────────────────────────────────
function TrustRing({ score, level }: { score: number; level: string }) {
  const SIZE = 160;
  const STROKE = 14;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 1400,
      useNativeDriver: false,
    }).start();
    const id = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    return () => anim.removeListener(id);
  }, [score]);

  const dash = (score / 100) * circ;
  const color = levelColor(level);

  return (
    <View style={s.ringWrap}>
      <Svg width={SIZE} height={SIZE}>
        <Defs>
          <SvgGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor={ORANGE} />
            <Stop offset="100%" stopColor={ORANGE2} />
          </SvgGradient>
        </Defs>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={r} stroke="#E8EAF0" strokeWidth={STROKE} fill="none" />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke="url(#g)" strokeWidth={STROKE} fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          rotation="-90" origin={`${SIZE / 2},${SIZE / 2}`}
        />
      </Svg>
      <View style={s.ringCenter}>
        <Text style={s.ringScore}>{display}</Text>
        <Text style={s.ringMax}>/100</Text>
      </View>
      <View style={[s.levelBadge, { backgroundColor: color + "20", borderColor: color }]}>
        <Ionicons name={levelIcon(level) as any} size={13} color={color} />
        <Text style={[s.levelText, { color }]}>{levelLabel(level)}</Text>
      </View>
    </View>
  );
}

// ─── Preview + Confirm Upload Modal ──────────────────────────────────────────
function UploadPreviewModal({
  preview,
  uploading,
  onConfirm,
  onCancel,
}: {
  preview: UploadPreview;
  uploading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const saved = preview.originalSize - preview.compressedSize;
  const pct = Math.round((saved / preview.originalSize) * 100);

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onCancel}>
      <View style={s.modalOverlay}>
        <View style={s.previewModal}>
          <View style={s.previewHeader}>
            <Text style={s.previewTitle}>Review Your Document</Text>
            <Pressable onPress={onCancel} disabled={uploading}>
              <Ionicons name="close-circle" size={26} color={MUTED} />
            </Pressable>
          </View>

          {/* Document preview */}
          <View style={s.previewImgWrap}>
            <Image
              source={{ uri: preview.uri }}
              style={s.previewImg}
              resizeMode="contain"
            />
            <View style={s.previewOverlayBadge}>
              <Ionicons name="image-outline" size={12} color="#fff" />
              <Text style={s.previewOverlayText}>{preview.docLabel}</Text>
            </View>
          </View>

          {/* Compression stats */}
          <View style={s.compressionBox}>
            <View style={s.compressionRow}>
              <Ionicons name="checkmark-circle" size={16} color={GREEN} />
              <Text style={s.compressionText}>
                Image compressed: {formatBytes(preview.originalSize)} → {formatBytes(preview.compressedSize)}
                {saved > 0 ? ` (saved ${pct}%)` : ""}
              </Text>
            </View>
            <View style={s.compressionRow}>
              <Ionicons name="lock-closed-outline" size={16} color={BLUE} />
              <Text style={s.compressionText}>Encrypted & sent securely over HTTPS</Text>
            </View>
            <View style={s.compressionRow}>
              <Ionicons name="eye-off-outline" size={16} color={MUTED} />
              <Text style={s.compressionText}>Only admin reviewers can view this document</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={s.previewActions}>
            <Button3D faceStyle={s.cancelBtn} onPress={onCancel} disabled={uploading}>
              <Text style={s.cancelBtnText}>Choose Again</Text>
            </Button3D>
            <Button3D faceStyle={[s.confirmBtn, uploading && s.btnDisabled]} onPress={onConfirm} disabled={uploading}>
              {uploading ? (
                <View style={s.uploadingRow}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.confirmBtnText}>Uploading…</Text>
                </View>
              ) : (
                <View style={s.uploadingRow}>
                  <Ionicons name="cloud-upload-outline" size={17} color="#fff" />
                  <Text style={s.confirmBtnText}>Submit for Verification</Text>
                </View>
              )}
            </Button3D>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Verification Item Card ───────────────────────────────────────────────────
function VerifCard({
  item,
  onUpload,
  isUploading,
}: {
  item: VerifItem;
  onUpload: (key: string) => void;
  isUploading: boolean;
}) {
  const canAct = item.key !== "phone" && item.key !== "email";
  const isRejected = item.status === "rejected";

  return (
    <View style={s.verifCard}>
      <View style={s.verifLeft}>
        <View style={[s.verifIconBox, { backgroundColor: statusColor(item.status) + "18" }]}>
          <Ionicons name={statusIcon(item.status) as any} size={22} color={statusColor(item.status)} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.verifTitleRow}>
            <Text style={s.verifLabel}>{item.label}</Text>
            {item.required && (
              <View style={s.reqBadge}>
                <Text style={s.reqText}>Required</Text>
              </View>
            )}
          </View>
          <Text style={s.verifDesc}>{item.description}</Text>
          <View style={s.verifStatusRow}>
            <View style={[s.statusChip, { backgroundColor: statusColor(item.status) + "18" }]}>
              <Text style={[s.statusChipText, { color: statusColor(item.status) }]}>
                {statusLabel(item.status)}
              </Text>
            </View>
            {item.points && item.status !== "approved" && (
              <Text style={s.pts}>+{item.points} pts</Text>
            )}
          </View>
          {isRejected && (
            <View style={s.rejectNote}>
              <Ionicons name="alert-circle-outline" size={13} color={RED} />
              <Text style={s.rejectNoteText}>Please resubmit a clearer document</Text>
            </View>
          )}
        </View>
      </View>

      {canAct && item.status !== "approved" && item.status !== "pending" && (
        <Button3D
          faceStyle={[s.uploadBtn, isUploading && s.btnDisabled]}
          onPress={() => onUpload(item.key)}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name={isRejected ? "refresh-outline" : "cloud-upload-outline"}
                size={15}
                color="#fff"
              />
              <Text style={s.uploadBtnText}>{isRejected ? "Resubmit" : "Upload"}</Text>
            </>
          )}
        </Button3D>
      )}

      {item.status === "pending" && canAct && (
        <View style={s.pendingChip}>
          <ActivityIndicator size="small" color={AMBER} />
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function TrustVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { token } = useAuth();

  const [data, setData] = useState<VerifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);

  // ── Fetch verification status ────────────────────────────────────────────
  const fetchStatus = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/verification/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setData(await res.json());
    } catch { }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  // ── Request permissions ──────────────────────────────────────────────────
  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera Permission Required",
        "RentZilla needs camera access to take a photo of your document. Please allow access in your device Settings.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  // ── Compress image ───────────────────────────────────────────────────────
  const compressImage = async (uri: string): Promise<{ uri: string; size: number }> => {
    try {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1200 } }],
        {
          compress: 0.75,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      // Estimate file size from the compressed URI
      const response = await fetch(result.uri);
      const blob = await response.blob();
      return { uri: result.uri, size: blob.size };
    } catch {
      // Fallback: return original if compression fails
      const response = await fetch(uri);
      const blob = await response.blob();
      return { uri, size: blob.size };
    }
  };

  // ── Pick from gallery ────────────────────────────────────────────────────
  const pickFromGallery = async (docKey: string, docLabel: string) => {
    // On Android 13+ the system Photo Picker opens automatically when
    // READ_MEDIA_IMAGES is absent from the manifest — no permission prompt needed.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    await processPickedImage(result.assets[0], docKey, docLabel);
  };

  // ── Take with camera ─────────────────────────────────────────────────────
  const pickFromCamera = async (docKey: string, docLabel: string) => {
    if (!(await requestCameraPermission())) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 1,
    });
    if (result.canceled || !result.assets?.length) return;
    await processPickedImage(result.assets[0], docKey, docLabel);
  };

  // ── Process & compress image then show preview ───────────────────────────
  const processPickedImage = async (
    asset: ImagePicker.ImagePickerAsset,
    docKey: string,
    docLabel: string
  ) => {
    setCompressing(true);
    setActiveKey(docKey);
    try {
      const originalSize = asset.fileSize ?? 0;
      const { uri: compressedUri, size: compressedSize } = await compressImage(asset.uri);

      const fileName =
        compressedUri.split("/").pop() ??
        `${docKey}_${Date.now()}.jpg`;

      setPreview({
        docKey,
        docLabel,
        uri: compressedUri,
        originalSize,
        compressedSize,
        mimeType: "image/jpeg",
        fileName,
      });
    } catch {
      Alert.alert("Processing Error", "Could not process the image. Please try again.");
    } finally {
      setCompressing(false);
    }
  };

  // ── Show source picker ───────────────────────────────────────────────────
  const handleUpload = useCallback((key: string) => {
    const labels: Record<string, string> = {
      gov_id: "Government ID",
      selfie: "Live Selfie",
      address: "Address Proof",
    };
    const docLabel = labels[key] ?? key;

    if (key === "selfie") {
      // For selfie, prefer camera
      Alert.alert(
        "Upload Live Selfie",
        "Please take a clear photo of your face for identity verification.",
        [
          {
            text: "Take Selfie (Camera)",
            onPress: () => pickFromCamera(key, docLabel),
          },
          {
            text: "Choose from Gallery",
            onPress: () => pickFromGallery(key, docLabel),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    } else {
      Alert.alert(
        `Upload ${docLabel}`,
        "Choose how you want to upload your document",
        [
          {
            text: "📷  Take Photo",
            onPress: () => pickFromCamera(key, docLabel),
          },
          {
            text: "🖼  Choose from Gallery",
            onPress: () => pickFromGallery(key, docLabel),
          },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  }, []);

  // ── Upload to server ─────────────────────────────────────────────────────
  const handleConfirmUpload = async () => {
    if (!preview) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: preview.uri,
        name: preview.fileName,
        type: preview.mimeType,
      } as any);

      const res = await fetch(
        `${BASE_URL}/api/verification/upload/${preview.docKey}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setPreview(null);
        setActiveKey(null);
        Alert.alert(
          "Submitted for Review ✅",
          `Your ${preview.docLabel} has been uploaded successfully and is now under review. We'll send you a notification once it's approved — usually within 24 hours.`,
          [{ text: "OK", onPress: () => fetchStatus(true) }]
        );
      } else {
        Alert.alert("Upload Failed", json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      Alert.alert("Upload Failed", "Please check your internet connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleCancelPreview = () => {
    if (!uploading) {
      setPreview(null);
      setActiveKey(null);
    }
  };

  const onRefresh = () => { setRefreshing(true); fetchStatus(true); };

  const benefits = [
    { icon: "shield-checkmark-outline", text: "Book high-value rentals with ease" },
    { icon: "star-outline", text: "Verified badge displayed on your profile" },
    { icon: "trending-up-outline", text: "Priority in search results" },
    { icon: "lock-open-outline", text: "Unlock wallet withdrawals" },
    { icon: "people-outline", text: "Greater trust from providers & customers" },
  ];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* ── Header ── */}
      <LinearGradient colors={[ORANGE, ORANGE2]} style={s.header}>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </Pressable>
        <Text style={s.headerTitle}>Trust & Verification</Text>
        <View style={{ width: 38 }} />
      </LinearGradient>

      {/* ── Compressing overlay ── */}
      {compressing && (
        <View style={s.compressingOverlay}>
          <View style={s.compressingCard}>
            <ActivityIndicator color={ORANGE} size="large" />
            <Text style={s.compressingTitle}>Compressing Image…</Text>
            <Text style={s.compressingDesc}>
              Optimizing your document for secure upload
            </Text>
          </View>
        </View>
      )}

      {/* ── Preview + Confirm Modal ── */}
      {preview && !compressing && (
        <UploadPreviewModal
          preview={preview}
          uploading={uploading}
          onConfirm={handleConfirmUpload}
          onCancel={handleCancelPreview}
        />
      )}

      {loading ? (
        <View style={s.loadingWrap}>
          <ActivityIndicator size="large" color={ORANGE} />
          <Text style={s.loadingText}>Loading your verification status…</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── Trust Score Card ── */}
          <View style={s.scoreCard}>
            <TrustRing score={data?.trust_score ?? 0} level={data?.verification_level ?? "unverified"} />
            <Text style={s.scoreTitle}>Your Trust Score</Text>
            <Text style={s.scoreSubtitle}>
              Upload your documents to increase your score and unlock all platform features.
            </Text>
          </View>

          {/* ── Admin / Rejection Note ── */}
          {data?.admin_note ? (
            <View style={s.adminNote}>
              <Ionicons name="information-circle" size={20} color={AMBER} />
              <Text style={s.adminNoteText}>{data.admin_note}</Text>
            </View>
          ) : null}

          {/* ── Verification Checklist ── */}
          <Text style={s.sectionTitle}>Verification Checklist</Text>
          <View style={s.checklistCard}>
            {(data?.items ?? []).map((item, idx) => (
              <View key={item.key}>
                {idx > 0 && <View style={s.divider} />}
                <VerifCard
                  item={item}
                  onUpload={handleUpload}
                  isUploading={activeKey === item.key && (compressing || uploading)}
                />
              </View>
            ))}
          </View>

          {/* ── How it works ── */}
          <Text style={s.sectionTitle}>How It Works</Text>
          <View style={s.howCard}>
            {[
              { n: "1", t: "Tap Upload on any document — choose camera or gallery" },
              { n: "2", t: "Your image is compressed & encrypted before sending" },
              { n: "3", t: "Preview and confirm before it's submitted for review" },
              { n: "4", t: "Admin reviews within 24 hrs — you'll get a notification" },
            ].map((it) => (
              <View key={it.n} style={s.howRow}>
                <View style={s.stepNum}>
                  <Text style={s.stepNumText}>{it.n}</Text>
                </View>
                <Text style={s.howText}>{it.t}</Text>
              </View>
            ))}
          </View>

          {/* ── Supported formats ── */}
          <View style={s.formatsCard}>
            <View style={s.formatsHeader}>
              <Ionicons name="document-outline" size={17} color={ORANGE} />
              <Text style={s.formatsTitle}>Accepted Documents</Text>
            </View>
            <View style={s.formatsList}>
              {[
                { icon: "card-outline", label: "Government ID", sub: "Aadhaar, PAN Card, Driving Licence, Voter ID" },
                { icon: "camera-outline", label: "Selfie", sub: "Clear face photo, no sunglasses or hat" },
                { icon: "home-outline", label: "Address Proof", sub: "Aadhaar, Utility bill, Bank statement (last 3 months)" },
              ].map((f) => (
                <View key={f.label} style={s.formatRow}>
                  <Ionicons name={f.icon as any} size={18} color={BLUE} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.formatLabel}>{f.label}</Text>
                    <Text style={s.formatSub}>{f.sub}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* ── Why verify? ── */}
          <Text style={s.sectionTitle}>Why Get Verified?</Text>
          <View style={s.benefitsCard}>
            {benefits.map((b) => (
              <View key={b.text} style={s.benefitRow}>
                <View style={s.benefitIcon}>
                  <Ionicons name={b.icon as any} size={18} color={ORANGE} />
                </View>
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          {/* ── Security notice ── */}
          <View style={s.securityNotice}>
            <Ionicons name="lock-closed-outline" size={15} color={MUTED} />
            <Text style={s.securityText}>
              All documents are AES-256 encrypted during transmission and stored on secure servers. RentZilla never shares your personal data with third parties.
            </Text>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.22)",
    justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },

  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: MUTED, fontSize: 14 },

  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 20 },

  // Score card
  scoreCard: {
    backgroundColor: CARD,
    borderRadius: 20, padding: 24,
    alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.07, shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, elevation: 3,
    marginBottom: 16,
  },
  scoreTitle: { fontSize: 17, fontWeight: "700", color: TEXT, marginTop: 12 },
  scoreSubtitle: { fontSize: 13, color: MUTED, textAlign: "center", marginTop: 6, lineHeight: 19 },

  // Ring
  ringWrap: { alignItems: "center" },
  ringCenter: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 28,
    justifyContent: "center", alignItems: "center",
  },
  ringScore: { fontSize: 38, fontWeight: "800", color: TEXT },
  ringMax: { fontSize: 13, color: MUTED, marginTop: -4 },
  levelBadge: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5, marginTop: 8,
  },
  levelText: { fontSize: 12, fontWeight: "700" },

  // Admin note
  adminNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    backgroundColor: AMBER + "18",
    borderRadius: 12, padding: 14, marginBottom: 16,
    borderLeftWidth: 3, borderLeftColor: AMBER,
  },
  adminNoteText: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 19 },

  sectionTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 10, marginTop: 4 },

  // Checklist
  checklistCard: {
    backgroundColor: CARD, borderRadius: 16, overflow: "hidden",
    shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
    marginBottom: 20,
  },
  divider: { height: 1, backgroundColor: "#F0F0F5", marginLeft: 16 },
  verifCard: {
    flexDirection: "row", alignItems: "center",
    padding: 14, gap: 10,
  },
  verifLeft: { flex: 1, flexDirection: "row", gap: 12, alignItems: "flex-start" },
  verifIconBox: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center",
  },
  verifTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  verifLabel: { fontSize: 14, fontWeight: "700", color: TEXT },
  reqBadge: { backgroundColor: RED + "15", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  reqText: { fontSize: 10, color: RED, fontWeight: "600" },
  verifDesc: { fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 16 },
  verifStatusRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  statusChip: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusChipText: { fontSize: 11, fontWeight: "700" },
  pts: { fontSize: 11, color: ORANGE, fontWeight: "600" },
  rejectNote: {
    flexDirection: "row", alignItems: "center", gap: 4,
    marginTop: 5,
  },
  rejectNoteText: { fontSize: 11, color: RED, fontWeight: "500" },
  uploadBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: ORANGE, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9, minWidth: 90, justifyContent: "center",
  },
  uploadBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  btnDisabled: { opacity: 0.55 },
  pendingChip: {
    width: 34, height: 34,
    justifyContent: "center", alignItems: "center",
  },

  // Compressing overlay
  compressingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
    zIndex: 100,
  },
  compressingCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 28,
    alignItems: "center", gap: 12, width: "75%",
  },
  compressingTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  compressingDesc: { fontSize: 13, color: MUTED, textAlign: "center" },

  // Preview modal
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  previewModal: {
    backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
  },
  previewHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginBottom: 16,
  },
  previewTitle: { fontSize: 17, fontWeight: "700", color: TEXT },
  previewImgWrap: {
    borderRadius: 14, overflow: "hidden",
    backgroundColor: "#F0F0F5", marginBottom: 16,
    position: "relative",
  },
  previewImg: { width: "100%", height: 220 },
  previewOverlayBadge: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
  },
  previewOverlayText: { fontSize: 12, color: "#fff", fontWeight: "600" },
  compressionBox: {
    backgroundColor: "#F5F6FA", borderRadius: 12, padding: 14,
    gap: 9, marginBottom: 18,
  },
  compressionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  compressionText: { flex: 1, fontSize: 12.5, color: TEXT, lineHeight: 18 },
  previewActions: { flexDirection: "row", gap: 12 },
  cancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: "#E0E0E8",
    borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: MUTED },
  confirmBtn: {
    flex: 2, backgroundColor: ORANGE,
    borderRadius: 12, paddingVertical: 13, alignItems: "center",
  },
  confirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  uploadingRow: { flexDirection: "row", alignItems: "center", gap: 7 },

  // How it works
  howCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16,
    gap: 14, marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: ORANGE + "20", justifyContent: "center", alignItems: "center",
  },
  stepNumText: { fontSize: 13, fontWeight: "800", color: ORANGE },
  howText: { flex: 1, fontSize: 13, color: TEXT, lineHeight: 19 },

  // Formats card
  formatsCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16,
    marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  formatsHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  formatsTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  formatsList: { gap: 12 },
  formatRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  formatLabel: { fontSize: 13, fontWeight: "600", color: TEXT },
  formatSub: { fontSize: 12, color: MUTED, lineHeight: 17 },

  // Benefits
  benefitsCard: {
    backgroundColor: CARD, borderRadius: 16, padding: 16,
    gap: 12, marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 8, elevation: 2,
  },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  benefitIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: ORANGE + "15", justifyContent: "center", alignItems: "center",
  },
  benefitText: { flex: 1, fontSize: 13, color: TEXT, fontWeight: "500" },

  // Security
  securityNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 14, backgroundColor: "#F0F0F8", borderRadius: 12, marginBottom: 8,
  },
  securityText: { flex: 1, fontSize: 12, color: MUTED, lineHeight: 18 },
});
