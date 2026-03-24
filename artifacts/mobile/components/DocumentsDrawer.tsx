import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

const C = Colors.light;
const ORANGE = "#E8742A";
const NAVY = "#0F1F3D";
const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

// ─── Service & Document Definitions ─────────────────────────────────────────

const SERVICES = [
  { id: "cars",          label: "Cars",          icon: "car-outline",             color: "#3B82F6" },
  { id: "tractors",      label: "Tractors",      icon: "car-sport-outline",       color: "#059669" },
  { id: "earth_movers",  label: "Earth Movers",  icon: "construct-outline",       color: "#92400E" },
  { id: "plumbers",      label: "Plumbers",      icon: "water-outline",           color: "#0891B2" },
  { id: "electricians",  label: "Electricians",  icon: "flash-outline",           color: "#D97706" },
  { id: "beauty_parlors",label: "Beauty Parlors",icon: "color-palette-outline",   color: "#9333EA" },
  { id: "mechanic",      label: "Mechanic",      icon: "settings-outline",        color: "#DC2626" },
];

const SERVICE_DOCS: Record<string, { name: string; isPhoto?: boolean }[]> = {
  cars: [
    { name: "Registration Certificate (RC)" },
    { name: "Pollution Certificate" },
    { name: "Insurance" },
    { name: "Driver's License" },
    { name: "Car Insurance" },
    { name: "Taxi Permit" },
    { name: "Driver Aadhaar / Voter ID" },
  ],
  tractors: [
    { name: "Registration Certificate (RC)" },
    { name: "Insurance" },
    { name: "Driver's License" },
    { name: "Aadhaar / Voter ID" },
  ],
  earth_movers: [
    { name: "Registration Certificate (RC)" },
    { name: "Insurance" },
    { name: "Driver's License" },
    { name: "Pollution Certificate" },
    { name: "Fitness Certificate" },
  ],
  plumbers: [
    { name: "Front Face Photo", isPhoto: true },
    { name: "Address Proof" },
    { name: "Aadhaar Card" },
  ],
  electricians: [
    { name: "Front Face Photo", isPhoto: true },
    { name: "Address Proof" },
    { name: "Aadhaar Card" },
  ],
  beauty_parlors: [
    { name: "Front Face Photo", isPhoto: true },
    { name: "Address Proof" },
    { name: "Aadhaar Card" },
    { name: "Shop Photo", isPhoto: true },
  ],
  mechanic: [
    { name: "Front Face Photo", isPhoto: true },
    { name: "Address Proof" },
    { name: "Aadhaar Card" },
  ],
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
    pending:  { bg: "#FFF3CD", fg: "#856404", icon: "time-outline",           label: "Pending" },
    approved: { bg: "#D1FAE5", fg: "#065F46", icon: "checkmark-circle-outline", label: "Approved" },
    rejected: { bg: "#FEE2E2", fg: "#991B1B", icon: "close-circle-outline",   label: "Rejected" },
  };
  const s = map[status] ?? map.pending;
  return (
    <View style={[ds.badge, { backgroundColor: s.bg }]}>
      <Ionicons name={s.icon as any} size={11} color={s.fg} />
      <Text style={[ds.badgeText, { color: s.fg }]}>{s.label}</Text>
    </View>
  );
}

function CompletionBar({ pct, total, uploaded }: { pct: number; total: number; uploaded: number }) {
  const color = pct === 100 ? "#059669" : pct >= 50 ? ORANGE : "#EF4444";
  return (
    <View style={ds.completionWrap}>
      <View style={ds.completionHeader}>
        <Text style={ds.completionLabel}>
          {uploaded}/{total} documents uploaded
        </Text>
        <Text style={[ds.completionPct, { color }]}>{pct}%</Text>
      </View>
      <View style={ds.completionTrack}>
        <View style={[ds.completionFill, { width: `${pct}%` as any, backgroundColor: color }]} />
      </View>
      {pct === 100 && (
        <View style={ds.completionNote}>
          <Ionicons name="checkmark-circle" size={13} color="#059669" />
          <Text style={ds.completionNoteText}>All documents uploaded. Awaiting review.</Text>
        </View>
      )}
    </View>
  );
}

type DocRecord = {
  id: string;
  document_type: string;
  service_type: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  status: string;
  admin_note: string | null;
};

