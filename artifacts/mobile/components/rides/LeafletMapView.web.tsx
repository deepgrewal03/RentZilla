import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { StyleSheet, View } from "react-native";

export interface MapRef {
  setPickup: (lat: number, lng: number, address: string) => void;
  setDrop: (lat: number, lng: number, address: string) => void;
  clearDrop: () => void;
  setDriver: (lat: number, lng: number) => void;
  setMode: (mode: "pickup" | "drop") => void;
  getCurrentLocation: () => void;
  fitBounds: () => void;
}

interface Props {
  initialLat?: number;
  initialLng?: number;
  onLocationSelected?: (
    mode: "pickup" | "drop",
    lat: number,
    lng: number,
    address: string
  ) => void;
  onRouteCalculated?: (distanceKm: number, durationMin: number) => void;
  onGpsLocation?: (lat: number, lng: number, address: string) => void;
  onGpsError?: (msg: string) => void;
  onReady?: () => void;
  style?: object;
}

function buildMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#e8ddd0}
    .lbl{
      background:rgba(15,31,61,0.88)!important;
      border:none!important;color:#fff!important;
      font-size:11px!important;font-weight:700!important;
      padding:3px 8px!important;border-radius:8px!important;
      box-shadow:0 2px 8px rgba(0,0,0,0.4)!important;
      white-space:nowrap!important;
    }
    .lbl::before{display:none!important}
    .leaflet-control-zoom{border:none!important;box-shadow:0 2px 12px rgba(0,0,0,0.18)!important;border-radius:10px!important;overflow:hidden}
    .leaflet-control-zoom a{border-radius:0!important;font-size:18px!important;line-height:30px!important;width:30px!important;height:30px!important;color:#0F1F3D!important}
    .leaflet-routing-container{display:none!important}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
var INIT_LAT=${lat}, INIT_LNG=${lng};
var map=L.map('map',{center:[INIT_LAT,INIT_LNG],zoom:11});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
  attribution:'&copy; OpenStreetMap contributors',maxZoom:19
}).addTo(map);

var settingMode='pickup';
var pickupM=null,dropM=null,driverM=null,routeLayer=null;

function mkCircle(color){
  return L.divIcon({
    className:'',
    html:'<div style="width:18px;height:18px;border-radius:50%;background:'+color+';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.55)"></div>',
    iconSize:[18,18],iconAnchor:[9,9],tooltipAnchor:[0,-12]
  });
}
function mkDriver(){
  return L.divIcon({
    className:'',
    html:'<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚗</div>',
    iconSize:[34,34],iconAnchor:[17,17]
  });
}

function send(data){
  var s=JSON.stringify(data);
  try{ window.parent.postMessage(s,'*'); }catch(e){}
  try{ if(window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); }catch(e){}
}

async function reverseGeocode(lat,lng){
  try{
    var r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=en',
      {headers:{'User-Agent':'RentZilla/1.0'}});
    var d=await r.json();
    var a=d.address||{};
    var parts=[a.road||a.suburb||a.neighbourhood||a.hamlet,
               a.city||a.town||a.village||a.county,a.state].filter(Boolean);
    return parts.length?parts.join(', '):d.display_name||(lat.toFixed(4)+', '+lng.toFixed(4));
  }catch(e){ return lat.toFixed(4)+', '+lng.toFixed(4); }
}

function haversine(la1,lo1,la2,lo2){
  var R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
  var a=Math.sin(dLa/2)**2+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function setPickup(lat,lng,addr){
  if(pickupM) map.removeLayer(pickupM);
  pickupM=L.marker([lat,lng],{icon:mkCircle('#22C55E')})
    .bindTooltip((addr.split(',')[0]||'Pickup'),{permanent:true,direction:'top',className:'lbl'})
    .addTo(map);
  if(!dropM) map.panTo([lat,lng],{animate:true});
  if(dropM) drawRoute();
}
function setDrop(lat,lng,addr){
  if(dropM) map.removeLayer(dropM);
  if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }
  dropM=L.marker([lat,lng],{icon:mkCircle('#FF7A18')})
    .bindTooltip((addr.split(',')[0]||'Destination'),{permanent:true,direction:'top',className:'lbl'})
    .addTo(map);
  if(pickupM) drawRoute();
}
function clearDrop(){
  if(dropM){ map.removeLayer(dropM); dropM=null; }
  if(routeLayer){ map.removeLayer(routeLayer); routeLayer=null; }
}
function setDriver(lat,lng){
  if(driverM){ driverM.setLatLng([lat,lng]); }
  else{ driverM=L.marker([lat,lng],{icon:mkDriver()}).addTo(map); }
}

