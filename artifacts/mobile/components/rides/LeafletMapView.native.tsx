import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import * as Location from "expo-location";
import { API_BASE_URL } from "@/constants/apiUrl";
import { buildGoogleMapHtml } from "./LeafletMapView.web";
import type { MapRef } from "./LeafletMapView";

type Props = {
  initialLat?: number; initialLng?: number; style?: object;
  onReady?: () => void;
  onLocationSelected?: (mode: "pickup" | "drop", lat: number, lng: number, address: string) => void;
  onCenterChanged?: (lat: number, lng: number, address: string) => void;
  onRouteCalculated?: (km: number, minutes: number) => void;
  onGpsLocation?: (lat: number, lng: number, address: string) => void;
  onGpsError?: (message: string) => void;
};

export default forwardRef<MapRef, Props>(function NativeMap(props, ref) {
  const web = useRef<WebView>(null);
  const ready = useRef(false);
  const queued = useRef<object[]>([]);
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const initial = useRef({lat:props.initialLat ?? 30.7333,lng:props.initialLng ?? 76.7794}).current;
  const source = useMemo(() => ({html:buildGoogleMapHtml(initial.lat,initial.lng,key),baseUrl:API_BASE_URL}), [key,initial]);
  useEffect(() => {
    let active = true;
    ready.current = false; setError(""); setKey("");
    fetch(`${API_BASE_URL}/api/maps/key`, { signal: AbortSignal.timeout(12000) })
      .then(r => { if (!r.ok) throw new Error("Map configuration is unavailable."); return r.json(); })
      .then(d => { if (!d.key) throw new Error("Google Maps is not configured."); if (active) setKey(d.key); })
      .catch(() => { if (active) setError("Unable to load Google Maps. Check your connection and try again."); });
    return () => { active = false; };
  }, [attempt]);
  const send = (data: object) => {
    if (!ready.current) { queued.current.push(data); return; }
    web.current?.postMessage(JSON.stringify(data));
  };
  const gps = async () => {
    try {
      if (!ready.current) throw new Error("The map is still loading. Please try again in a moment.");
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Location permission is off. Enable it in your phone settings.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude: lat, longitude: lng } = position.coords;
      // Resolve the address through Google's map geocoder inside the WebView.
      web.current?.injectJavaScript(`reverseGeocode(${lat},${lng}).then(function(address){map.panTo({lat:${lat},lng:${lng}});send({type:'gpsLocation',lat:${lat},lng:${lng},address:address});});true;`);
    } catch (e: any) { props.onGpsError?.(e.message || "Could not get your location."); }
  };
  useImperativeHandle(ref, () => ({
    setPickup: (lat,lng,address) => send({type:"setPickup",lat,lng,address}),
    setDrop: (lat,lng,address) => send({type:"setDrop",lat,lng,address}),
    setDriver: (lat,lng) => send({type:"setDriver",lat,lng}),
    clearDrop: () => send({type:"clearDrop"}),
    setMode: mode => send({type:"setMode",mode}),
    fitBounds: () => send({type:"fitBounds"}),
    getCurrentLocation: () => { void gps(); },
  }));
  return <View style={[StyleSheet.absoluteFillObject, props.style]}>
    {key && !error ? <WebView key={attempt} ref={web} originWhitelist={["https://*"]}
      source={source}
      javaScriptEnabled domStorageEnabled
      injectedJavaScript="window.doGPS=function(){send({type:'requestGps'});};true;"
      onError={() => setError("Google Maps could not load. Please try again.")}
      onMessage={event => {
        try {
          const m = JSON.parse(event.nativeEvent.data);
          if (m.type === "ready") {
            ready.current = true;
            queued.current.splice(0).forEach(send); props.onReady?.();
          } else if (m.type === "requestGps") void gps();
          else if (m.type === "gpsError") { props.onGpsError?.(m.message); }
          else if (m.type === "mapError") setError(m.message);
          else if (m.type === "locationSelected") props.onLocationSelected?.(m.mode,m.lat,m.lng,m.address);
          else if (m.type === "centerChanged") props.onCenterChanged?.(m.lat,m.lng,m.address);
          else if (m.type === "gpsLocation") props.onGpsLocation?.(m.lat,m.lng,m.address);
          else if (m.type === "routeCalculated") props.onRouteCalculated?.(m.distanceKm,m.durationMin);
        } catch {}
      }} /> : <View style={{flex:1,alignItems:"center",justifyContent:"center",padding:24,backgroundColor:"#FFF6EC"}}>
        {error ? <><Text accessibilityRole="alert">{error}</Text><Pressable onPress={() => setAttempt(n=>n+1)} style={{padding:16}}><Text>Retry map</Text></Pressable></> : <ActivityIndicator />}
      </View>}
  </View>;
});
