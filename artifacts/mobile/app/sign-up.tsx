import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAuth, UserRole } from "@/context/AuthContext";
import { useLang } from "@/context/LanguageContext";

const C = Colors.light;
const TINT = "#FF7A18";

// ── Punjab Districts & Towns ──────────────────────────────────────────────────
const PUNJAB_AREAS: Record<string, string[]> = {
  "Amritsar": ["Ajnala", "Majitha", "Jandiala Guru", "Rayya", "Baba Bakala", "Chheharta", "Attari", "Beas"],
  "Barnala": ["Tapa", "Dhanaula", "Bhadaur", "Handiaya", "Mehal Kalan"],
  "Bathinda": ["Talwandi Sabo", "Maur", "Rampura Phul", "Goniana", "Bhucho Mandi", "Raman", "Sangat"],
  "Faridkot": ["Kotkapura", "Jaitu", "Sadiq", "Machaki Mal Singh"],
  "Fatehgarh Sahib": ["Sirhind", "Mandi Gobindgarh", "Bassi Pathana", "Amloh", "Khamanon"],
  "Fazilka": ["Abohar", "Jalalabad", "Arniwala", "Khuian Sarwar", "Sitto Gunno"],
  "Ferozepur": ["Zira", "Guru Har Sahai", "Makhu", "Mallanwala", "Mamdot", "Talwandi Bhai"],
  "Gurdaspur": ["Batala", "Dera Baba Nanak", "Dhariwal", "Qadian", "Sri Hargobindpur", "Dinanagar", "Fatehgarh Churian"],
  "Hoshiarpur": ["Dasuya", "Mukerian", "Garhshankar", "Hariana", "Tanda Urmar", "Sham Chaurasi", "Hajipur"],
  "Jalandhar": ["Nakodar", "Phillaur", "Shahkot", "Adampur", "Kartarpur", "Bhogpur", "Goraya"],
  "Kapurthala": ["Phagwara", "Sultanpur Lodhi", "Bholath", "Begowal", "Nadala", "Dhilwan"],
  "Ludhiana": ["Khanna", "Samrala", "Jagraon", "Raikot", "Payal", "Machhiwara", "Doraha", "Sahnewal"],
  "Malerkotla": ["Ahmedgarh", "Amargarh", "Kup Kalan"],
  "Mansa": ["Budhlada", "Sardulgarh", "Bhikhi", "Bareta", "Joga"],
  "Moga": ["Bagha Purana", "Nihal Singh Wala", "Dharamkot", "Kot Ise Khan"],
  "Pathankot": ["Sujanpur", "Dhar Kalan", "Narot Jaimal Singh"],
  "Patiala": ["Rajpura", "Nabha", "Samana", "Patran", "Sanaur", "Ghanaur", "Devigarh"],
  "Rupnagar (Ropar)": ["Anandpur Sahib", "Nangal", "Chamkaur Sahib", "Morinda", "Nurpur Bedi"],
  "SAS Nagar (Mohali)": ["Zirakpur", "Kharar", "Dera Bassi", "Kurali", "Banur", "Lalru"],
  "Sangrur": ["Sunam", "Lehragaga", "Dhuri", "Moonak", "Longowal", "Bhawanigarh", "Cheema"],
  "Shaheed Bhagat Singh Nagar (Nawanshahr)": ["Banga", "Balachaur", "Rahon", "Aur", "Mukandpur"],
  "Sri Muktsar Sahib": ["Malout", "Gidderbaha", "Bariwala", "Lambi"],
  "Tarn Taran": ["Patti", "Khadoor Sahib", "Bhikhiwind", "Khem Karan", "Goindwal Sahib", "Chohla Sahib"],
};
const DISTRICTS = Object.keys(PUNJAB_AREAS).sort();

