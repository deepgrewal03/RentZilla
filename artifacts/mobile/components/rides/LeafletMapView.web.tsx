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
  setMyLocation: (lat: number, lng: number) => void;
  panTo: (lat: number, lng: number) => void;
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
  onCenterChanged?: (lat: number, lng: number, address: string) => void;
  onRouteCalculated?: (distanceKm: number, durationMin: number) => void;
  onGpsLocation?: (lat: number, lng: number, address: string) => void;
  onGpsError?: (msg: string) => void;
  onReady?: () => void;
  style?: object;
}

function buildGoogleMapHtml(lat: number, lng: number, apiKey: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body,#map{width:100%;height:100%;background:#f0ebe3}

    /* GPS button — clean rounded card */
    #gps-btn{
      position:absolute;bottom:80px;right:12px;z-index:999;
      width:44px;height:44px;border-radius:50%;
      background:#fff;border:none;cursor:pointer;
      box-shadow:0 2px 12px rgba(0,0,0,0.22);
      display:flex;align-items:center;justify-content:center;
      transition:transform 0.12s;
    }
    #gps-btn:active{transform:scale(0.92);}
    #gps-btn svg{width:20px;height:20px;}

    /* Center drag pin */
    #center-pin{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,-100%);
      z-index:998;pointer-events:none;
      transition:transform 0.18s cubic-bezier(0.34,1.56,0.64,1),filter 0.18s;
      filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));
    }
    #center-pin.dragging{transform:translate(-50%,-118%) scale(1.18);filter:drop-shadow(0 6px 12px rgba(0,0,0,0.4));}
    #center-pin svg{width:36px;height:44px;}

    /* Address loading pill */
    #addr-loading{
      position:absolute;top:50%;left:50%;
      transform:translate(-50%,14px);
      z-index:997;pointer-events:none;
      background:rgba(15,31,61,0.82);
      color:#fff;font-size:11px;font-weight:600;font-family:sans-serif;
      border-radius:10px;padding:4px 10px;
      opacity:0;transition:opacity 0.2s;white-space:nowrap;
    }
    #addr-loading.visible{opacity:1;}

    /* Pulsing "my location" dot (CSS animation) */
    .my-loc-outer{
      width:20px;height:20px;border-radius:50%;
      background:rgba(66,133,244,0.25);
      display:flex;align-items:center;justify-content:center;
      animation:pulse-ring 2s ease-out infinite;
    }
    .my-loc-inner{
      width:12px;height:12px;border-radius:50%;
      background:#4285F4;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.35);
    }
    @keyframes pulse-ring{
      0%{box-shadow:0 0 0 0 rgba(66,133,244,0.4);}
      70%{box-shadow:0 0 0 10px rgba(66,133,244,0);}
      100%{box-shadow:0 0 0 0 rgba(66,133,244,0);}
    }
  </style>
</head>
<body>
<div id="map"></div>

<!-- Center drag pin (custom SVG) -->
<div id="center-pin">
  <svg viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 26 18 26S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="#FF7A18"/>
    <circle cx="18" cy="18" r="7" fill="white"/>
  </svg>
</div>
<div id="addr-loading">Finding address…</div>

<!-- GPS button (SVG crosshair) -->
<button id="gps-btn" onclick="doGPS()" title="My Location">
  <svg viewBox="0 0 24 24" fill="none" stroke="#FF7A18" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <line x1="12" y1="2" x2="12" y2="6"/>
    <line x1="12" y1="18" x2="12" y2="22"/>
    <line x1="2" y1="12" x2="6" y2="12"/>
    <line x1="18" y1="12" x2="22" y2="12"/>
  </svg>
</button>

<script>
var GKEY='${apiKey}';
var INIT_LAT=${lat},INIT_LNG=${lng};
var settingMode='pickup';
var pickupM=null,dropM=null,driverM=null,myLocM=null,routeRenderer=null,map=null;
var centerPin=document.getElementById('center-pin');
var addrLoading=document.getElementById('addr-loading');
var geocodeTimeout=null;
var driverAnimFrame=null,driverTargetPos=null;

function send(data){
  var s=JSON.stringify(data);
  try{window.parent.postMessage(s,'*');}catch(e){}
  try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);}catch(e){}
}

function showAddrLoading(v){
  if(v) addrLoading.classList.add('visible');
  else addrLoading.classList.remove('visible');
}