async function drawRoute(){
  if(!pickupM||!dropM) return;
  var p=pickupM.getLatLng(),d=dropM.getLatLng();
  try{
    var url='https://router.project-osrm.org/route/v1/driving/'+
      p.lng+','+p.lat+';'+d.lng+','+d.lat+'?overview=full&geometries=geojson';
    var r=await fetch(url);
    var data=await r.json();
    if(data.routes&&data.routes[0]){
      if(routeLayer) map.removeLayer(routeLayer);
      routeLayer=L.geoJSON(data.routes[0].geometry,{
        style:{color:'#FF7A18',weight:5,opacity:0.85,lineCap:'round',lineJoin:'round'}
      }).addTo(map);
      var dist=(data.routes[0].distance/1000);
      var dur=Math.round(data.routes[0].duration/60);
      map.fitBounds([[p.lat,p.lng],[d.lat,d.lng]],{padding:[70,70],animate:true});
      send({type:'routeCalculated',distanceKm:parseFloat(dist.toFixed(1)),durationMin:dur});
      return;
    }
  }catch(e){}
  var fallback=haversine(p.lat,p.lng,d.lat,d.lng);
  send({type:'routeCalculated',distanceKm:parseFloat(fallback.toFixed(1)),durationMin:Math.round(fallback*3)});
}

map.on('click',async function(e){
  var addr=await reverseGeocode(e.latlng.lat,e.latlng.lng);
  send({type:'locationSelected',mode:settingMode,lat:e.latlng.lat,lng:e.latlng.lng,address:addr});
});

function doGPS(){
  if(!navigator.geolocation){ send({type:'gpsError',message:'Not supported'}); return; }
  send({type:'gpsLoading'});
  navigator.geolocation.getCurrentPosition(
    async function(pos){
      var lat=pos.coords.latitude,lng=pos.coords.longitude;
      var addr=await reverseGeocode(lat,lng);
      send({type:'gpsLocation',lat:lat,lng:lng,address:addr});
    },
    function(err){ send({type:'gpsError',message:err.message}); },
    {enableHighAccuracy:true,timeout:12000}
  );
}

function handleMsg(e){
  try{
    var m=JSON.parse(e.data);
    if(m.type==='setPickup') setPickup(m.lat,m.lng,m.address);
    else if(m.type==='setDrop') setDrop(m.lat,m.lng,m.address);
    else if(m.type==='clearDrop') clearDrop();
    else if(m.type==='setDriver') setDriver(m.lat,m.lng);
    else if(m.type==='setMode') settingMode=m.mode;
    else if(m.type==='fitBounds'&&pickupM&&dropM)
      map.fitBounds([pickupM.getLatLng(),dropM.getLatLng()],{padding:[70,70],animate:true});
    else if(m.type==='getCurrentLocation') doGPS();
    else if(m.type==='panTo') map.panTo([m.lat,m.lng],{animate:true});
  }catch(e){}
}
window.addEventListener('message',handleMsg);
document.addEventListener('message',handleMsg);

setTimeout(function(){ send({type:'ready'}); },600);
</script>
</body>
</html>`;
}

const LeafletMapView = forwardRef<MapRef, Props>(
  (
    {
      initialLat = 30.7333,
      initialLng = 76.7794,
      onLocationSelected,
      onRouteCalculated,
      onGpsLocation,
      onGpsError,
      onReady,
      style,
    },
    ref
  ) => {
    const iframeRef = useRef<any>(null);

    const send = (data: object) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify(data),
          "*"
        );
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      setPickup: (lat, lng, address) =>
        send({ type: "setPickup", lat, lng, address }),
      setDrop: (lat, lng, address) =>
        send({ type: "setDrop", lat, lng, address }),
      clearDrop: () => send({ type: "clearDrop" }),
      setDriver: (lat, lng) => send({ type: "setDriver", lat, lng }),
      setMode: (mode) => send({ type: "setMode", mode }),
      getCurrentLocation: () => send({ type: "getCurrentLocation" }),
      fitBounds: () => send({ type: "fitBounds" }),
    }));

    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (typeof e.data !== "string") return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "locationSelected")
            onLocationSelected?.(msg.mode, msg.lat, msg.lng, msg.address);
          else if (msg.type === "routeCalculated")
            onRouteCalculated?.(msg.distanceKm, msg.durationMin);
          else if (msg.type === "gpsLocation")
            onGpsLocation?.(msg.lat, msg.lng, msg.address);
          else if (msg.type === "gpsError") onGpsError?.(msg.message);
          else if (msg.type === "ready") onReady?.();
        } catch {}
      };
      window.addEventListener("message", handler);
      return () => window.removeEventListener("message", handler);
    }, [onLocationSelected, onRouteCalculated, onGpsLocation, onGpsError, onReady]);

    const html = buildMapHtml(initialLat, initialLng);

    return (
      <View style={[StyleSheet.absoluteFillObject, style]}>
        {React.createElement("iframe", {
          ref: iframeRef,
          srcDoc: html,
          style: {
            width: "100%",
            height: "100%",
            border: "none",
            display: "block",
          },
          allow: "geolocation",
          sandbox:
            "allow-scripts allow-same-origin allow-forms allow-popups",
        })}
      </View>
    );
  }
);

export default LeafletMapView;