// ── Country list ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: "+91",  flag: "🇮🇳", name: "India",           minDigits: 10, maxDigits: 10 },
  { code: "+1",   flag: "🇺🇸", name: "USA / Canada",    minDigits: 10, maxDigits: 10 },
  { code: "+44",  flag: "🇬🇧", name: "United Kingdom",  minDigits: 10, maxDigits: 10 },
  { code: "+61",  flag: "🇦🇺", name: "Australia",       minDigits: 9,  maxDigits: 9  },
  { code: "+64",  flag: "🇳🇿", name: "New Zealand",     minDigits: 8,  maxDigits: 9  },
  { code: "+971", flag: "🇦🇪", name: "UAE",             minDigits: 9,  maxDigits: 9  },
  { code: "+65",  flag: "🇸🇬", name: "Singapore",       minDigits: 8,  maxDigits: 8  },
  { code: "+92",  flag: "🇵🇰", name: "Pakistan",        minDigits: 10, maxDigits: 10 },
  { code: "+880", flag: "🇧🇩", name: "Bangladesh",      minDigits: 10, maxDigits: 10 },
  { code: "+94",  flag: "🇱🇰", name: "Sri Lanka",       minDigits: 9,  maxDigits: 9  },
  { code: "+977", flag: "🇳🇵", name: "Nepal",           minDigits: 10, maxDigits: 10 },
  { code: "+60",  flag: "🇲🇾", name: "Malaysia",        minDigits: 9,  maxDigits: 10 },
  { code: "+49",  flag: "🇩🇪", name: "Germany",         minDigits: 10, maxDigits: 11 },
  { code: "+33",  flag: "🇫🇷", name: "France",          minDigits: 9,  maxDigits: 9  },
  { code: "+81",  flag: "🇯🇵", name: "Japan",           minDigits: 10, maxDigits: 10 },
  { code: "+86",  flag: "🇨🇳", name: "China",           minDigits: 11, maxDigits: 11 },
  { code: "+966", flag: "🇸🇦", name: "Saudi Arabia",    minDigits: 9,  maxDigits: 9  },
  { code: "+27",  flag: "🇿🇦", name: "South Africa",    minDigits: 9,  maxDigits: 9  },
];

// ── Calendar constants ────────────────────────────────────────────────────────
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

function getMaxDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