function mkMyLocIcon(){
  return{
    content:(function(){
      var el=document.createElement('div');
      el.className='my-loc-outer';
      var inner=document.createElement('div');
      inner.className='my-loc-inner';
      el.appendChild(inner);
      return el;
    })(),
    anchor:new google.maps.marker.AdvancedMarkerElementAnchor
      ?undefined:undefined
  };
}

function initMap(){
  map=new google.maps.Map(document.getElementById('map'),{
    center:{lat:INIT_LAT,lng:INIT_LNG},
    zoom:15,
    mapTypeControl:false,
    streetViewControl:false,
    fullscreenControl:false,
    zoomControl:true,
    zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_CENTER},
    styles:[
      {featureType:'poi.business',stylers:[{visibility:'off'}]},
      {featureType:'transit',stylers:[{visibility:'simplified'}]},
      {featureType:'road',elementType:'labels.icon',stylers:[{visibility:'off'}]}
    ]
  });

  routeRenderer=new google.maps.DirectionsRenderer({
    map:map,
    suppressMarkers:true,
    polylineOptions:{strokeColor:'#FF7A18',strokeWeight:5,strokeOpacity:0.9}
  });

  // Drag start — animate pin up
  map.addListener('dragstart',function(){
    centerPin.classList.add('dragging');
    showAddrLoading(false);
    if(geocodeTimeout){clearTimeout(geocodeTimeout);geocodeTimeout=null;}
  });

  // Drag end — reverse geocode center
  map.addListener('dragend',function(){
    centerPin.classList.remove('dragging');
    showAddrLoading(true);
    var center=map.getCenter();
    var lat=center.lat(),lng=center.lng();
    geocodeTimeout=setTimeout(async function(){
      var addr=await reverseGeocode(lat,lng);
      showAddrLoading(false);
      send({type:'centerChanged',lat:lat,lng:lng,address:addr});
    },350);
  });

  // Tap to set marker
  map.addListener('click',async function(e){
    var lat=e.latLng.lat(),lng=e.latLng.lng();
    showAddrLoading(true);
    var addr=await reverseGeocode(lat,lng);
    showAddrLoading(false);
    send({type:'locationSelected',mode:settingMode,lat:lat,lng:lng,address:addr});
  });

  setTimeout(function(){
    reverseGeocode(INIT_LAT,INIT_LNG).then(function(addr){
      send({type:'centerChanged',lat:INIT_LAT,lng:INIT_LNG,address:addr});
    });
    send({type:'ready'});
  },800);
}

function mkPickupIcon(){
  return{path:google.maps.SymbolPath.CIRCLE,fillColor:'#22C55E',fillOpacity:1,strokeColor:'#fff',strokeWeight:3,scale:11};
}
function mkDropIcon(){
  return{path:google.maps.SymbolPath.CIRCLE,fillColor:'#FF7A18',fillOpacity:1,strokeColor:'#fff',strokeWeight:3,scale:11};
}
function mkDriverIcon(){
  return{
    url:'data:image/svg+xml;charset=UTF-8,'+encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">'+
      '<circle cx="22" cy="22" r="20" fill="#0F1F3D" stroke="#fff" stroke-width="2"/>'+
      '<text x="22" y="29" font-size="20" text-anchor="middle" fill="white">🚗</text>'+
      '</svg>'),
    scaledSize:new google.maps.Size(44,44),anchor:new google.maps.Point(22,22)
  };
}

function setPickup(lat,lng,addr){
  if(pickupM) pickupM.setMap(null);
  pickupM=new google.maps.Marker({position:{lat,lng},map,icon:mkPickupIcon(),title:'Pickup',zIndex:2});
  if(!dropM) map.panTo({lat,lng});
  if(dropM) drawRoute();
}
function setDrop(lat,lng,addr){
  if(dropM) dropM.setMap(null);
  dropM=new google.maps.Marker({position:{lat,lng},map,icon:mkDropIcon(),title:'Drop',zIndex:2});
  if(pickupM) drawRoute();
}
function clearDrop(){
  if(dropM){dropM.setMap(null);dropM=null;}
  if(routeRenderer) routeRenderer.setDirections({routes:[]});
}

