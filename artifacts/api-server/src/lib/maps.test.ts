import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { transformSync } from "esbuild";
import { roadRoute } from "./roadRoute.js";

const fakeFetch = (data: object) => (async () => new Response(JSON.stringify(data))) as typeof fetch;

test("confirmed road route uses driving distance and duration", async () => {
  const route = await roadRoute(30,75,31,76,fakeFetch({
    status:"OK",routes:[{legs:[{distance:{value:12500},duration:{value:1800}}]}],
  }),"test-key");
  assert.deepEqual(route,{distanceKm:12.5,durationMin:30});
});
test("failed road route never produces an invented distance", async () => {
  for(const status of ["REQUEST_DENIED","ZERO_RESULTS","OVER_QUERY_LIMIT"]) {
    await assert.rejects(roadRoute(30,75,31,76,fakeFetch({status}),"test-key"));
  }
});
test("invalid coordinates never reach Google", async () => {
  await assert.rejects(roadRoute(NaN,75,31,76,(() => { throw new Error("Must not call"); }) as any,"test-key"),/Invalid/);
});

async function mapsEndpoint(path: string, query: object, upstream: object) {
  const module = {exports:{} as any};
  const requireLocal = createRequire(import.meta.url);
  const code = transformSync(readFileSync(new URL("../routes/maps.ts",import.meta.url),"utf8"),{loader:"ts",format:"cjs"}).code;
  runInNewContext(code,{
    module,exports:module.exports,require:requireLocal,URLSearchParams,
    process:{env:{GOOGLE_MAPS_API_KEY:"test-key"}},fetch:fakeFetch(upstream),
  });
  const route = module.exports.default.stack.find((entry:any)=>entry.route?.path===path).route;
  let status=200; let body:any;
  const res={setHeader:()=>{},status:(s:number)=>{status=s;return res;},json:(data:any)=>{body=data;}};
  await route.stack[0].handle({query,log:{warn:()=>{},error:()=>{}}},res);
  return {status,body};
}
test("Google denial is a service error, not an empty successful search",async()=>{
  const result=await mapsEndpoint("/places",{q:"Chandigarh"},{status:"REQUEST_DENIED",error_message:"Billing disabled"});
  assert.equal(result.status,503);
  assert.ok(result.body.error);
  assert.equal(result.body.predictions,undefined);
});
test("place details keep the full address including house and postal code",async()=>{
  const address="1972, Example Road, Ludhiana, Punjab 141001, India";
  const result=await mapsEndpoint("/place-details",{place_id:"example"},{status:"OK",result:{
    formatted_address:address,geometry:{location:{lat:30.9,lng:75.85}},address_components:[],
  }});
  assert.equal(result.status,200);
  assert.equal(result.body.formatted_address,address);
});
test("shared map bridge generates valid JavaScript and guards stale routes",()=>{
  const file=readFileSync(new URL("../../../mobile/components/rides/LeafletMapView.web.tsx",import.meta.url),"utf8");
  const fn=file.slice(file.indexOf("export function buildGoogleMapHtml"),file.indexOf("function buildLeafletMapHtml"));
  const module={exports:{} as any};
  runInNewContext(transformSync(fn,{loader:"ts",format:"cjs"}).code,{module,exports:module.exports});
  const html=module.exports.buildGoogleMapHtml(30,75,"test-key");
  const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(()=>new Function(script));
  assert.match(script,/version!==routeVersion/);
  assert.doesNotMatch(script,/Math\.atan2/);
  assert.match(script,/gm_authFailure/);
});