function formatDisplay(date: Date): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${d}/${m}/${date.getFullYear()}`;
}

function buildDayGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid: (number | null)[] = Array(firstDay).fill(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(i);
  while (grid.length % 7 !== 0) grid.push(null);
  return grid;
}

// ── Date Picker Modal ─────────────────────────────────────────────────────────
type CalView = "day" | "month" | "year";

interface DatePickerProps {
  value: Date | null;
  onChange: (d: Date) => void;
  onClose: () => void;
}

function DatePickerModal({ value, onChange, onClose }: DatePickerProps) {
  const maxDate = getMaxDate();
  const initDate = value || maxDate;

  const [view, setView] = useState<CalView>("day");
  const [month, setMonth] = useState(initDate.getMonth());
  const [year, setYear] = useState(initDate.getFullYear());
  const [selected, setSelected] = useState<Date | null>(value);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  function animSwitch(cb: () => void) {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 90, useNativeDriver: false }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 130, useNativeDriver: false }),
    ]).start();
    cb();
  }

  function prevMonth() {
    animSwitch(() => {
      if (month === 0) { setMonth(11); setYear(y => y - 1); }
      else setMonth(m => m - 1);
    });
    Haptics.selectionAsync();
  }

  function nextMonth() {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    if (new Date(ny, nm, 1) > maxDate) return;
    animSwitch(() => { setMonth(nm); setYear(ny); });
    Haptics.selectionAsync();
  }

  function canGoNext() {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    return new Date(ny, nm, 1) <= maxDate;
  }

  function isDayDisabled(day: number) {
    const d = new Date(year, month, day);
    return d > maxDate || d < new Date(1924, 0, 1);
  }

  function isSelectedDay(day: number) {
    return !!selected &&
      selected.getDate() === day &&
      selected.getMonth() === month &&
      selected.getFullYear() === year;
  }

  function pickDay(day: number) {
    if (isDayDisabled(day)) return;
    const d = new Date(year, month, day);
    setSelected(d);
    Haptics.selectionAsync();
  }

  function switchView(v: CalView) {
    animSwitch(() => setView(v));
    Haptics.selectionAsync();
  }

  function pickMonth(m: number) {
    setMonth(m);
    animSwitch(() => setView("day"));
    Haptics.selectionAsync();
  }

  function pickYear(y: number) {
    setYear(y);
    animSwitch(() => setView("day"));
    Haptics.selectionAsync();
  }

  function confirm() {
    if (selected) { onChange(selected); onClose(); }
  }

  const yearList: number[] = [];
  for (let y = maxDate.getFullYear(); y >= 1924; y--) yearList.push(y);

  const grid = buildDayGrid(year, month);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={cs.root}>

        {/* ── Header ── */}
        <View style={cs.header}>
          <Text style={cs.headerTitle}>Date of Birth</Text>
          <Pressable onPress={onClose} style={cs.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={C.text} />
          </Pressable>
        </View>

        {/* ── Month / Year nav bar ── */}
        <View style={cs.navBar}>
          <Pressable onPress={prevMonth} style={cs.navArrow} hitSlop={12}>
            <Ionicons name="chevron-back" size={22} color={TINT} />
          </Pressable>

          <View style={cs.navCenter}>
            <Pressable onPress={() => switchView(view === "month" ? "day" : "month")} style={cs.navChip}>
              <Text style={cs.navChipText}>{MONTH_NAMES[month]}</Text>
              <Ionicons name={view === "month" ? "chevron-up" : "chevron-down"} size={13} color={TINT} />
            </Pressable>
            <Pressable onPress={() => switchView(view === "year" ? "day" : "year")} style={cs.navChip}>
              <Text style={cs.navChipText}>{year}</Text>
              <Ionicons name={view === "year" ? "chevron-up" : "chevron-down"} size={13} color={TINT} />
            </Pressable>
          </View>

          <Pressable onPress={nextMonth} style={[cs.navArrow, !canGoNext() && { opacity: 0.25 }]} disabled={!canGoNext()} hitSlop={12}>
            <Ionicons name="chevron-forward" size={22} color={TINT} />
          </Pressable>
        </View>

        {/* ── Age restriction note ── */}
        <View style={cs.ageBanner}>
          <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
          <Text style={cs.ageNote}>Must be 18 or older · Showing dates up to {formatDisplay(maxDate)}</Text>
        </View>

        {/* ── Animated calendar body ── */}
        <Animated.View style={[cs.body, { opacity: fadeAnim }]}>

          {/* ── Day view ── */}
          {view === "day" && (
            <>
              <View style={cs.weekRow}>
                {DAY_LABELS.map(d => (
                  <Text key={d} style={cs.weekLabel}>{d}</Text>
                ))}
              </View>
              <View style={cs.dayGrid}>
                {grid.map((day, i) => {
                  const disabled = !day || isDayDisabled(day);
                  const sel = !!day && isSelectedDay(day);
                  return (
                    <Pressable
                      key={i}
                      onPress={() => day && pickDay(day)}
                      disabled={disabled}
                      style={[cs.dayCell, sel && cs.dayCellSelected]}
                    >
                      <Text style={[
                        cs.dayText,
                        disabled && { color: "#D1D5DB" },
                        sel && cs.dayTextSelected,
                      ]}>
                        {day ?? ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}

          {/* ── Month view ── */}
          {view === "month" && (
            <View style={cs.monthGrid}>
              {MONTH_NAMES.map((name, i) => (
                <Pressable
                  key={name}
                  style={[cs.monthCell, i === month && cs.monthCellSelected]}
                  onPress={() => pickMonth(i)}
                >
                  <Text style={[cs.monthText, i === month && cs.monthTextSelected]}>
                    {name.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* ── Year view ── */}
          {view === "year" && (
            <ScrollView
              style={cs.yearScroll}
              contentContainerStyle={cs.yearList}
              showsVerticalScrollIndicator={false}
            >
              {yearList.map(y => (
                <Pressable
                  key={y}
                  style={[cs.yearItem, y === year && cs.yearItemSelected]}
                  onPress={() => pickYear(y)}
                >
                  <Text style={[cs.yearText, y === year && cs.yearTextSelected]}>{y}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Animated.View>

        {/* ── Footer ── */}
        <View style={cs.footer}>
          {selected ? (
            <View style={cs.selectedRow}>
              <Ionicons name="calendar" size={16} color={TINT} />
              <Text style={cs.selectedText}>{formatDisplay(selected)}</Text>
            </View>
          ) : (
            <Text style={cs.noSelText}>No date selected yet</Text>
          )}
          <Pressable
            onPress={confirm}
            disabled={!selected}
            style={[cs.confirmBtn, !selected && { opacity: 0.45 }]}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={cs.confirmBtnText}>Confirm Date</Text>
          </Pressable>
        </View>

      </View>
    </Modal>
  );
}

// Calendar styles
const cs = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  closeBtn: { padding: 4 },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 12, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#F5F5F5",
  },
  navArrow: { padding: 8 },
  navCenter: { flexDirection: "row", gap: 8, alignItems: "center" },
  navChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FFF5EC", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    borderWidth: 1.5, borderColor: "#FFD5A8",
  },
  navChipText: { fontSize: 15, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },
  ageBanner: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 20, paddingVertical: 8,
    backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  ageNote: { fontSize: 11, color: "#6B7280", fontFamily: "Inter_400Regular" },
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  weekRow: { flexDirection: "row", marginBottom: 4 },
  weekLabel: { flex: 1, textAlign: "center", fontSize: 11, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: "#9CA3AF" },
  dayGrid: { flexDirection: "row", flexWrap: "wrap" },
  dayCell: {
    width: "14.28%", aspectRatio: 1, alignItems: "center", justifyContent: "center",
    borderRadius: 50,
  },
  dayCellSelected: { backgroundColor: TINT },
  dayText: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  dayTextSelected: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },
  monthGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 12, paddingHorizontal: 4,
  },
  monthCell: {
    width: "30%", paddingVertical: 14, alignItems: "center", justifyContent: "center",
    borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB",
  },
  monthCellSelected: { backgroundColor: TINT, borderColor: TINT },
  monthText: { fontSize: 15, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  monthTextSelected: { color: "#fff" },
  yearScroll: { flex: 1 },
  yearList: { paddingVertical: 8, paddingHorizontal: 60 },
  yearItem: {
    paddingVertical: 13, alignItems: "center", borderRadius: 10, marginVertical: 2,
  },
  yearItemSelected: { backgroundColor: TINT },
  yearText: { fontSize: 16, fontFamily: "Inter_400Regular", color: C.text },
  yearTextSelected: { color: "#fff", fontWeight: "700", fontFamily: "Inter_700Bold" },
  footer: {
    padding: 20, borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 14,
  },
  selectedRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  selectedText: { fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },
  noSelText: { textAlign: "center", fontSize: 14, color: "#9CA3AF", fontFamily: "Inter_400Regular" },
  confirmBtn: {
    backgroundColor: TINT, borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  confirmBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
});

// ── Sign Up Screen ────────────────────────────────────────────────────────────
function getAge(dob: string): number | null {
  const parts = dob.split("/");
  if (parts.length !== 3 || parts[2].length < 4) return null;
  const [day, month, year] = parts.map(Number);
  if (!day || !month || !year || year < 1900 || year > new Date().getFullYear()) return null;
  const birthDate = new Date(year, month - 1, day);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

export default function SignUpScreen() {
  const { register } = useAuth();
  const { t, language, toggleLanguage } = useLang();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [dob, setDob] = useState("");
  const [dobDate, setDobDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("customer");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedCity, setSelectedCity]         = useState("");
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showCityPicker, setShowCityPicker]         = useState(false);
  const [districtSearch, setDistrictSearch]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isPa = language === "pa";

  function err(en: string, pa: string) { return isPa ? pa : en; }

  function validate() {
    const e: Record<string, string> = {};
    if (!firstName.trim()) e.firstName = err("First name is required", "ਪਹਿਲਾ ਨਾਮ ਲਾਜ਼ਮੀ ਹੈ");
    if (!lastName.trim()) e.lastName = err("Last name is required", "ਆਖਰੀ ਨਾਮ ਲਾਜ਼ਮੀ ਹੈ");
    if (!email.trim()) {
      e.email = err("Email is required", "ਈਮੇਲ ਲਾਜ਼ਮੀ ਹੈ");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = err("Enter a valid email address", "ਸਹੀ ਈਮੇਲ ਪਤਾ ਦਾਖਲ ਕਰੋ");
    }
    if (mobile.trim()) {
      const digits = mobile.replace(/\D/g, "");
      if (digits.length < selectedCountry.minDigits) {
        e.mobile = err(`Enter a valid ${selectedCountry.name} mobile number`, "ਮੋਬਾਈਲ ਨੰਬਰ ਸਹੀ ਨਹੀਂ ਹੈ");
      }
    }
    if (!dob.trim()) {
      e.dob = err("Date of birth is required", "ਜਨਮ ਮਿਤੀ ਲਾਜ਼ਮੀ ਹੈ");
    } else {
      const age = getAge(dob);
      if (age === null) {
        e.dob = err("Enter a valid date", "ਸਹੀ ਮਿਤੀ ਦਾਖਲ ਕਰੋ");
      } else if (age < 18) {
        e.dob = err("You must be at least 18 years old to register", "ਰਜਿਸਟਰ ਕਰਨ ਲਈ ਤੁਹਾਡੀ ਉਮਰ ਘੱਟੋ ਘੱਟ 18 ਸਾਲ ਹੋਣੀ ਚਾਹੀਦੀ ਹੈ");
      }
    }
    if (!password) {
      e.password = err("Password is required", "ਪਾਸਵਰਡ ਲਾਜ਼ਮੀ ਹੈ");
    } else if (password.length < 6) {
      e.password = err("Password must be at least 6 characters", "ਪਾਸਵਰਡ ਘੱਟੋ ਘੱਟ 6 ਅੱਖਰਾਂ ਦਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ");
    }
    if (!confirmPassword) {
      e.confirmPassword = err("Please confirm your password", "ਕਿਰਪਾ ਕਰਕੇ ਪਾਸਵਰਡ ਦੀ ਪੁਸ਼ਟੀ ਕਰੋ");
    } else if (password !== confirmPassword) {
      e.confirmPassword = err("Passwords do not match", "ਪਾਸਵਰਡ ਮੇਲ ਨਹੀਂ ਖਾਂਦੇ");
    }
    if (!agreedToTerms) e.terms = err("You must agree to the Terms and Conditions", "ਤੁਹਾਨੂੰ ਨਿਯਮਾਂ ਅਤੇ ਸ਼ਰਤਾਂ ਨਾਲ ਸਹਿਮਤ ਹੋਣਾ ਪਵੇਗਾ");
    return e;
  }

  async function handleRegister() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    try {
      const locationValue = selectedCity && selectedDistrict
        ? `${selectedCity}, ${selectedDistrict}`
        : selectedDistrict || undefined;

      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
        mobile: mobile.trim() ? mobile.replace(/\D/g, "") : "",
        countryCode: selectedCountry.code,
        dob: dob.trim(),
        password,
        role,
        location: locationValue,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrors({ general: err.message || (isPa ? "ਰਜਿਸਟ੍ਰੇਸ਼ਨ ਅਸਫਲ ਰਹੀ" : "Registration failed. Please try again.") });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  }

  const filteredCountries = countrySearch.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
        c.code.includes(countrySearch)
      )
    : COUNTRIES;

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <LinearGradient colors={["#FF7A18", "#FF9F43"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DatePickerModal
          value={dobDate}
          onChange={(d) => {
            setDobDate(d);
            setDob(formatDisplay(d));
            setErrors(prev => ({ ...prev, dob: "" }));
          }}
          onClose={() => setShowDatePicker(false)}
        />
      )}

      {/* District Picker Modal */}
      <Modal visible={showDistrictPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setShowDistrictPicker(false); setDistrictSearch(""); }}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select District</Text>
            <Pressable onPress={() => { setShowDistrictPicker(false); setDistrictSearch(""); }} style={styles.pickerClose}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={16} color={C.textTertiary} />
            <TextInput
              style={styles.pickerSearchInput}
              value={districtSearch}
              onChangeText={setDistrictSearch}
              placeholder="Search district..."
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
          </View>
          <FlatList
            data={DISTRICTS.filter(d => !districtSearch.trim() || d.toLowerCase().includes(districtSearch.toLowerCase()))}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, selectedDistrict === item && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedDistrict(item);
                  setSelectedCity("");
                  setShowDistrictPicker(false);
                  setDistrictSearch("");
                  Haptics.selectionAsync();
                }}
              >
                <Ionicons name="location-outline" size={18} color={selectedDistrict === item ? TINT : C.textSecondary} />
                <Text style={[styles.pickerCountryName, { flex: 1 }]}>{item}</Text>
                <Text style={[styles.pickerCode, { fontSize: 11 }]}>{PUNJAB_AREAS[item]?.length} towns</Text>
                {selectedDistrict === item && <Ionicons name="checkmark" size={18} color={TINT} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* City Picker Modal */}
      <Modal visible={showCityPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCityPicker(false)}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select City / Town</Text>
            <Pressable onPress={() => setShowCityPicker(false)} style={styles.pickerClose}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          {selectedDistrict ? (
            <View style={styles.districtBadge}>
              <Ionicons name="business-outline" size={13} color={TINT} />
              <Text style={styles.districtBadgeText}>{selectedDistrict} District</Text>
            </View>
          ) : null}
          <FlatList
            data={selectedDistrict ? PUNJAB_AREAS[selectedDistrict] : []}
            keyExtractor={item => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, selectedCity === item && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedCity(item);
                  setShowCityPicker(false);
                  Haptics.selectionAsync();
                }}
              >
                <Ionicons name="navigate-outline" size={17} color={selectedCity === item ? TINT : C.textSecondary} />
                <Text style={[styles.pickerCountryName, { flex: 1 }]}>{item}</Text>
                {selectedCity === item && <Ionicons name="checkmark" size={18} color={TINT} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Country Picker Modal */}
      <Modal visible={showCountryPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.pickerModal}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Select Country</Text>
            <Pressable onPress={() => { setShowCountryPicker(false); setCountrySearch(""); }} style={styles.pickerClose}>
              <Ionicons name="close" size={22} color={C.text} />
            </Pressable>
          </View>
          <View style={styles.pickerSearch}>
            <Ionicons name="search-outline" size={16} color={C.textTertiary} />
            <TextInput
              style={styles.pickerSearchInput}
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country or code..."
              placeholderTextColor={C.textTertiary}
              autoFocus
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code + item.name}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.pickerItem, selectedCountry.code === item.code && selectedCountry.name === item.name && styles.pickerItemActive]}
                onPress={() => {
                  setSelectedCountry(item);
                  setShowCountryPicker(false);
                  setCountrySearch("");
                  Haptics.selectionAsync();
                }}
              >
                <Text style={styles.pickerFlag}>{item.flag}</Text>
                <Text style={styles.pickerCountryName}>{item.name}</Text>
                <Text style={styles.pickerCode}>{item.code}</Text>
                {selectedCountry.code === item.code && selectedCountry.name === item.name && (
                  <Ionicons name="checkmark" size={18} color={TINT} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>

      {/* Language toggle */}
      <Pressable onPress={toggleLanguage} style={[styles.langToggle, { top: topPad + 12 }]}>
        <Text style={styles.langToggleText}>{language === "en" ? "ਪੰਜਾਬੀ" : "EN"}</Text>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 56 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.logoCircle}>
              <Ionicons name="car-outline" size={30} color="#fff" />
            </View>
            <Text style={styles.appName}>{t.createAccount}</Text>
            <Text style={styles.tagline}>{t.joinTagline}</Text>
          </View>

          <View style={styles.card}>
            {errors.general ? <View style={styles.errorBanner}><Text style={styles.errorBannerText}>{errors.general}</Text></View> : null}

            {/* Name Row */}
            <View style={styles.row}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.firstName} *</Text>
                <TextInput
                  style={[styles.input, errors.firstName && styles.inputError]}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={isPa ? "ਗੁਰਪ੍ਰੀਤ" : "Gurpreet"}
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="words"
                />
                {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}
              </View>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.fieldLabel}>{t.lastName} *</Text>
                <TextInput
                  style={[styles.input, errors.lastName && styles.inputError]}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={isPa ? "ਸਿੰਘ" : "Singh"}
                  placeholderTextColor={C.textTertiary}
                  autoCapitalize="words"
                />
                {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.emailAddress} *</Text>
              <View style={[styles.iconInput, errors.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t.emailPlaceholder}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            {/* Mobile with country code */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.mobileNumber} <Text style={styles.optional}>({t.optional})</Text></Text>
              <View style={[styles.iconInput, errors.mobile && styles.inputError, { paddingHorizontal: 0 }]}>
                <Pressable onPress={() => setShowCountryPicker(true)} style={styles.countryBtn}>
                  <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                  <Text style={styles.countryCode}>{selectedCountry.code}</Text>
                  <Ionicons name="chevron-down" size={13} color={C.textTertiary} />
                </Pressable>
                <View style={styles.countryDivider} />
                <TextInput
                  style={[styles.iconInputText, { paddingHorizontal: 10 }]}
                  value={mobile}
                  onChangeText={(v) => setMobile(v.replace(/\D/g, ""))}
                  placeholder={selectedCountry.minDigits === 10 ? "9876543210" : "Enter number"}
                  placeholderTextColor={C.textTertiary}
                  keyboardType="phone-pad"
                  maxLength={selectedCountry.maxDigits}
                />
              </View>
              {errors.mobile ? <Text style={styles.fieldError}>{errors.mobile}</Text> : null}
            </View>

            {/* Date of Birth — calendar picker */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth *</Text>
              <Pressable
                onPress={() => { setShowDatePicker(true); Haptics.selectionAsync(); }}
                style={[styles.iconInput, styles.dobPressable, errors.dob && styles.inputError]}
              >
                <Ionicons name="calendar-outline" size={17} color={dobDate ? TINT : C.textTertiary} />
                <Text style={[styles.dobValueText, !dobDate && { color: C.textTertiary }]}>
                  {dob || "Select date (DD/MM/YYYY)"}
                </Text>
                {dobDate ? (
                  <View style={styles.dobAge}>
                    <Text style={styles.dobAgeText}>{getAge(dob)} yrs</Text>
                  </View>
                ) : (
                  <Ionicons name="chevron-down" size={15} color={C.textTertiary} />
                )}
              </Pressable>
              {errors.dob
                ? <Text style={styles.fieldError}>{errors.dob}</Text>
                : <Text style={styles.fieldHint}>Tap to open calendar · Must be 18 or older</Text>
              }
            </View>

            {/* Area / Location — District + City */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Area / Location <Text style={styles.optional}>(Optional)</Text>
              </Text>

              {/* District selector */}
              <Pressable
                onPress={() => { setShowDistrictPicker(true); Haptics.selectionAsync(); }}
                style={[styles.iconInput, styles.dobPressable, { marginBottom: 8 }]}
              >
                <Ionicons name="business-outline" size={17} color={selectedDistrict ? TINT : C.textTertiary} />
                <Text style={[styles.dobValueText, !selectedDistrict && { color: C.textTertiary }]}>
                  {selectedDistrict || "Select District"}
                </Text>
                <Ionicons name="chevron-down" size={15} color={C.textTertiary} />
              </Pressable>

              {/* City selector — only enabled after district is picked */}
              <Pressable
                onPress={() => {
                  if (!selectedDistrict) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); return; }
                  setShowCityPicker(true);
                  Haptics.selectionAsync();
                }}
                style={[styles.iconInput, styles.dobPressable, !selectedDistrict && { opacity: 0.45 }]}
              >
                <Ionicons name="navigate-outline" size={17} color={selectedCity ? TINT : C.textTertiary} />
                <Text style={[styles.dobValueText, !selectedCity && { color: C.textTertiary }]}>
                  {selectedCity || (selectedDistrict ? "Select City / Town" : "Select district first")}
                </Text>
                {selectedCity ? (
                  <Pressable
                    onPress={(e) => { e.stopPropagation(); setSelectedCity(""); }}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={17} color={C.textTertiary} />
                  </Pressable>
                ) : (
                  <Ionicons name="chevron-down" size={15} color={C.textTertiary} />
                )}
              </Pressable>

              <Text style={styles.fieldHint}>
                {selectedDistrict
                  ? (selectedCity ? `📍 ${selectedCity}, ${selectedDistrict}` : `Select your city/town in ${selectedDistrict}`)
                  : "Helps match you with nearby providers"}
              </Text>
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.password} *</Text>
              <View style={[styles.iconInput, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t.minPassword}
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                  <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color={C.textTertiary} />
                </Pressable>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.confirmPassword} *</Text>
              <View style={[styles.iconInput, errors.confirmPassword && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={17} color={C.textTertiary} />
                <TextInput
                  style={styles.iconInputText}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t.repeatPassword}
                  placeholderTextColor={C.textTertiary}
                  secureTextEntry={!showConfirm}
                />
                <Pressable onPress={() => setShowConfirm(!showConfirm)} style={{ padding: 4 }}>
                  <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={17} color={C.textTertiary} />
                </Pressable>
              </View>
              {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
            </View>

            {/* Role */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t.iWantTo}</Text>
              <View style={styles.roleRow}>
                <Pressable onPress={() => { Haptics.selectionAsync(); setRole("customer"); }} style={[styles.roleBtn, role === "customer" && styles.roleBtnActive]}>
                  <Ionicons name="search-outline" size={17} color={role === "customer" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "customer" && styles.roleBtnTextActive]}>{t.rentThings}</Text>
                </Pressable>
                <Pressable onPress={() => { Haptics.selectionAsync(); setRole("provider"); }} style={[styles.roleBtn, role === "provider" && styles.roleBtnActive]}>
                  <Ionicons name="storefront-outline" size={17} color={role === "provider" ? "#fff" : C.text} />
                  <Text style={[styles.roleBtnText, role === "provider" && styles.roleBtnTextActive]}>{t.listAndEarn}</Text>
                </Pressable>
              </View>
            </View>

            {/* Global access notice */}
            <View style={styles.noticeCard}>
              <Ionicons name="globe-outline" size={15} color="#1E40AF" style={{ marginTop: 1 }} />
              <Text style={styles.noticeText}>
                You can register from anywhere worldwide. Bookings are currently available for{" "}
                <Text style={{ fontWeight: "700" }}>Punjab region</Text> only.
              </Text>
            </View>

            {/* Terms */}
            <Pressable onPress={() => setAgreedToTerms(!agreedToTerms)} style={styles.termsRow}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={styles.termsText}>{t.termsText}</Text>
            </Pressable>
            {errors.terms ? <Text style={styles.fieldError}>{errors.terms}</Text> : null}

            {/* Submit */}
            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={({ pressed }) => [styles.signUpBtn, { opacity: pressed || loading ? 0.8 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Text style={styles.signUpBtnText}>{t.signUp}</Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </Pressable>

            <View style={styles.switchRow}>
              <Text style={styles.switchText}>{t.alreadyHaveAccount} </Text>
              <Pressable onPress={() => router.replace("/sign-in")}>
                <Text style={styles.switchLink}>{t.signIn}</Text>
              </Pressable>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FF7A18" },
  langToggle: {
    position: "absolute", right: 16, zIndex: 10,
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },
  langToggleText: { color: "#fff", fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold" },
  scroll: { paddingHorizontal: 20 },
  brand: { alignItems: "center", marginBottom: 24, gap: 8 },
  logoCircle: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  appName: { fontSize: 26, fontWeight: "700", fontFamily: "Inter_700Bold", color: "#fff" },
  tagline: { fontSize: 12, color: "rgba(255,255,255,0.6)", fontFamily: "Inter_400Regular", textAlign: "center" },
  card: { backgroundColor: "#fff", borderRadius: 24, padding: 20, gap: 14 },
  errorBanner: { backgroundColor: "#FEF2F2", borderRadius: 10, borderWidth: 1, borderColor: "#FECACA", padding: 12 },
  errorBannerText: { color: C.error, fontSize: 13, fontFamily: "Inter_400Regular" },
  row: { flexDirection: "row", gap: 12 },
  fieldGroup: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  optional: { color: C.textTertiary, fontWeight: "400", fontFamily: "Inter_400Regular" },
  input: {
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text,
  },
  inputError: { borderColor: C.error },
  iconInput: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12,
  },
  iconInputText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, paddingVertical: 11 },
  fieldError: { fontSize: 11, color: C.error, fontFamily: "Inter_400Regular" },
  fieldHint: { fontSize: 11, color: C.textTertiary, fontFamily: "Inter_400Regular" },

  // DOB field
  dobPressable: { paddingVertical: 12, cursor: "pointer" as any },
  dobValueText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text },
  dobAge: { backgroundColor: "#FFF5EC", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: "#FFD5A8" },
  dobAgeText: { fontSize: 12, fontWeight: "700", fontFamily: "Inter_700Bold", color: TINT },

  // District badge in city picker
  districtBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#FFF5EC", paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#FFD5A8",
  },
  districtBadgeText: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: TINT },

  // Country picker
  countryBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 11 },
  countryFlag: { fontSize: 18 },
  countryCode: { fontSize: 13, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text },
  countryDivider: { width: 1, height: 24, backgroundColor: C.border },

  pickerModal: { flex: 1, backgroundColor: "#fff" },
  pickerHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 17, fontWeight: "700", fontFamily: "Inter_700Bold", color: C.text },
  pickerClose: { padding: 4 },
  pickerSearch: {
    flexDirection: "row", alignItems: "center", gap: 8, margin: 16,
    backgroundColor: C.backgroundTertiary, borderRadius: 10, borderWidth: 1.5, borderColor: C.border,
    paddingHorizontal: 12,
  },
  pickerSearchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: C.text, paddingVertical: 10 },
  pickerItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.borderLight,
  },
  pickerItemActive: { backgroundColor: "#FFF5EC" },
  pickerFlag: { fontSize: 24 },
  pickerCountryName: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: C.text },
  pickerCode: { fontSize: 14, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.textSecondary },

  // Notice
  noticeCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#EBF4FF", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  noticeText: { flex: 1, fontSize: 12, color: "#1E40AF", fontFamily: "Inter_400Regular", lineHeight: 17 },

  roleRow: { flexDirection: "row", gap: 10 },
  roleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderRadius: 10, paddingVertical: 11, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.backgroundTertiary,
  },
  roleBtnActive: { backgroundColor: C.tint, borderColor: C.tint },
  roleBtnText: { fontSize: 12, fontWeight: "600", fontFamily: "Inter_600SemiBold", color: C.text, textAlign: "center" },
  roleBtnTextActive: { color: "#fff" },
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: C.border,
    backgroundColor: C.backgroundTertiary, alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  checkboxChecked: { backgroundColor: C.tint, borderColor: C.tint },
  termsText: { flex: 1, fontSize: 12, color: C.textSecondary, fontFamily: "Inter_400Regular", lineHeight: 18 },
  signUpBtn: {
    backgroundColor: C.tint, borderRadius: 14, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  signUpBtnText: { color: "#fff", fontSize: 16, fontWeight: "700", fontFamily: "Inter_700Bold" },
  switchRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  switchText: { fontSize: 13, color: C.textSecondary, fontFamily: "Inter_400Regular" },
  switchLink: { fontSize: 13, color: C.tint, fontWeight: "700", fontFamily: "Inter_700Bold" },
});
