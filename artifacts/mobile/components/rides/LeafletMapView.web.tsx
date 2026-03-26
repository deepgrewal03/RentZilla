import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";

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

// Google Maps API key — fetched at runtime from our API so it's never in client bundle
const GMAPS_KEY = (window as any).__GOOGLE_MAPS_KEY__ ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "";

function buildGoogleMapHtml(lat: number, lng: number, apiKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#f0ebe3}
    #gps-btn{
      position:absolute;bottom:120px;right:12px;z-index:999;
      width:42px;height:42px;border-radius:50%;
      background:#fff;border:none;cursor:pointer;
      box-shadow:0 2px 10px rgba(0,0,0,0.25);
      display:flex;align-items:center;justify-content:center;font-size:20px;
    }
    #mode-pill{
      position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:999;
      background:rgba(15,31,61,0.85);color:#fff;
      border-radius:20px;padding:6px 18px;font-size:13px;font-weight:700;
      font-family:sans-serif;pointer-events:none;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
<div id="map"></div>
<button id="gps-btn" onclick="doGPS()">📍</button>
<div id="mode-pill">Set Pickup</div>
<script>
var GKEY='${apiKey}';
var INIT_LAT=${lat},INIT_LNG=${lng};
var settingMode='pickup';
var pickupM=null,dropM=null,driverM=null,routeRenderer=null,map=null;
var modePill=document.getElementById('mode-pill');

function send(data){
  var s=JSON.stringify(data);
  try{window.parent.postMessage(s,'*');}catch(e){}
  try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);}catch(e){}
}

function updateModePill(){
  modePill.textContent=settingMode==='pickup'?'Tap to set Pickup':'Tap to set Destination';
  modePill.style.display=(pickupM&&dropM)?'none':'block';
}

function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:INIT_LAT,lng:INIT_LNG},
    zoom:13,
    mapTypeControl:false,
    streetViewControl:false,
    fullscreenControl:false,
    zoomControl:true,
    zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_CENTER},
    styles:[
      {featureType:'poi.business',stylers:[{visibility:'simplified'}]},
      {featureType:'transit',stylers:[{visibility:'simplified'}]}
    ]
  });

  routeRenderer=new google.maps.DirectionsRenderer({
    map:map,
    suppressMarkers:true,
    polylineOptions:{strokeColor:'#FF7A18',strokeWeight:5,strokeOpacity:0.85}
  });

  map.addListener('click',async function(e){
    var lat=e.latLng.lat(),lng=e.latLng.lng();
    var addr=await reverseGeocode(lat,lng);
    send({type:'locationSelected',mode:settingMode,lat:lat,lng:lng,address:addr});
  });

  updateModePill();
  setTimeout(function(){send({type:'ready'});},600);
}

function mkPickupIcon(){
  return{
    path:google.maps.SymbolPath.CIRCLE,
    fillColor:'#22C55E',fillOpacity:1,
    strokeColor:'#fff',strokeWeight:3,scale:10
  };
}
function mkDropIcon(){
  return{
    path:google.maps.SymbolPath.CIRCLE,
    fillColor:'#FF7A18',fillOpacity:1,
    strokeColor:'#fff',strokeWeight:3,scale:10
  };
}
function mkDriverIcon(){
  return{
    url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">'+
      '<circle cx="20" cy="20" r="18" fill="#0F1F3D" stroke="#fff" stroke-width="2"/>'+
      '<text x="20" y="26" font-size="18" text-anchor="middle" fill="white">🚗</text>'+
      '</svg>'),
    scaledSize:new google.maps.Size(40,40),
    anchor:new google.maps.Point(20,20)
  };
}

function setPickup(lat,lng,addr){
  if(pickupM) pickupM.setMap(null);
  pickupM=new google.maps.Marker({
    position:{lat,lng},map,icon:mkPickupIcon(),
    title:'Pickup: '+(addr||''),
    zIndex:2
  });
  if(!dropM) map.panTo({lat,lng});
  if(dropM) drawRoute();
  updateModePill();
}
function setDrop(lat,lng,addr){
  if(dropM) dropM.setMap(null);
  dropM=new google.maps.Marker({
    position:{lat,lng},map,icon:mkDropIcon(),
    title:'Destination: '+(addr||''),
    zIndex:2
  });
  if(pickupM) drawRoute();
  updateModePill();
}
function clearDrop(){
  if(dropM){dropM.setMap(null);dropM=null;}
  if(routeRenderer) routeRenderer.setDirections({routes:[]});
  updateModePill();
}
function setDriver(lat,lng){
  if(driverM) driverM.setPosition({lat,lng});
  else driverM=new google.maps.Marker({position:{lat,lng},map,icon:mkDriverIcon(),zIndex:3});
}