/* Pulsing "my location" blue dot */
function setMyLocation(lat,lng){
  if(myLocM){
    myLocM.setPosition({lat,lng});
  } else {
    var el=document.createElement('div');
    el.className='my-loc-outer';
    var inner=document.createElement('div');
    inner.className='my-loc-inner';
    el.appendChild(inner);
    try{
      myLocM=new google.maps.marker.AdvancedMarkerElement({
        position:{lat,lng},map:map,content:el,zIndex:1
      });
    }catch(ex){
      // Fallback to regular marker if AdvancedMarker not available
      myLocM=new google.maps.Marker({
        position:{lat,lng},map,
        icon:{path:google.maps.SymbolPath.CIRCLE,fillColor:'#4285F4',fillOpacity:1,strokeColor:'#fff',strokeWeight:2,scale:7},
        zIndex:1
      });
    }
  }
}

/* Smooth driver marker animation with linear interpolation */
function setDriver(lat,lng){
  if(!driverM){
    driverM=new google.maps.Marker({position:{lat,lng},map,icon:mkDriverIcon(),zIndex:3});
    driverTargetPos={lat,lng};
    return;
  }
  // Animate smoothly from current to new position
  var startPos=driverM.getPosition();
  var startLat=startPos.lat(),startLng=startPos.lng();
  var endLat=lat,endLng=lng;
  var startTime=performance.now();
  var DURATION=1200;
  if(driverAnimFrame) cancelAnimationFrame(driverAnimFrame);
  function step(now){
    var t=Math.min((now-startTime)/DURATION,1);
    var ease=t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2; // easeInOut
    var iLat=startLat+(endLat-startLat)*ease;
    var iLng=startLng+(endLng-startLng)*ease;
    driverM.setPosition({lat:iLat,lng:iLng});
    if(t<1) driverAnimFrame=requestAnimationFrame(step);
  }
  driverAnimFrame=requestAnimationFrame(step);
}

function drawRoute(){
  if(!pickupM||!dropM) return;
  var svc=new google.maps.DirectionsService();
  svc.route({
    origin:pickupM.getPosition(),destination:dropM.getPosition(),
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
      map.fitBounds(bounds,{top:80,right:60,bottom:80,left:60});
      send({type:'routeCalculated',distanceKm:distKm,durationMin:durMin});
    }else{
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
        if(status==='OK'&&results&&results[0]){
          var comps={};
          (results[0].address_components||[]).forEach(function(c){
            c.types.forEach(function(t){comps[t]=c.long_name;});
          });
          var streetNum=comps['street_number']||'';
          var route=comps['route']||'';
          var sub=comps['sublocality_level_1']||comps['sublocality']||comps['neighborhood']||'';
          var city=comps['locality']||comps['administrative_area_level_2']||'';
          var state=comps['administrative_area_level_1']||'';
          var parts=[];
          if(streetNum&&route) parts.push(streetNum+' '+route);
          else if(route) parts.push(route);
          if(sub) parts.push(sub);
          if(city) parts.push(city);
          if(state) parts.push(state);
          resolve(parts.length>=2?parts.join(', '):results[0].formatted_address);
        }else{
          resolve(lat.toFixed(4)+', '+lng.toFixed(4));
        }
      });
    });
  }catch(e){return lat.toFixed(4)+', '+lng.toFixed(4);}
}

