// RentZilla App Store Screenshot Generator
// Access via /preview/RentZilla?screen=1 through ?screen=10
// Designed at 1242×2688px (iPhone 6.5" 3x retina) — all values are 3× real UI values.

const W = 1242;
const H = 2688;

const ORANGE = "#FF7A18";
const ORANGE2 = "#FF9F43";
const NAVY = "#0F1F3D";
const BG = "#F4F6FA";
const WHITE = "#FFFFFF";
const GRAY = "#8A94A6";
const CARD = "#FFFFFF";

const grad = `linear-gradient(135deg, ${ORANGE} 0%, ${ORANGE2} 100%)`;
const navyGrad = `linear-gradient(180deg, ${NAVY} 0%, #1a3360 100%)`;

function StatusBar({ light = false }) {
  const c = light ? WHITE : NAVY;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 60px", height: "120px", background: "transparent" }}>
      <span style={{ color: c, fontSize: "42px", fontWeight: 700 }}>9:41</span>
      <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
        <svg width="60" height="42" viewBox="0 0 24 17" fill={c}><rect x="0" y="5" width="3" height="12" rx="1"/><rect x="5" y="3" width="3" height="14" rx="1"/><rect x="10" y="1" width="3" height="16" rx="1"/><rect x="15" y="0" width="3" height="17" rx="1"/></svg>
        <svg width="54" height="42" viewBox="0 0 24 17" fill={c}><path d="M12 3.5C8.7 3.5 5.7 4.8 3.5 7L12 16 20.5 7C18.3 4.8 15.3 3.5 12 3.5z"/></svg>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "60px", height: "30px", border: `3px solid ${c}`, borderRadius: "9px", padding: "3px" }}>
            <div style={{ width: "80%", height: "100%", background: c, borderRadius: "6px" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function HomeIndicator({ light = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "center", paddingBottom: "36px", paddingTop: "18px" }}>
      <div style={{ width: "234px", height: "12px", background: light ? "rgba(255,255,255,0.5)" : "rgba(15,31,61,0.25)", borderRadius: "6px" }} />
    </div>
  );
}

function TabBar({ active }: { active: number }) {
  const tabs = [
    { icon: "🏠", label: "Browse" },
    { icon: "🚗", label: "Cars" },
    { icon: "💬", label: "Chats" },
    { icon: "❤️", label: "Saved" },
    { icon: "👤", label: "Profile" },
  ];
  return (
    <div style={{ display: "flex", background: WHITE, borderTop: "2px solid #EEF1F7", paddingTop: "24px" }}>
      {tabs.map((t, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "9px" }}>
          <span style={{ fontSize: "54px" }}>{t.icon}</span>
          <span style={{ fontSize: "30px", color: i === active ? ORANGE : GRAY, fontWeight: i === active ? 700 : 400 }}>{t.label}</span>
          {i === active && <div style={{ width: "48px", height: "6px", background: ORANGE, borderRadius: "3px" }} />}
        </div>
      ))}
    </div>
  );
}