function drawRoute(){
  if(!pickupM||!dropM) return;
  var svc=new google.maps.DirectionsService();
  svc.route({
    origin:pickupM.getPosition(),
    destination:dropM.getPosition(),
    travelMode:google.maps.TravelMode.DRIVING
  },function(result,status){
    if(status==='OK'&&result){
      routeRenderer.setDirections(result);
      var leg=result.routes[0].legs[0];
      var distKm=parseFloat((leg.distance.value/1000).toFixed(1));
      var durMin=Math.round(leg.duration.value/60);
      var bounds=new google.maps.LatLngBounds();
      bounds.extend(pickupM.getPosition());
      bounds.extend(dropM.getPosition());
      map.fitBounds(bounds,{top:80,right:60,bottom:60,left:60});
      send({type:'routeCalculated',distanceKm:distKm,durationMin:durMin});
    } else {
      // Fallback: haversine estimate
      var p=pickupM.getPosition(),d=dropM.getPosition();
      var R=6371,la1=p.lat()*Math.PI/180,la2=d.lat()*Math.PI/180;
      var dLa=(d.lat()-p.lat())*Math.PI/180,dLo=(d.lng()-p.lng())*Math.PI/180;
      var a=Math.sin(dLa/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLo/2)**2;
      var dist=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
      send({type:'routeCalculated',distanceKm:parseFloat(dist.toFixed(1)),durationMin:Math.round(dist*3)});
    }
  });
}

async function reverseGeocode(lat,lng){
  try{
    var gc=new google.maps.Geocoder();
    return await new Promise(function(resolve){
      gc.geocode({location:{lat,lng}},function(results,status){
        if(status==='OK'&&results[0]) resolve(results[0].formatted_address);
        else resolve(lat.toFixed(4)+', '+lng.toFixed(4));
      });
    });
  }catch(e){ return lat.toFixed(4)+', '+lng.toFixed(4); }
}

function doGPS(){
  if(!navigator.geolocation){send({type:'gpsError',message:'Not supported'});return;}
  send({type:'gpsLoading'});
  navigator.geolocation.getCurrentPosition(
    async function(pos){
      var lat=pos.coords.latitude,lng=pos.coords.longitude;
      var addr=await reverseGeocode(lat,lng);
      send({type:'gpsLocation',lat:lat,lng:lng,address:addr});
      map.panTo({lat,lng});
    },
    function(err){send({type:'gpsError',message:err.message});},
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
    else if(m.type==='setMode'){settingMode=m.mode;updateModePill();}
    else if(m.type==='fitBounds'&&pickupM&&dropM){
      var b=new google.maps.LatLngBounds();
      b.extend(pickupM.getPosition());b.extend(dropM.getPosition());
      map.fitBounds(b,{top:80,right:60,bottom:60,left:60});
    }
    else if(m.type==='getCurrentLocation') doGPS();
    else if(m.type==='panTo') map.panTo({lat:m.lat,lng:m.lng});
  }catch(e){}
}
window.addEventListener('message',handleMsg);
document.addEventListener('message',handleMsg);
</script>
<script async
  src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry&callback=initMap">