function doGPS(){
  if(!navigator.geolocation){send({type:'gpsError',message:'Not supported'});return;}
  send({type:'gpsLoading'});
  navigator.geolocation.getCurrentPosition(
    async function(pos){
      var lat=pos.coords.latitude,lng=pos.coords.longitude;
      setMyLocation(lat,lng);
      showAddrLoading(true);
      var addr=await reverseGeocode(lat,lng);
      showAddrLoading(false);
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
    else if(m.type==='setMyLocation') setMyLocation(m.lat,m.lng);
    else if(m.type==='setMode') settingMode=m.mode;
    else if(m.type==='fitBounds'&&pickupM&&dropM){
      var b=new google.maps.LatLngBounds();
      b.extend(pickupM.getPosition());b.extend(dropM.getPosition());
      map.fitBounds(b,{top:80,right:60,bottom:80,left:60});
    }
    else if(m.type==='getCurrentLocation') doGPS();
    else if(m.type==='panTo'&&map) map.panTo({lat:m.lat,lng:m.lng});
  }catch(e){}
}
window.addEventListener('message',handleMsg);
document.addEventListener('message',handleMsg);
</script>
<script async
  src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,marker&callback=initMap">
</script>
</body>
</html>`;
}

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
    #center-pin{position:absolute;top:50%;left:50%;transform:translate(-50%,-100%);z-index:999;pointer-events:none;font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5));}
  </style>
</head>
<body>
<div id="map"></div>
<div id="center-pin">📍</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
<script>
var INIT_LAT=${lat},INIT_LNG=${lng};
var map=L.map('map',{center:[INIT_LAT,INIT_LNG],zoom:15});
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'&copy; OpenStreetMap',maxZoom:19}).addTo(map);
var settingMode='pickup',pickupM=null,dropM=null,driverM=null,routeLayer=null;
var geocodeTimeout=null;
function mkCircle(c){return L.divIcon({className:'',html:'<div style="width:18px;height:18px;border-radius:50%;background:'+c+';border:3px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.55)"></div>',iconSize:[18,18],iconAnchor:[9,9],tooltipAnchor:[0,-12]});}
function mkDriver(){return L.divIcon({className:'',html:'<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.5))">🚗</div>',iconSize:[34,34],iconAnchor:[17,17]});}
function send(data){var s=JSON.stringify(data);try{window.parent.postMessage(s,'*');}catch(e){}try{if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(s);}catch(e){}}

async function reverseGeocode(lat,lng){
  try{
    var r=await fetch('https://nominatim.openstreetmap.org/reverse?lat='+lat+'&lon='+lng+'&format=json&accept-language=en&zoom=18&addressdetails=1',{headers:{'User-Agent':'RentZilla/1.0'}});
    var d=await r.json();
    var a=d.address||{};
    var parts=[];
    var houseNum=a.house_number||'';
    var road=a.road||a.street||'';
    var sub=a.suburb||a.neighbourhood||a.residential||'';
    var city=a.city||a.town||a.village||a.county||'';
    var state=a.state||'';
    if(houseNum&&road) parts.push(houseNum+' '+road);
    else if(road) parts.push(road);
    if(sub) parts.push(sub);
    if(city) parts.push(city);
    if(state) parts.push(state);
    return parts.length>=2?parts.join(', '):(d.display_name||(lat.toFixed(4)+', '+lng.toFixed(4)));
  }catch(e){return lat.toFixed(4)+', '+lng.toFixed(4);}
}

function setPickup(lat,lng,addr){if(pickupM)map.removeLayer(pickupM);pickupM=L.marker([lat,lng],{icon:mkCircle('#22C55E')}).bindTooltip(addr.split(',')[0]||'Pickup',{permanent:true,direction:'top',className:'lbl'}).addTo(map);if(!dropM)map.panTo([lat,lng],{animate:true});if(dropM)drawRoute();}
function setDrop(lat,lng,addr){if(dropM)map.removeLayer(dropM);if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}dropM=L.marker([lat,lng],{icon:mkCircle('#FF7A18')}).bindTooltip(addr.split(',')[0]||'Destination',{permanent:true,direction:'top',className:'lbl'}).addTo(map);if(pickupM)drawRoute();}
function clearDrop(){if(dropM){map.removeLayer(dropM);dropM=null;}if(routeLayer){map.removeLayer(routeLayer);routeLayer=null;}}
function setDriver(lat,lng){if(driverM)driverM.setLatLng([lat,lng]);else driverM=L.marker([lat,lng],{icon:mkDriver()}).addTo(map);}
async function drawRoute(){if(!pickupM||!dropM)return;var p=pickupM.getLatLng(),d=dropM.getLatLng();try{var r=await fetch('https://router.project-osrm.org/route/v1/driving/'+p.lng+','+p.lat+';'+d.lng+','+d.lat+'?overview=full&geometries=geojson');var data=await r.json();if(data.routes&&data.routes[0]){if(routeLayer)map.removeLayer(routeLayer);routeLayer=L.geoJSON(data.routes[0].geometry,{style:{color:'#FF7A18',weight:5,opacity:0.85,lineCap:'round',lineJoin:'round'}}).addTo(map);var dist=data.routes[0].distance/1000,dur=Math.round(data.routes[0].duration/60);map.fitBounds([[p.lat,p.lng],[d.lat,d.lng]],{padding:[70,70],animate:true});send({type:'routeCalculated',distanceKm:parseFloat(dist.toFixed(1)),durationMin:dur});return;}}catch(e){}var R=6371,dLa=(d.lat-p.lat)*Math.PI/180,dLo=(d.lng-p.lng)*Math.PI/180,a=Math.sin(dLa/2)**2+Math.cos(p.lat*Math.PI/180)*Math.cos(d.lat*Math.PI/180)*Math.sin(dLo/2)**2,fallback=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));send({type:'routeCalculated',distanceKm:parseFloat(fallback.toFixed(1)),durationMin:Math.round(fallback*3)});}

map.on('dragend',async function(){
  if(geocodeTimeout){clearTimeout(geocodeTimeout);}
  geocodeTimeout=setTimeout(async function(){
    var c=map.getCenter();
    var addr=await reverseGeocode(c.lat,c.lng);
    send({type:'centerChanged',lat:c.lat,lng:c.lng,address:addr});
  },400);
});
map.on('click',async function(e){var addr=await reverseGeocode(e.latlng.lat,e.latlng.lng);send({type:'locationSelected',mode:settingMode,lat:e.latlng.lat,lng:e.latlng.lng,address:addr});});
function doGPS(){if(!navigator.geolocation){send({type:'gpsError',message:'Not supported'});return;}send({type:'gpsLoading'});navigator.geolocation.getCurrentPosition(async function(pos){var lat=pos.coords.latitude,lng=pos.coords.longitude;var addr=await reverseGeocode(lat,lng);send({type:'gpsLocation',lat:lat,lng:lng,address:addr});map.panTo([lat,lng],{animate:true});},function(err){send({type:'gpsError',message:err.message});},{enableHighAccuracy:true,timeout:12000});}
function handleMsg(e){try{var m=JSON.parse(e.data);if(m.type==='setPickup')setPickup(m.lat,m.lng,m.address);else if(m.type==='setDrop')setDrop(m.lat,m.lng,m.address);else if(m.type==='clearDrop')clearDrop();else if(m.type==='setDriver')setDriver(m.lat,m.lng);else if(m.type==='setMode')settingMode=m.mode;else if(m.type==='fitBounds'&&pickupM&&dropM)map.fitBounds([pickupM.getLatLng(),dropM.getLatLng()],{padding:[70,70],animate:true});else if(m.type==='getCurrentLocation')doGPS();else if(m.type==='panTo')map.panTo([m.lat,m.lng],{animate:true});}catch(e){}}
window.addEventListener('message',handleMsg);document.addEventListener('message',handleMsg);
setTimeout(async function(){
  var addr=await reverseGeocode(INIT_LAT,INIT_LNG);
  send({type:'centerChanged',lat:INIT_LAT,lng:INIT_LNG,address:addr});
  send({type:'ready'});
},800);
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
      onCenterChanged,
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

    useEffect(() => {
      const base = (window as any).__BASE_URL__ || "";
      fetch(`${base}/api/maps/key`)
        .then((r) => r.json())
        .then((d) => { setApiKey(d.key || ""); setKeyLoaded(true); })
        .catch(() => setKeyLoaded(true));
    }, []);

    const send = (data: object) => {
      try {
        iframeRef.current?.contentWindow?.postMessage(JSON.stringify(data), "*");
      } catch {}
    };

    useImperativeHandle(ref, () => ({
      setPickup: (lat, lng, address) => send({ type: "setPickup", lat, lng, address }),
      setDrop: (lat, lng, address) => send({ type: "setDrop", lat, lng, address }),
      clearDrop: () => send({ type: "clearDrop" }),
      setDriver: (lat, lng) => send({ type: "setDriver", lat, lng }),
      setMode: (mode) => send({ type: "setMode", mode }),
      getCurrentLocation: () => send({ type: "getCurrentLocation" }),
      fitBounds: () => send({ type: "fitBounds" }),
      setMyLocation: (lat, lng) => send({ type: "setMyLocation", lat, lng }),
      panTo: (lat, lng) => send({ type: "panTo", lat, lng }),
    }));

    useEffect(() => {
      const handler = (e: MessageEvent) => {
        if (typeof e.data !== "string") return;
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "locationSelected")
            onLocationSelected?.(msg.mode, msg.lat, msg.lng, msg.address);
          else if (msg.type === "centerChanged")
            onCenterChanged?.(msg.lat, msg.lng, msg.address);
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
    }, [onLocationSelected, onCenterChanged, onRouteCalculated, onGpsLocation, onGpsError, onReady]);

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
          style: { width: "100%", height: "100%", border: "none", display: "block" },
          allow: "geolocation",
          sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
        })}
      </View>
    );
  }
);

export default LeafletMapView;