function ListingCard({ title, price, unit, location, rating, image, badge }: any) {
  return (
    <div style={{ background: CARD, borderRadius: "36px", overflow: "hidden", boxShadow: "0 6px 40px rgba(15,31,61,0.10)", margin: "0 0 36px 0" }}>
      <div style={{ width: "100%", height: "360px", background: image, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {badge && <div style={{ position: "absolute", top: "24px", left: "24px", background: grad, borderRadius: "18px", padding: "9px 24px", color: WHITE, fontSize: "30px", fontWeight: 700 }}>{badge}</div>}
        <div style={{ position: "absolute", top: "24px", right: "24px", background: "rgba(255,255,255,0.95)", borderRadius: "50%", width: "72px", height: "72px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>❤️</div>
      </div>
      <div style={{ padding: "36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: "42px", fontWeight: 700, color: NAVY, marginBottom: "9px" }}>{title}</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: GRAY, fontSize: "33px" }}>
              <span>📍</span><span>{location}</span>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "48px", fontWeight: 800, color: ORANGE }}>₹{price}</div>
            <div style={{ fontSize: "30px", color: GRAY }}>/{unit}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "18px" }}>
          <span style={{ fontSize: "33px", color: "#FFB800" }}>★★★★★</span>
          <span style={{ fontSize: "33px", color: GRAY }}>{rating} (48)</span>
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 1: Welcome / Login ──────────────────────────────────────────────────
function Screen1() {
  return (
    <div style={{ width: W, height: H, background: navyGrad, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <StatusBar light />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 90px 0" }}>
        <div style={{ marginTop: "120px", marginBottom: "60px" }}>
          <div style={{ width: "240px", height: "240px", background: grad, borderRadius: "60px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "120px", margin: "0 auto 36px", boxShadow: "0 24px 80px rgba(255,122,24,0.5)" }}>🚜</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "108px", fontWeight: 900, color: WHITE, letterSpacing: "-2px" }}>RentZilla</div>
            <div style={{ fontSize: "42px", color: ORANGE2, fontWeight: 500, marginTop: "12px" }}>Rent Anything. Anytime.</div>
            <div style={{ fontSize: "36px", color: "rgba(255,255,255,0.6)", marginTop: "18px" }}>Punjab's #1 Rental Marketplace</div>
          </div>
        </div>

        <div style={{ width: "100%", marginTop: "120px" }}>
          <div style={{ width: "100%", height: "129px", background: "rgba(255,255,255,0.12)", border: "3px solid rgba(255,255,255,0.25)", borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "24px", marginBottom: "30px" }}>
            <span style={{ fontSize: "54px" }}>🍎</span>
            <span style={{ color: WHITE, fontSize: "42px", fontWeight: 600 }}>Continue with Apple</span>
          </div>
          <div style={{ width: "100%", height: "129px", background: "rgba(255,255,255,0.12)", border: "3px solid rgba(255,255,255,0.25)", borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", gap: "24px", marginBottom: "30px" }}>
            <span style={{ fontSize: "54px" }}>🔵</span>
            <span style={{ color: WHITE, fontSize: "42px", fontWeight: 600 }}>Continue with Google</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "30px", margin: "36px 0" }}>
            <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.2)" }} />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "36px" }}>or</span>
            <div style={{ flex: 1, height: "3px", background: "rgba(255,255,255,0.2)" }} />
          </div>
          <div style={{ width: "100%", height: "129px", background: grad, borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 60px rgba(255,122,24,0.4)" }}>
            <span style={{ color: WHITE, fontSize: "45px", fontWeight: 700 }}>Sign in with Email</span>
          </div>
          <div style={{ textAlign: "center", marginTop: "48px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "33px" }}>New to RentZilla? </span>
            <span style={{ color: ORANGE2, fontSize: "33px", fontWeight: 700 }}>Create Account</span>
          </div>
        </div>
      </div>
      <HomeIndicator light />
    </div>
  );
}

// ── SCREEN 2: Home Browse ──────────────────────────────────────────────────────
function Screen2() {
  const categories = ["🚜 Tractors", "🚗 Cars", "🏗️ JCB", "💇 Beauty", "⚡ Electric", "🔧 Plumber", "🌾 Harvester", "🌀 Rotavator"];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: WHITE }}>
        <StatusBar />
        <div style={{ padding: "30px 60px 36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <div>
              <div style={{ fontSize: "33px", color: GRAY }}>Good Morning 👋</div>
              <div style={{ fontSize: "54px", fontWeight: 800, color: NAVY }}>Gurpreet Singh</div>
            </div>
            <div style={{ width: "108px", height: "108px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>👤</div>
          </div>
          <div style={{ background: "#F4F6FA", borderRadius: "27px", padding: "33px 42px", display: "flex", alignItems: "center", gap: "24px" }}>
            <span style={{ fontSize: "42px" }}>🔍</span>
            <span style={{ fontSize: "39px", color: GRAY }}>Search equipment, services...</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: "18px", padding: "0 60px 36px", overflowX: "hidden" }}>
          {["All", "Tractors", "Cars", "Equipment", "Labor", "Beauty"].map((c, i) => (
            <div key={c} style={{ background: i === 0 ? grad : "transparent", border: i === 0 ? "none" : `3px solid ${ORANGE}`, borderRadius: "60px", padding: "18px 39px", whiteSpace: "nowrap" }}>
              <span style={{ color: i === 0 ? WHITE : ORANGE, fontSize: "33px", fontWeight: 600 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "hidden", padding: "36px 60px" }}>
        <div style={{ fontSize: "48px", fontWeight: 800, color: NAVY, marginBottom: "30px" }}>Featured Near You</div>
        <ListingCard title="John Deere 5050D" price="1,200" unit="day" location="Ludhiana, Punjab" rating="4.9" image="linear-gradient(135deg,#e8f4e8,#c8e6c8)" badge="Top Rated" />
        <ListingCard title="Mahindra 475 DI" price="900" unit="day" location="Amritsar, Punjab" rating="4.7" image="linear-gradient(135deg,#fff3e0,#ffe0b2)" badge="" />
        <div style={{ fontSize: "48px", fontWeight: 800, color: NAVY, margin: "30px 0" }}>Categories</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "24px" }}>
          {categories.map((c, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: "27px", padding: "30px 18px", textAlign: "center", boxShadow: "0 3px 20px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "54px" }}>{c.split(" ")[0]}</div>
              <div style={{ fontSize: "27px", color: NAVY, fontWeight: 600, marginTop: "12px" }}>{c.split(" ").slice(1).join(" ")}</div>
            </div>
          ))}
        </div>
      </div>
      <TabBar active={0} />
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 3: Listing Detail ───────────────────────────────────────────────────
function Screen3() {
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ height: "660px", background: "linear-gradient(135deg, #d4edda, #a8d5a2)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10 }}>
          <StatusBar light />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "0 60px" }}>
            <div style={{ width: "96px", height: "96px", background: "rgba(255,255,255,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>←</div>
            <div style={{ width: "96px", height: "96px", background: "rgba(255,255,255,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>❤️</div>
          </div>
        </div>
        <span style={{ fontSize: "240px" }}>🚜</span>
        <div style={{ position: "absolute", bottom: "30px", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "12px" }}>
          {[1,2,3,4].map(i => <div key={i} style={{ width: i===1?"48px":"18px", height: "18px", background: i===1?ORANGE:"rgba(255,255,255,0.6)", borderRadius: "9px" }} />)}
        </div>
      </div>

      <div style={{ flex: 1, background: WHITE, borderRadius: "60px 60px 0 0", marginTop: "-60px", padding: "60px", overflowY: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
          <div>
            <div style={{ fontSize: "54px", fontWeight: 800, color: NAVY }}>John Deere 5050D</div>
            <div style={{ fontSize: "36px", color: GRAY, marginTop: "9px" }}>📍 Ludhiana, Punjab · 4.2 km away</div>
          </div>
          <div>
            <div style={{ fontSize: "60px", fontWeight: 900, color: ORANGE }}>₹1,200</div>
            <div style={{ fontSize: "30px", color: GRAY, textAlign: "right" }}>/day</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "18px", marginBottom: "42px" }}>
          {["★ 4.9", "48 Reviews", "Verified"].map((tag, i) => (
            <div key={i} style={{ background: i<2?"#FFF3E8":"#E8F8F0", borderRadius: "18px", padding: "15px 30px" }}>
              <span style={{ color: i<2?ORANGE:"#27ae60", fontSize: "33px", fontWeight: 600 }}>{tag}</span>
            </div>
          ))}
        </div>

        <div style={{ fontSize: "39px", fontWeight: 700, color: NAVY, marginBottom: "18px" }}>About</div>
        <div style={{ fontSize: "36px", color: GRAY, lineHeight: 1.6, marginBottom: "42px" }}>
          50 HP diesel tractor in excellent condition. Available with experienced operator. Ideal for wheat, paddy & sugarcane farming in Punjab. Full insurance covered.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "42px" }}>
          {[["⛽", "Diesel", "Fuel Type"], ["🔧", "50 HP", "Power"], ["📅", "2022", "Year"], ["⏱️", "With Driver", "Option"]].map(([icon, val, label]) => (
            <div key={label} style={{ background: BG, borderRadius: "27px", padding: "36px", display: "flex", gap: "24px", alignItems: "center" }}>
              <span style={{ fontSize: "48px" }}>{icon}</span>
              <div>
                <div style={{ fontSize: "39px", fontWeight: 700, color: NAVY }}>{val}</div>
                <div style={{ fontSize: "30px", color: GRAY }}>{label}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", height: "129px", background: grad, borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 60px rgba(255,122,24,0.35)" }}>
          <span style={{ color: WHITE, fontSize: "48px", fontWeight: 700 }}>Book Now</span>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 4: Booking Calendar ─────────────────────────────────────────────────
function Screen4() {
  const days = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  const cal = [
    [null,null,1,2,3,4,5],
    [6,7,8,9,10,11,12],
    [13,14,15,16,17,18,19],
    [20,21,22,23,24,25,26],
    [27,28,29,30,31,null,null]
  ];
  const selected = [15,16,17,18];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: WHITE }}>
        <StatusBar />
        <div style={{ padding: "0 60px 36px", display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ width: "84px", height: "84px", background: BG, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "42px" }}>←</div>
          <div style={{ fontSize: "54px", fontWeight: 800, color: NAVY }}>Select Dates</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "36px 60px", overflowY: "hidden" }}>
        <div style={{ background: WHITE, borderRadius: "42px", padding: "48px", marginBottom: "36px", boxShadow: "0 6px 40px rgba(0,0,0,0.07)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "48px" }}>
            <span style={{ fontSize: "48px" }}>‹</span>
            <span style={{ fontSize: "48px", fontWeight: 700, color: NAVY }}>July 2025</span>
            <span style={{ fontSize: "48px" }}>›</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", marginBottom: "24px" }}>
            {days.map(d => <div key={d} style={{ textAlign: "center", fontSize: "33px", color: GRAY, fontWeight: 600, padding: "12px 0" }}>{d}</div>)}
          </div>
          {cal.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "12px", marginBottom: "12px" }}>
              {week.map((day, di) => {
                const isSel = day && selected.includes(day);
                const isStart = day === 15;
                const isEnd = day === 18;
                return (
                  <div key={di} style={{
                    height: "108px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isSel ? (isStart||isEnd ? grad : "#FFF0E5") : "transparent",
                    borderRadius: isStart ? "54px 0 0 54px" : isEnd ? "0 54px 54px 0" : isSel ? "0" : "54px",
                  }}>
                    {day && <span style={{ fontSize: "39px", fontWeight: isSel ? 700 : 400, color: isStart||isEnd ? WHITE : isSel ? ORANGE : NAVY }}>{day}</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ background: WHITE, borderRadius: "42px", padding: "48px", boxShadow: "0 6px 40px rgba(0,0,0,0.07)", marginBottom: "36px" }}>
          <div style={{ fontSize: "42px", fontWeight: 700, color: NAVY, marginBottom: "36px" }}>Booking Summary</div>
          {[["📅", "Check-in", "July 15, 2025"], ["📅", "Check-out", "July 18, 2025"], ["⏱️", "Duration", "4 Days"], ["💰", "Daily Rate", "₹1,200"]].map(([icon, label, val]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 0", borderBottom: "2px solid #F4F6FA" }}>
              <div style={{ display: "flex", gap: "18px", alignItems: "center" }}>
                <span style={{ fontSize: "42px" }}>{icon}</span>
                <span style={{ fontSize: "36px", color: GRAY }}>{label}</span>
              </div>
              <span style={{ fontSize: "36px", fontWeight: 600, color: NAVY }}>{val}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "30px" }}>
            <span style={{ fontSize: "42px", fontWeight: 700, color: NAVY }}>Total</span>
            <span style={{ fontSize: "54px", fontWeight: 900, color: ORANGE }}>₹4,800</span>
          </div>
        </div>

        <div style={{ width: "100%", height: "129px", background: grad, borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 60px rgba(255,122,24,0.35)" }}>
          <span style={{ color: WHITE, fontSize: "48px", fontWeight: 700 }}>Confirm Booking · ₹4,800</span>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 5: Cars Tab (Map View) ─────────────────────────────────────────────
function Screen5() {
  const cars = [
    { name: "Maruti Swift", price: "₹800/day", rating: "4.8", x: 300, y: 500 },
    { name: "Hyundai i20", price: "₹950/day", rating: "4.7", x: 700, y: 400 },
    { name: "Toyota Innova", price: "₹2,200/day", rating: "4.9", x: 900, y: 700 },
    { name: "Honda City", price: "₹1,100/day", rating: "4.6", x: 400, y: 800 },
  ];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: NAVY, position: "relative" }}>
        <StatusBar light />
        <div style={{ padding: "0 60px 36px" }}>
          <div style={{ fontSize: "54px", fontWeight: 800, color: WHITE, marginBottom: "24px" }}>Cars Near You 🚗</div>
          <div style={{ background: "rgba(255,255,255,0.15)", borderRadius: "27px", padding: "33px 42px", display: "flex", alignItems: "center", gap: "24px" }}>
            <span style={{ fontSize: "42px" }}>🔍</span>
            <span style={{ fontSize: "39px", color: "rgba(255,255,255,0.6)" }}>Search cars, SUVs, trucks...</span>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #e8f4e8 0%, #d4edda 50%, #c8e6c8 100%)", position: "relative" }}>
          <div style={{ position: "absolute", inset: 0, backgroundImage: "repeating-linear-gradient(0deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 2px, transparent 2px, transparent 60px), repeating-linear-gradient(90deg, rgba(0,0,0,0.04) 0px, rgba(0,0,0,0.04) 2px, transparent 2px, transparent 60px)" }} />
          {[{x:150,y:200,w:800,h:30},{x:500,y:0,w:30,h:600},{x:200,y:900,w:600,h:30},{x:100,y:600,w:30,h:400}].map((r,i)=>(
            <div key={i} style={{ position: "absolute", left: r.x, top: r.y, width: r.w, height: r.h, background: "#c8c8c8", borderRadius: "4px" }} />
          ))}
          {cars.map((c, i) => (
            <div key={i} style={{ position: "absolute", left: c.x, top: c.y, transform: "translate(-50%,-50%)" }}>
              <div style={{ background: i===2 ? grad : WHITE, borderRadius: "30px", padding: "18px 27px", boxShadow: "0 6px 24px rgba(0,0,0,0.2)", whiteSpace: "nowrap", border: i===2?"none":`3px solid ${ORANGE}` }}>
                <div style={{ fontSize: "33px", fontWeight: 700, color: i===2?WHITE:NAVY }}>{c.price}</div>
              </div>
              <div style={{ width: "24px", height: "24px", background: i===2?ORANGE:WHITE, transform: "rotate(45deg)", margin: "-12px auto 0", border: i===2?"none":`3px solid ${ORANGE}` }} />
            </div>
          ))}
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }}>
            <div style={{ width: "60px", height: "60px", background: ORANGE, borderRadius: "50%", border: "6px solid WHITE", boxShadow: "0 0 0 18px rgba(255,122,24,0.2)" }} />
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: WHITE, borderRadius: "60px 60px 0 0", padding: "48px 60px 0" }}>
          <div style={{ width: "90px", height: "12px", background: "#ddd", borderRadius: "6px", margin: "0 auto 48px" }} />
          <div style={{ fontSize: "42px", fontWeight: 700, color: NAVY, marginBottom: "36px" }}>24 Cars Available</div>
          <div style={{ display: "flex", gap: "36px", overflowX: "hidden" }}>
            {cars.map((c, i) => (
              <div key={i} style={{ background: BG, borderRadius: "27px", padding: "30px", minWidth: "330px" }}>
                <div style={{ fontSize: "48px", marginBottom: "18px" }}>🚗</div>
                <div style={{ fontSize: "36px", fontWeight: 700, color: NAVY }}>{c.name}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "12px" }}>
                  <span style={{ fontSize: "33px", color: ORANGE, fontWeight: 700 }}>{c.price}</span>
                  <span style={{ fontSize: "33px", color: GRAY }}>★ {c.rating}</span>
                </div>
              </div>
            ))}
          </div>
          <TabBar active={1} />
          <HomeIndicator />
        </div>
      </div>
    </div>
  );
}

// ── SCREEN 6: Chat ─────────────────────────────────────────────────────────────
function Screen6() {
  const msgs = [
    { me: false, text: "Hello! Is the tractor available for July 15-18?", time: "10:32 AM" },
    { me: true, text: "Yes, it is available! Would you like to book it?", time: "10:34 AM" },
    { me: false, text: "Great! What is included in the price?", time: "10:35 AM" },
    { me: true, text: "₹1,200/day includes diesel, insurance, and experienced driver. No hidden charges.", time: "10:36 AM" },
    { me: false, text: "Perfect! Can I get a discount for 4 days?", time: "10:38 AM" },
    { me: true, text: "For 4+ days I can offer ₹1,000/day. Total would be ₹4,000.", time: "10:39 AM" },
    { me: false, text: "Deal! Let me proceed with booking now.", time: "10:41 AM" },
  ];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: WHITE, boxShadow: "0 3px 20px rgba(0,0,0,0.06)" }}>
        <StatusBar />
        <div style={{ padding: "0 60px 36px", display: "flex", alignItems: "center", gap: "30px" }}>
          <div style={{ width: "84px", height: "84px", background: BG, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "42px" }}>←</div>
          <div style={{ width: "108px", height: "108px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "54px" }}>👨‍🌾</div>
          <div>
            <div style={{ fontSize: "42px", fontWeight: 700, color: NAVY }}>Harjit Singh</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "18px", height: "18px", background: "#27ae60", borderRadius: "50%" }} />
              <span style={{ fontSize: "30px", color: "#27ae60" }}>Online</span>
            </div>
          </div>
          <div style={{ marginLeft: "auto", fontSize: "48px" }}>📞</div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "36px 60px", overflowY: "hidden" }}>
        <div style={{ textAlign: "center", marginBottom: "42px" }}>
          <span style={{ background: "#EEF1F7", borderRadius: "18px", padding: "15px 36px", fontSize: "30px", color: GRAY }}>Today — July 14, 2025</span>
        </div>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.me ? "flex-end" : "flex-start", marginBottom: "24px" }}>
            {!m.me && <div style={{ width: "72px", height: "72px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px", marginRight: "18px", flexShrink: 0 }}>👨‍🌾</div>}
            <div style={{ maxWidth: "70%" }}>
              <div style={{ background: m.me ? grad : WHITE, borderRadius: m.me ? "36px 36px 6px 36px" : "36px 36px 36px 6px", padding: "30px 36px", boxShadow: "0 3px 15px rgba(0,0,0,0.08)" }}>
                <div style={{ fontSize: "36px", color: m.me ? WHITE : NAVY, lineHeight: 1.5 }}>{m.text}</div>
              </div>
              <div style={{ fontSize: "27px", color: GRAY, marginTop: "9px", textAlign: m.me ? "right" : "left" }}>{m.time} {m.me && "✓✓"}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: WHITE, padding: "24px 60px", borderTop: "2px solid #EEF1F7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <div style={{ flex: 1, background: BG, borderRadius: "60px", padding: "33px 42px", fontSize: "36px", color: GRAY }}>Message Harjit...</div>
          <div style={{ width: "108px", height: "108px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>➤</div>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 7: My Bookings ──────────────────────────────────────────────────────
function Screen7() {
  const bookings = [
    { icon: "🚜", name: "John Deere 5050D", dates: "Jul 15 – Jul 18", price: "₹4,800", status: "Active", color: "#27ae60" },
    { icon: "🚗", name: "Maruti Swift Dzire", dates: "Jun 20 – Jun 22", price: "₹1,600", status: "Completed", color: GRAY },
    { icon: "🏗️", name: "JCB 3DX Excavator", dates: "Jun 5 – Jun 7", price: "₹15,000", status: "Completed", color: GRAY },
    { icon: "💇", name: "Beauty Services", dates: "May 30", price: "₹2,000", status: "Completed", color: GRAY },
  ];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: WHITE }}>
        <StatusBar />
        <div style={{ padding: "0 60px 36px" }}>
          <div style={{ fontSize: "60px", fontWeight: 800, color: NAVY }}>My Bookings</div>
          <div style={{ display: "flex", gap: "18px", marginTop: "30px" }}>
            {["All", "Active", "Completed", "Cancelled"].map((tab, i) => (
              <div key={tab} style={{ background: i===0?grad:"transparent", border: i===0?"none":`3px solid ${ORANGE}`, borderRadius: "60px", padding: "18px 39px" }}>
                <span style={{ color: i===0?WHITE:ORANGE, fontSize: "33px", fontWeight: 600 }}>{tab}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "36px 60px", overflowY: "hidden" }}>
        {bookings.map((b, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: "36px", padding: "42px", marginBottom: "30px", boxShadow: "0 6px 30px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: "30px" }}>
            <div style={{ width: "132px", height: "132px", background: BG, borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "72px" }}>{b.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "39px", fontWeight: 700, color: NAVY }}>{b.name}</div>
              <div style={{ fontSize: "33px", color: GRAY, marginTop: "9px" }}>📅 {b.dates}</div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px" }}>
                <span style={{ fontSize: "42px", fontWeight: 800, color: ORANGE }}>{b.price}</span>
                <div style={{ background: b.status==="Active"?"#E8F8F0":"#F4F6FA", borderRadius: "18px", padding: "12px 27px" }}>
                  <span style={{ color: b.color, fontSize: "30px", fontWeight: 600 }}>{b.status}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <TabBar active={4} />
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 8: Favorites ────────────────────────────────────────────────────────
function Screen8() {
  const favs = [
    { icon: "🚜", name: "Mahindra 475 DI", price: "₹900/day", loc: "Amritsar", rating: "4.7" },
    { icon: "🚗", name: "Hyundai Creta", price: "₹1,400/day", loc: "Ludhiana", rating: "4.8" },
    { icon: "🌾", name: "Claas Harvester", price: "₹3,500/day", loc: "Patiala", rating: "4.9" },
    { icon: "⚡", name: "Electrician Pro", price: "₹450/visit", loc: "Jalandhar", rating: "4.6" },
  ];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: WHITE }}>
        <StatusBar />
        <div style={{ padding: "0 60px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: "60px", fontWeight: 800, color: NAVY }}>Saved ❤️</div>
            <div style={{ fontSize: "36px", color: GRAY, marginTop: "9px" }}>4 items saved</div>
          </div>
          <div style={{ fontSize: "39px", color: ORANGE, fontWeight: 600 }}>Sort</div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "36px 60px", overflowY: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
          {favs.map((f, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: "36px", overflow: "hidden", boxShadow: "0 6px 30px rgba(0,0,0,0.08)" }}>
              <div style={{ height: "270px", background: i%2===0?"linear-gradient(135deg,#e8f4e8,#a8d5a2)":"linear-gradient(135deg,#fff3e0,#ffe0b2)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                <span style={{ fontSize: "120px" }}>{f.icon}</span>
                <div style={{ position: "absolute", top: "18px", right: "18px", background: WHITE, borderRadius: "50%", width: "72px", height: "72px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>❤️</div>
              </div>
              <div style={{ padding: "30px" }}>
                <div style={{ fontSize: "36px", fontWeight: 700, color: NAVY }}>{f.name}</div>
                <div style={{ fontSize: "30px", color: GRAY, marginTop: "9px" }}>📍 {f.loc}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "18px" }}>
                  <span style={{ fontSize: "36px", fontWeight: 800, color: ORANGE }}>{f.price}</span>
                  <span style={{ fontSize: "30px", color: "#FFB800" }}>★ {f.rating}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background: WHITE, borderRadius: "36px", padding: "42px", marginTop: "36px", display: "flex", alignItems: "center", gap: "30px", boxShadow: "0 6px 30px rgba(0,0,0,0.06)" }}>
          <span style={{ fontSize: "60px" }}>🔧</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "39px", fontWeight: 700, color: NAVY }}>Plumber Expert</div>
            <div style={{ fontSize: "33px", color: GRAY }}>📍 Bathinda · ★ 4.8</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "42px", fontWeight: 800, color: ORANGE }}>₹500</div>
            <div style={{ fontSize: "30px", color: GRAY }}>/visit</div>
          </div>
        </div>
      </div>
      <TabBar active={3} />
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 9: Provider Dashboard ──────────────────────────────────────────────
function Screen9() {
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column" }}>
      <div style={{ background: navyGrad, padding: "0 60px 60px" }}>
        <StatusBar light />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "42px" }}>
          <div>
            <div style={{ fontSize: "36px", color: "rgba(255,255,255,0.6)" }}>Provider Dashboard</div>
            <div style={{ fontSize: "54px", fontWeight: 800, color: WHITE }}>Harjit Singh</div>
          </div>
          <div style={{ width: "120px", height: "120px", background: "rgba(255,255,255,0.15)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "60px" }}>👨‍🌾</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px" }}>
          {[["₹48,200", "This Month"], ["24", "Bookings"], ["4.9 ★", "Rating"]].map(([val, label]) => (
            <div key={label} style={{ background: "rgba(255,255,255,0.12)", borderRadius: "27px", padding: "36px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", fontWeight: 800, color: WHITE }}>{val}</div>
              <div style={{ fontSize: "30px", color: "rgba(255,255,255,0.6)", marginTop: "9px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, padding: "36px 60px", overflowY: "hidden" }}>
        <div style={{ fontSize: "48px", fontWeight: 800, color: NAVY, marginBottom: "30px" }}>Upcoming Bookings</div>
        {[
          { name: "Gurpreet S.", item: "John Deere 5050D", dates: "Jul 15-18", amount: "₹4,800" },
          { name: "Amanjot K.", item: "John Deere 5050D", dates: "Jul 20-22", amount: "₹3,600" },
          { name: "Sukhwinder M.", item: "John Deere 5050D", dates: "Jul 25-27", amount: "₹3,000" },
        ].map((b, i) => (
          <div key={i} style={{ background: WHITE, borderRadius: "30px", padding: "36px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "24px", boxShadow: "0 6px 24px rgba(0,0,0,0.06)" }}>
            <div style={{ width: "96px", height: "96px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>👤</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "39px", fontWeight: 700, color: NAVY }}>{b.name}</div>
              <div style={{ fontSize: "33px", color: GRAY }}>{b.item} · {b.dates}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "42px", fontWeight: 800, color: ORANGE }}>{b.amount}</div>
              <div style={{ background: "#E8F8F0", borderRadius: "15px", padding: "9px 21px", marginTop: "9px" }}>
                <span style={{ color: "#27ae60", fontSize: "27px", fontWeight: 600 }}>Confirmed</span>
              </div>
            </div>
          </div>
        ))}

        <div style={{ background: WHITE, borderRadius: "30px", padding: "42px", boxShadow: "0 6px 24px rgba(0,0,0,0.06)", marginTop: "12px" }}>
          <div style={{ fontSize: "42px", fontWeight: 700, color: NAVY, marginBottom: "30px" }}>Earnings Overview</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "18px", height: "240px" }}>
            {[60,80,45,90,70,100,85].map((h, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "100%", height: `${h*2.4}px`, background: i===5?grad:"#F0F4FF", borderRadius: "12px 12px 0 0" }} />
                <span style={{ fontSize: "27px", color: GRAY }}>{"SMTWTFS"[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}

// ── SCREEN 10: Gold Membership ─────────────────────────────────────────────────
function Screen10() {
  const perks = [
    { icon: "🎯", title: "Priority Listings", desc: "Your listings appear at the top" },
    { icon: "💰", title: "Zero Commission", desc: "Keep 100% of your earnings" },
    { icon: "📊", title: "Advanced Analytics", desc: "Detailed booking & revenue reports" },
    { icon: "🎁", title: "Exclusive Discounts", desc: "Up to 25% off on all rentals" },
    { icon: "🎰", title: "Wheel of Fortune", desc: "Daily spins for cash rewards" },
    { icon: "👥", title: "Refer & Earn", desc: "₹500 per successful referral" },
  ];
  return (
    <div style={{ width: W, height: H, background: BG, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ background: navyGrad, padding: "0 60px 60px" }}>
        <StatusBar light />
        <div style={{ textAlign: "center" }}>
          <div style={{ width: "180px", height: "180px", background: grad, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "96px", margin: "0 auto 30px", boxShadow: "0 18px 60px rgba(255,159,67,0.5)" }}>👑</div>
          <div style={{ fontSize: "72px", fontWeight: 900, color: WHITE }}>Gold Membership</div>
          <div style={{ fontSize: "42px", color: ORANGE2, marginTop: "12px" }}>Unlock Premium Benefits</div>
          <div style={{ marginTop: "48px", background: "rgba(255,255,255,0.1)", borderRadius: "42px", padding: "42px 60px", display: "inline-block" }}>
            <div style={{ fontSize: "42px", color: "rgba(255,255,255,0.6)", textDecoration: "line-through" }}>₹4,999/year</div>
            <div style={{ fontSize: "90px", fontWeight: 900, color: WHITE }}>₹2.49<span style={{ fontSize: "48px" }}>/year</span></div>
            <div style={{ background: grad, borderRadius: "18px", padding: "12px 30px", display: "inline-block", marginTop: "9px" }}>
              <span style={{ color: WHITE, fontSize: "33px", fontWeight: 700 }}>🔥 Limited Time — 95% OFF</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, padding: "48px 60px", overflowY: "hidden" }}>
        <div style={{ fontSize: "48px", fontWeight: 800, color: NAVY, marginBottom: "36px" }}>What You Get</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "48px" }}>
          {perks.map((p, i) => (
            <div key={i} style={{ background: WHITE, borderRadius: "30px", padding: "36px", boxShadow: "0 6px 24px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: "60px", marginBottom: "18px" }}>{p.icon}</div>
              <div style={{ fontSize: "36px", fontWeight: 700, color: NAVY }}>{p.title}</div>
              <div style={{ fontSize: "30px", color: GRAY, marginTop: "9px", lineHeight: 1.4 }}>{p.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ width: "100%", height: "129px", background: grad, borderRadius: "36px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 18px 60px rgba(255,122,24,0.4)", marginBottom: "24px" }}>
          <span style={{ color: WHITE, fontSize: "48px", fontWeight: 700 }}>Get Gold for ₹2.49/year 👑</span>
        </div>
        <div style={{ textAlign: "center", fontSize: "30px", color: GRAY }}>Cancel anytime · Secure payment via Razorpay</div>
      </div>
      <HomeIndicator />
    </div>
  );
}

const SCREENS: Record<number, () => JSX.Element> = {
  1: Screen1, 2: Screen2, 3: Screen3, 4: Screen4, 5: Screen5,
  6: Screen6, 7: Screen7, 8: Screen8, 9: Screen9, 10: Screen10,
};

export default function RentZilla() {
  const params = new URLSearchParams(window.location.search);
  const screen = parseInt(params.get("screen") || "1", 10);
  const Screen = SCREENS[screen] || Screen1;
  return (
    <div style={{ margin: 0, padding: 0, background: "#000", display: "flex", justifyContent: "center" }}>
      <Screen />
    </div>
  );
}