function DocumentCard({
  docDef, record, onUpload, onDelete, uploading,
}: {
  docDef: { name: string; isPhoto?: boolean };
  record: DocRecord | null;
  onUpload: (docName: string, isPhoto?: boolean) => void;
  onDelete: (id: string) => void;
  uploading: boolean;
}) {
  const hasFile = !!record;
  const isImage = record?.mime_type?.startsWith("image/");

  return (
    <View style={ds.docCard}>
      <View style={ds.docLeft}>
        <View style={[ds.docIconWrap, { backgroundColor: hasFile ? `${ORANGE}15` : "#F3F4F6" }]}>
          <Ionicons
            name={
              docDef.isPhoto || isImage
                ? hasFile ? "image" : "image-outline"
                : hasFile ? "document" : "document-outline"
            }
            size={20}
            color={hasFile ? ORANGE : C.textTertiary}
          />
        </View>
        <View style={ds.docInfo}>
          <Text style={ds.docName}>{docDef.name}</Text>
          {record ? (
            <>
              <Text style={ds.docFileName} numberOfLines={1}>{record.file_name ?? "Uploaded"}</Text>
              {record.file_size ? (
                <Text style={ds.docFileSize}>{(record.file_size / 1024).toFixed(0)} KB</Text>
              ) : null}
              {record.admin_note && record.status === "rejected" && (
                <Text style={ds.adminNote}>Note: {record.admin_note}</Text>
              )}
            </>
          ) : (
            <Text style={ds.docRequired}>Required</Text>
          )}
        </View>
      </View>
      <View style={ds.docRight}>
        {record && <DocStatusBadge status={record.status} />}
        {uploading ? (
          <ActivityIndicator color={ORANGE} size="small" style={{ marginTop: 6 }} />
        ) : (
          <View style={ds.docActions}>
            <Pressable
              onPress={() => onUpload(docDef.name, docDef.isPhoto)}
              style={[ds.uploadBtn, hasFile && ds.replaceBtn]}
            >
              <Ionicons
                name={hasFile ? "refresh-outline" : "cloud-upload-outline"}
                size={13}
                color={hasFile ? C.textSecondary : "#fff"}
              />
              <Text style={[ds.uploadBtnText, hasFile && ds.replaceBtnText]}>
                {hasFile ? "Replace" : "Upload"}
              </Text>
            </Pressable>
            {record && (
              <Pressable onPress={() => onDelete(record.id)} style={ds.deleteBtn}>
                <Ionicons name="trash-outline" size={14} color="#EF4444" />
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Main Drawer ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DocumentsDrawer({ visible, onClose }: Props) {
  const { token } = useAuth();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [completion, setCompletion] = useState<{ pct: number; total: number; uploaded: number } | null>(null);

  useEffect(() => {
    if (visible && selectedService) {
      loadDocuments(selectedService);
    }
  }, [visible, selectedService]);

  const loadDocuments = useCallback(async (service: string) => {
    setLoadingDocs(true);
    try {
      const res = await fetch(`${BASE_URL}/api/documents?service_type=${service}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const docs: DocRecord[] = await res.json();
        setDocuments(docs);
        // Compute completion
        const required = SERVICE_DOCS[service] ?? [];
        const uploaded = docs.length;
        const pct = required.length > 0 ? Math.round((uploaded / required.length) * 100) : 0;
        setCompletion({ pct, total: required.length, uploaded });
      }
    } catch { }
    finally { setLoadingDocs(false); }
  }, [token]);

  function getDocRecord(docName: string) {
    return documents.find((d) => d.document_type === docName) ?? null;
  }

  async function handleUpload(docName: string, isPhoto?: boolean) {
    if (!selectedService) return;

    if (isWeb) {
      Alert.alert("Upload", "File upload is available in the mobile app. On web, a real device or emulator is needed.");
      return;
    }

    // Ask user: image or PDF (unless it's a photo-only field)
    let useCamera = false;
    let pickPdf = false;

    if (isPhoto) {
      // Photo-only — just pick from library or camera
      const choice = await new Promise<"camera" | "library" | "cancel">((resolve) => {
        Alert.alert("Upload Photo", `Upload "${docName}"`, [
          { text: "Take Photo",         onPress: () => resolve("camera") },
          { text: "Pick from Library",  onPress: () => resolve("library") },
          { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
        ]);
      });
      if (choice === "cancel") return;
      useCamera = choice === "camera";
    } else {
      const choice = await new Promise<"camera" | "library" | "pdf" | "cancel">((resolve) => {
        Alert.alert("Upload Document", `Upload "${docName}"`, [
          { text: "Take Photo",        onPress: () => resolve("camera") },
          { text: "Photo from Library", onPress: () => resolve("library") },
          { text: "Upload PDF",        onPress: () => resolve("pdf") },
          { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
        ]);
      });
      if (choice === "cancel") return;
      if (choice === "pdf") pickPdf = true;
      else useCamera = choice === "camera";
    }

    setUploading((prev) => ({ ...prev, [docName]: true }));
    try {
      let fileUri: string;
      let fileName: string;
      let mimeType: string;

      if (pickPdf) {
        const res = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (res.canceled || !res.assets?.[0]) { setUploading((p) => ({ ...p, [docName]: false })); return; }
        const asset = res.assets[0];
        fileUri = asset.uri;
        fileName = asset.name;
        mimeType = asset.mimeType ?? "application/pdf";
      } else {
        const perms = await (useCamera
          ? ImagePicker.requestCameraPermissionsAsync()
          : ImagePicker.requestMediaLibraryPermissionsAsync());
        if (!perms.granted) {
          Alert.alert("Permission Required", `Please allow ${useCamera ? "camera" : "photo library"} access in Settings`);
          setUploading((p) => ({ ...p, [docName]: false }));
          return;
        }
        const result = await (useCamera
          ? ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true })
          : ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, allowsEditing: true }));
        if (result.canceled || !result.assets?.[0]) { setUploading((p) => ({ ...p, [docName]: false })); return; }

        // Compress image using expo-image-manipulator
        const originalUri = result.assets[0].uri;
        let compressedUri = originalUri;
        try {
          const manipResult = await ImageManipulator.manipulateAsync(
            originalUri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          compressedUri = manipResult.uri;
        } catch { /* use original if compression fails */ }

        fileUri = compressedUri;
        fileName = `${docName.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}.jpg`;
        mimeType = "image/jpeg";
      }

      // Upload via FormData
      const formData = new FormData();
      formData.append("file", { uri: fileUri, name: fileName, type: mimeType } as any);
      formData.append("service_type", selectedService);
      formData.append("document_type", docName);

      const uploadRes = await fetch(`${BASE_URL}/api/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        Alert.alert("Upload Failed", err.error || "Could not upload document");
        return;
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await loadDocuments(selectedService);
    } catch (err: any) {
      Alert.alert("Error", err.message || "Upload failed");
    } finally {
      setUploading((prev) => ({ ...prev, [docName]: false }));
    }
  }

  async function handleDelete(docId: string) {
    if (!selectedService) return;
    Alert.alert("Remove Document", "Remove this uploaded document?", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        try {
          const res = await fetch(`${BASE_URL}/api/documents/${docId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadDocuments(selectedService);
          } else {
            Alert.alert("Error", "Could not remove document");
          }
        } catch { Alert.alert("Error", "Could not remove document"); }
      }},
    ]);
  }

  function handleClose() {
    setSelectedService(null);
    setDocuments([]);
    setCompletion(null);
    onClose();
  }

  const currentService = SERVICES.find((s) => s.id === selectedService);
  const requiredDocs = selectedService ? (SERVICE_DOCS[selectedService] ?? []) : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[ds.root, { paddingTop: isWeb ? 20 : 0 }]}>
        {/* Header */}
        <View style={[ds.header, { paddingTop: isWeb ? 16 : insets.top + 16 }]}>
          <Pressable onPress={handleClose} style={ds.closeBtn}>
            <Ionicons name="close" size={20} color={C.text} />
          </Pressable>
          <View style={ds.headerCenter}>
            <View style={ds.headerIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={18} color={ORANGE} />
            </View>
            <Text style={ds.headerTitle}>Verify Documents</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView style={ds.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

          {/* Info banner */}
          <View style={ds.infoBanner}>
            <Ionicons name="information-circle-outline" size={16} color="#1D4ED8" />
            <Text style={ds.infoBannerText}>
              Select your service and upload the required documents. Documents are reviewed within 24 hours.
            </Text>
          </View>

          {/* Service selector */}
          <Text style={ds.sectionLabel}>Select Service</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ds.serviceScroll}>
            {SERVICES.map((svc) => {
              const isSelected = selectedService === svc.id;
              return (
                <Pressable
                  key={svc.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelectedService(svc.id);
                    setDocuments([]);
                    setCompletion(null);
                  }}
                  style={[ds.serviceCard, isSelected && { borderColor: svc.color, backgroundColor: `${svc.color}10` }]}
                >
                  <View style={[ds.serviceIconWrap, { backgroundColor: isSelected ? `${svc.color}20` : "#F3F4F6" }]}>
                    <Ionicons name={svc.icon as any} size={22} color={isSelected ? svc.color : C.textTertiary} />
                  </View>
                  <Text style={[ds.serviceLabel, isSelected && { color: svc.color, fontWeight: "700" }]}>{svc.label}</Text>
                  {isSelected && (
                    <View style={[ds.serviceCheck, { backgroundColor: svc.color }]}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Document form */}
          {selectedService && (
            <>
              {/* Service header */}
              <View style={ds.serviceHeader}>
                <View style={[ds.serviceHeaderIconWrap, { backgroundColor: `${currentService?.color}15` }]}>
                  <Ionicons name={(currentService?.icon ?? "document-outline") as any} size={20} color={currentService?.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ds.serviceHeaderTitle}>{currentService?.label} Documents</Text>
                  <Text style={ds.serviceHeaderSub}>{requiredDocs.length} documents required</Text>
                </View>
              </View>

              {/* Completion bar */}
              {completion && !loadingDocs && (
                <CompletionBar pct={completion.pct} total={completion.total} uploaded={completion.uploaded} />
              )}

              {/* Document cards */}
              {loadingDocs ? (
                <ActivityIndicator color={ORANGE} style={{ marginTop: 24 }} />
              ) : (
                <View style={ds.docList}>
                  {requiredDocs.map((docDef) => (
                    <DocumentCard
                      key={docDef.name}
                      docDef={docDef}
                      record={getDocRecord(docDef.name)}
                      onUpload={handleUpload}
                      onDelete={handleDelete}
                      uploading={!!uploading[docDef.name]}
                    />
                  ))}
                </View>
              )}

              {/* Note about PDF/image */}
              <View style={ds.tipCard}>
                <Ionicons name="bulb-outline" size={14} color="#D97706" />
                <Text style={ds.tipText}>
                  Accepted formats: JPG, PNG, PDF · Max 10 MB per file{"\n"}
                  Images are auto-compressed before upload to save data.
                </Text>
              </View>
            </>
          )}

          {!selectedService && (
            <View style={ds.emptyState}>
              <Ionicons name="document-text-outline" size={56} color={C.border} />
              <Text style={ds.emptyTitle}>Choose a Service</Text>
              <Text style={ds.emptyDesc}>Select the service you provide to see the required verification documents.</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const ds = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F7" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 14, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerIconWrap: { width: 28, height: 28, borderRadius: 8, backgroundColor: `${ORANGE}15`, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  scroll: { flex: 1 },

  infoBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EFF6FF", borderRadius: 12, margin: 16, padding: 12,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  infoBannerText: { flex: 1, fontSize: 12, color: "#1D4ED8", fontFamily: "Inter_400Regular", lineHeight: 17 },

  sectionLabel: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 16, marginBottom: 10 },
  serviceScroll: { paddingHorizontal: 16, paddingBottom: 8, gap: 10 },
  serviceCard: {
    alignItems: "center", borderRadius: 14, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: "#fff", padding: 14, width: 90, gap: 6, position: "relative",
  },
  serviceIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serviceLabel: { fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary, textAlign: "center" },
  serviceCheck: { position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },

  serviceHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginHorizontal: 16, marginTop: 20, marginBottom: 12 },
  serviceHeaderIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  serviceHeaderTitle: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  serviceHeaderSub: { fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", marginTop: 2 },

  completionWrap: { marginHorizontal: 16, marginBottom: 16, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.borderLight },
  completionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  completionLabel: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  completionPct: { fontSize: 14, fontWeight: "700", fontFamily: "Inter_700Bold" },
  completionTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
  completionFill: { height: 6, borderRadius: 3 },
  completionNote: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  completionNoteText: { fontSize: 12, color: "#059669", fontFamily: "Inter_400Regular" },

  docList: { paddingHorizontal: 16, gap: 10 },
  docCard: {
    flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: C.borderLight,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  docLeft: { flexDirection: "row", gap: 12, flex: 1 },
  docIconWrap: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  docInfo: { flex: 1, gap: 3 },
  docName: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, lineHeight: 19 },
  docFileName: { fontSize: 11, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  docFileSize: { fontSize: 10, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  docRequired: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },
  adminNote: { fontSize: 11, color: "#EF4444", fontFamily: "Inter_400Regular", marginTop: 2 },

  docRight: { alignItems: "flex-end", gap: 6, marginLeft: 8 },
  docActions: { alignItems: "flex-end", gap: 6, marginTop: 4 },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ORANGE, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  uploadBtnText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  replaceBtn: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: C.border },
  replaceBtnText: { color: C.textSecondary },
  deleteBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },

  badge: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: "700", fontFamily: "Inter_700Bold" },

  tipCard: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginHorizontal: 16, marginTop: 14, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#FDE68A" },
  tipText: { flex: 1, fontSize: 11, color: "#92400E", fontFamily: "Inter_400Regular", lineHeight: 16 },

  emptyState: { alignItems: "center", justifyContent: "center", padding: 40, gap: 12, marginTop: 20 },
  emptyTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  emptyDesc: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