</script>
</body>
</html>`;
}

// Fallback Leaflet map (used if no Google key)
function buildLeafletMapHtml(lat: number, lng: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#e8ddd0}
    .lbl{background:rgba(15,31,61,0.88)!important;border:none!important;color:#fff!important;font-size:11px!important;font-weight:700!important;padding:3px 8px!important;border-radius:8px!important;box-shadow:0 2px 8px rgba(0,0,0,0.4)!important;white-space:nowrap!important;}
    .lbl::before{display:none!important}
    .leaflet-routing-container{display:none!important}
  </style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
var INIT_LAT=${lat},INIT_LNG=${lng};
var map=L.map('map',{center:[INIT_LAT,INIT_LNG],zoom:11});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
var settingMode='pickup',pickupM=null,dropM=null,driverM=null,routeLayer=null;
function mkCircle(c){return L.divIcon({className:'',html:'<div style="width:18px;height:18px;border-radius:50%;background:'+c+';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.55)"></div>',iconSize:[18,18],iconAnchor:[9,9],tooltipAnchor:[0,-12]});}
function mkDriver(){return L.divIcon({className:'',html:'<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚗</div>',iconSize:[34,34],iconAnchor:[17,17]});}
function send(data){var s=JSON.stringify(data);try{window.parent.postMessage(s,'*');}catch(e){}try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);}catch(e){}}
async function reverseGeocode(lat,lng){try{var r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=en',{headers:{'User-Agent':'RentZilla/1.0'}});var d=await r.json();var a=d.address||{};var parts=[a.road||a.suburb||a.neighbourhood,a.city||a.town||a.village||a.county,a.state].filter(Boolean);return parts.length?parts.join(', '):d.display_name||(lat.toFixed(4)+', '+lng.toFixed(4));}catch(e){return lat.toFixed(4)+', '+lng.toFixed(4);}}
function setPickup(lat,lng,addr){if(pickupM)map.removeLayer(pickupM);pickupM=L.marker([lat,lng],{icon:mkCircle('#22C55E')}).bindTooltip(addr.split(',')[0]||'Pickup',{permanent:true,direction:'top',className:'lbl'}).addTo(map);if(!dropM)map.panTo([lat,lng],{animate:true});if(dropM)drawRoute();}
function setDrop(lat,lng,addr){if(dropM)map.removeLayer(dropM);if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}dropM=L.marker([lat,lng],{icon:mkCircle('#FF7A18')}).bindTooltip(addr.split(',')[0]||'Destination',{permanent:true,direction:'top',className:'lbl'}).addTo(map);if(pickupM)drawRoute();}
function clearDrop(){if(dropM){map.removeLayer(dropM);dropM=null;}if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}}
function setDriver(lat,lng){if(driverM)driverM.setLatLng([lat,lng]);else driverM=L.marker([lat,lng],{icon:mkDriver()}).addTo(map);}
async function drawRoute(){if(!pickupM||!dropM)return;var p=pickupM.getLatLng(),d=dropM.getLatLng();try{var r=await fetch('https://router.project-osrm.org/route/v1/driving/'+p.lng+','+p.lat+';'+d.lng+','+d.lat+'?overview=full&geometries=geojson');var data=await r.json();if(data.routes&&data.routes[0]){if(routeLayer)map.removeLayer(routeLayer);routeLayer=L.geoJSON(data.routes[0].geometry,{style:{color:'#FF7A18',weight:5,opacity:0.85,lineCap:'round',lineJoin:'round'}}).addTo(map);var dist=data.routes[0].distance/1000,dur=Math.round(data.routes[0].duration/60);map.fitBounds([[p.lat,p.lng],[d.lat,d.lng]],{padding:[70,70],animate:true});send({type:'routeCalculated',distanceKm:parseFloat(dist.toFixed(1)),durationMin:dur});return;}}catch(e){}var R=6371,dLa=(d.lat-p.lat)*Math.PI/180,dLo=(d.lng-p.lng)*Math.PI/180,a=Math.sin(dLa/2)**2+Math.cos(p.lat*Math.PI/180)*Math.cos(d.lat*Math.PI/180)*Math.sin(dLo/2)**2,fallback=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));send({type:'routeCalculated',distanceKm:parseFloat(fallback.toFixed(1)),durationMin:Math.round(fallback*3)});}
map.on('click',async function(e){var addr=await reverseGeocode(e.latlng.lat,e.latlng.lng);send({type:'locationSelected',mode:settingMode,lat:e.latlng.lat,lng:e.latlng.lng,address:addr});});
function doGPS(){if(!navigator.geolocation){send({type:'gpsError',message:'Not supported'});return;}send({type:'gpsLoading'});navigator.geolocation.getCurrentPosition(async function(pos){var lat=pos.coords.latitude,lng=pos.coords.longitude;var addr=await reverseGeocode(lat,lng);send({type:'gpsLocation',lat:lat,lng:lng,address:addr});},function(err){send({type:'gpsError',message:err.message});},{enableHighAccuracy:true,timeout:12000});}
function handleMsg(e){try{var m=JSON.parse(e.data);if(m.type==='setPickup')setPickup(m.lat,m.lng,m.address);else if(m.type==='setDrop')setDrop(m.lat,m.lng,m.address);else if(m.type==='clearDrop')clearDrop();else if(m.type==='setDriver')setDriver(m.lat,m.lng);else if(m.type==='setMode')settingMode=m.mode;else if(m.type==='fitBounds'&&pickupM&&dropM)map.fitBounds([pickupM.getLatLng(),dropM.getLatLng()],{padding:[70,70],animate:true});else if(m.type==='getCurrentLocation')doGPS();else if(m.type==='panTo')map.panTo([m.lat,m.lng],{animate:true});}catch(e){}}
window.addEventListener('message',handleMsg);document.addEventListener('message',handleMsg);
setTimeout(function(){send({type:'ready'});},600);
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
    const [apiKey, setApiKey] = useState<string>("");
    const [keyLoaded, setKeyLoaded] = useState(false);

    // Fetch API key from our backend proxy so it's never bundled in client code
    useEffect(() => {
      const base = (window as any).__BASE_URL__ || "";
      fetch(`${base}/api/maps/key`)
        .then((r) => r.json())
        .then((d) => {
          setApiKey(d.key || "");
          setKeyLoaded(true);
        })
        .catch(() => setKeyLoaded(true));
    }, []);

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

    if (!keyLoaded) {
      return (
        <View style={[StyleSheet.absoluteFillObject, style, { alignItems: "center", justifyContent: "center", backgroundColor: "#f0ebe3" }]}>
          <ActivityIndicator color="#FF7A18" size="large" />
        </View>
      );
    }

    const html = apiKey
      ? buildGoogleMapHtml(initialLat, initialLng, apiKey)
      : buildLeafletMapHtml(initialLat, initialLng);

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
