import React, { useState, useEffect, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { Search, MapPin, Phone, Mail, Star, X, Filter, Circle, Loader2 } from "lucide-react";
import {
  OFFICES,
  INITIAL_STATUSES,
  INITIAL_GEOCODE,
  SPECIALTY_COLORS,
  STATUS_OPTIONS,
  STATUS_COLORS,
} from "./data";
import { supabase } from "./supabaseClient";

const STORAGE_KEY_CRM = "referral-map-crm-data";
const STORAGE_KEY_GEO = "referral-map-geocode-cache";

async function geocodeAddress(fullAddr) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=${encodeURIComponent(fullAddr)}`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error("geocode error", e);
  }
  return null;
}

function loadGeoCache() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GEO);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}


// Load all CRM rows from Supabase into a { [office_id]: data } map.
// Also seeds INITIAL_STATUSES for any office not yet present.
async function loadCrmData() {
  let crm = {};
  try {
    const { data, error } = await supabase.from("crm_data").select("office_id, data");
    if (error) throw error;
    for (const row of data) {
      crm[row.office_id] = row.data;
    }
  } catch (e) {
    console.error("Supabase load error, falling back to local cache", e);
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CRM);
      crm = raw ? JSON.parse(raw) : {};
    } catch (e2) {}
  }

  // Seed initial statuses for offices not yet in the database
  const toSeed = [];
  for (const [id, status] of Object.entries(INITIAL_STATUSES)) {
    const oid = Number(id);
    if (!crm[oid]) {
      crm[oid] = { status };
      toSeed.push({ office_id: oid, data: crm[oid] });
    } else if (!crm[oid].status) {
      crm[oid] = { ...crm[oid], status };
      toSeed.push({ office_id: oid, data: crm[oid] });
    }
  }
  if (toSeed.length > 0) {
    try {
      await supabase.from("crm_data").upsert(toSeed, { onConflict: "office_id" });
    } catch (e) {
      console.error("Supabase seed error", e);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY_CRM, JSON.stringify(crm));
  } catch (e) {}

  return crm;
}


function makeIcon(color, highlighted) {
  const size = highlighted ? 30 : 20;
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:2px solid white;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
      ${highlighted ? "outline:3px solid #facc15;" : ""}
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FlyToSelected({ selected, geocoded }) {
  const map = useMap();
  useEffect(() => {
    if (!selected || !geocoded[selected.id]) return;
    const { lat, lon } = geocoded[selected.id];
    map.flyTo([lat, lon], 15, { duration: 0.6 });
  }, [selected]);
  return null;
}

/* ====================== DETAIL PANEL ====================== */
function DetailPanel({ office, crm, onUpdateCrm, onClose }) {
  const [noteDraft, setNoteDraft] = useState("");
  const c = crm || {};

  const addNote = () => {
    if (!noteDraft.trim()) return;
    const entry = { date: new Date().toISOString().slice(0, 10), text: noteDraft.trim() };
    const notes = [entry, ...(c.notes || [])];
    onUpdateCrm(office.id, { ...c, notes });
    setNoteDraft("");
  };

  const setStatus = (status) => onUpdateCrm(office.id, { ...c, status });
  const setRating = (rating) => onUpdateCrm(office.id, { ...c, rating: c.rating === rating ? 0 : rating });
  const logVisit = () => {
    const visits = [new Date().toISOString().slice(0, 10), ...(c.visits || [])];
    onUpdateCrm(office.id, { ...c, visits, lastVisitLogged: visits[0] });
  };
  const setFollowUp = (date) => onUpdateCrm(office.id, { ...c, followUp: date });

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-[400px] bg-white shadow-2xl z-[1000] overflow-y-auto border-l border-stone-200 flex flex-col">
      <div className="sticky top-0 bg-white border-b border-stone-200 px-5 py-4 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-stone-400 mb-1">{office.specialty}</div>
          <h2 className="text-lg font-semibold text-stone-900 leading-tight">{office.office}</h2>
          <div className="text-sm text-stone-500 mt-0.5">{office.first} {office.last}{office.prof ? `, ${office.prof}` : ""}</div>
        </div>
        <button onClick={onClose} className="text-stone-400 hover:text-stone-700 p-1 -mr-1 -mt-1 rounded transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Contact info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2 text-stone-600">
            <MapPin size={16} className="mt-0.5 flex-shrink-0 text-stone-400" />
            <span>{office.addr}{office.suite ? `, ${office.suite}` : ""}, {office.city}, CA {office.zip}</span>
          </div>
          {office.phone && (
            <div className="flex items-center gap-2 text-stone-600">
              <Phone size={16} className="flex-shrink-0 text-stone-400" />
              <a href={`tel:${office.phone}`} className="hover:text-blue-600">{office.phone}</a>
            </div>
          )}
          {office.email && (
            <div className="flex items-center gap-2 text-stone-600">
              <Mail size={16} className="flex-shrink-0 text-stone-400" />
              <a href={`mailto:${office.email}`} className="hover:text-blue-600 truncate">{office.email}</a>
            </div>
          )}
        </div>

        {/* Referral history flags */}
        {(office.xmas25 || office.molarPromo || office.lastVisit || office.survey) && (
          <div className="flex flex-wrap gap-1.5">
            {office.xmas25 && <span className="text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Christmas 2025</span>}
            {office.molarPromo && <span className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">3rd Molar Promo</span>}
            {office.lastVisit && <span className="text-xs px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Last visit: {office.lastVisit}</span>}
            {office.survey && <span className="text-xs px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Survey</span>}
          </div>
        )}

        {/* Status */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Status</div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={
                  c.status === s
                    ? { background: STATUS_COLORS[s], color: "white", borderColor: STATUS_COLORS[s] }
                    : { borderColor: "#e7e5e4", color: "#78716c" }
                }
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Priority</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="text-amber-400 hover:scale-110 transition-transform">
                <Star size={22} fill={(c.rating || 0) >= n ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>

        {/* Follow up + visit logging */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Follow-up date</div>
            <input
              type="date"
              value={c.followUp || ""}
              onChange={(e) => setFollowUp(e.target.value)}
              className="w-full text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-1.5">Visits logged</div>
            <button
              onClick={logVisit}
              className="w-full text-sm border border-stone-200 rounded-lg px-2.5 py-1.5 hover:bg-stone-50 transition-colors text-left text-stone-600"
            >
              {(c.visits && c.visits.length) || 0} ‚Äî Log today
            </button>
          </div>
        </div>

        {/* Notes */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-2">Notes</div>
          <div className="flex gap-2 mb-3">
            <input
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              placeholder="Add a note..."
              className="flex-1 text-sm border border-stone-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            <button onClick={addNote} className="text-sm px-3 py-1.5 rounded-lg bg-stone-900 text-white hover:bg-stone-700 transition-colors">
              Add
            </button>
          </div>
          <div className="space-y-2">
            {(c.notes || []).length === 0 && <div className="text-sm text-stone-400">No notes yet.</div>}
            {(c.notes || []).map((n, i) => (
              <div key={i} className="text-sm bg-stone-50 rounded-lg px-3 py-2 border border-stone-100">
                <div className="text-xs text-stone-400 mb-0.5">{n.date}</div>
                <div className="text-stone-700">{n.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== MAIN APP ====================== */
export default function App() {
  const [crmData, setCrmData] = useState({});
  const [crmLoaded, setCrmLoaded] = useState(false);

  // Load CRM data from Supabase on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const crm = await loadCrmData();
      if (!cancelled) {
        setCrmData(crm);
        setCrmLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const [search, setSearch] = useState("");
  const [specialtyFilter, setSpecialtyFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  const [geocoded, setGeocoded] = useState(() => {
    const cache = loadGeoCache();
    return { ...INITIAL_GEOCODE, ...cache };
  });
  const [geoProgress, setGeoProgress] = useState({ done: 0, total: 0 });

  // Background geocoding for offices not yet precisely located
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cache = loadGeoCache();
      const merged = { ...INITIAL_GEOCODE, ...cache };
      // Only geocode offices that don't have a cached (precise) result yet
      const missing = OFFICES.filter((o) => !cache[o.id]);
      setGeoProgress({ done: 0, total: missing.length });
      for (let i = 0; i < missing.length; i++) {
        if (cancelled) return;
        const o = missing[i];
        const result = await geocodeAddress(o.fullAddr);
        if (result) {
          cache[o.id] = result;
          merged[o.id] = result;
          setGeocoded({ ...merged });
        }
        setGeoProgress({ done: i + 1, total: missing.length });
        if ((i + 1) % 10 === 0) {
          try { localStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(cache)); } catch (e) {}
        }
        await new Promise((r) => setTimeout(r, 1000)); // Nominatim rate limit: 1 req/sec
      }
      try { localStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(cache)); } catch (e) {}
    })();
    return () => { cancelled = true; };
  }, []);


  // Subscribe to realtime changes from other devices
  useEffect(() => {
    if (!crmLoaded) return;
    const channel = supabase
      .channel("crm_data_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "crm_data" },
        (payload) => {
          const row = payload.new;
          if (!row) return;
          setCrmData((prev) => {
            const next = { ...prev, [row.office_id]: row.data };
            try { localStorage.setItem(STORAGE_KEY_CRM, JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [crmLoaded]);

  const saveCrm = useCallback((next) => {
    setCrmData(next);
    try {
      localStorage.setItem(STORAGE_KEY_CRM, JSON.stringify(next));
    } catch (e) {
      console.error("Failed to save CRM data locally", e);
    }
  }, []);

  const updateCrm = (id, val) => {
    const next = { ...crmData, [id]: val };
    saveCrm(next);
    // Sync this office's data to Supabase
    supabase
      .from("crm_data")
      .upsert({ office_id: id, data: val, updated_at: new Date().toISOString() }, { onConflict: "office_id" })
      .then(({ error }) => {
        if (error) console.error("Supabase sync error", error);
      });
  };

  const specialties = useMemo(() => {
    const s = new Set(OFFICES.map((o) => o.specialty));
    return ["All", ...Array.from(s).sort()];
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return OFFICES.filter((o) => {
      if (specialtyFilter !== "All" && o.specialty !== specialtyFilter) return false;
      const status = (crmData[o.id] && crmData[o.id].status) || "Not Started";
      if (statusFilter !== "All" && status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${o.office} ${o.first} ${o.last} ${o.city} ${o.addr}`.toLowerCase();
      return hay.includes(q);
    });
  }, [search, specialtyFilter, statusFilter, crmData]);

  const mapped = useMemo(() => filtered.filter((o) => geocoded[o.id]), [filtered, geocoded]);

  const handleSelect = (office) => {
    setSelected(office);
  };

  // Center on North San Diego County
  const center = [33.18, -117.22];

  return (
    <div className="h-screen w-full flex flex-col bg-stone-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3 flex-shrink-0 z-[1100]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-stone-900 flex items-center justify-center">
            <MapPin size={16} className="text-white" />
          </div>
          <div>
            <div className="font-semibold text-stone-900 text-sm leading-tight">Referral Territory Map</div>
            <div className="text-xs text-stone-400">{OFFICES.length} offices ¬∑ {mapped.length} plotted</div>
          </div>
        </div>
        <div className="flex-1 max-w-md relative ml-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search office, dentist, or city..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          />
        </div>
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors ${showFilters ? "bg-stone-900 text-white border-stone-900" : "border-stone-200 text-stone-600 hover:bg-stone-50"}`}
        >
          <Filter size={14} /> Filters
        </button>
        {geoProgress.done < geoProgress.total && (
          <div className="flex items-center gap-1.5 text-xs text-stone-400 whitespace-nowrap">
            <Loader2 size={14} className="animate-spin" />
            Refining locations {geoProgress.done}/{geoProgress.total}
          </div>
        )}
      </header>

      {/* Filter bar */}
      {showFilters && (
        <div className="bg-white border-b border-stone-200 px-4 py-3 flex flex-wrap gap-4 items-center text-sm z-[1100]">
          <div>
            <span className="text-xs text-stone-400 mr-2">Specialty</span>
            <select value={specialtyFilter} onChange={(e) => setSpecialtyFilter(e.target.value)} className="border border-stone-200 rounded-lg px-2 py-1 text-sm">
              {specialties.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <span className="text-xs text-stone-400 mr-2">Status</span>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-stone-200 rounded-lg px-2 py-1 text-sm">
              <option value="All">All</option>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_OPTIONS.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border" style={{ borderColor: STATUS_COLORS[s], color: STATUS_COLORS[s] }}>
                <Circle size={8} fill="currentColor" /> {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* List */}
        <div className="w-[320px] flex-shrink-0 bg-white border-r border-stone-200 overflow-y-auto hidden md:block">
          {filtered.map((o) => {
            const c = crmData[o.id] || {};
            const status = c.status || "Not Started";
            return (
              <button
                key={o.id}
                onClick={() => handleSelect(o)}
                className={`w-full text-left px-4 py-3 border-b border-stone-100 hover:bg-stone-50 transition-colors ${selected && selected.id === o.id ? "bg-blue-50" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-stone-900 truncate">{o.office}</div>
                    <div className="text-xs text-stone-400 truncate">{o.first} {o.last}{o.prof ? `, ${o.prof}` : ""} ¬∑ {o.city}</div>
                  </div>
                  {c.rating > 0 && (
                    <div className="flex items-center gap-0.5 text-amber-400 flex-shrink-0">
                      <Star size={12} fill="currentColor" />
                      <span className="text-xs text-stone-400">{c.rating}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: SPECIALTY_COLORS[o.specialty] + "20", color: SPECIALTY_COLORS[o.specialty] }}>
                    {o.specialty}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full border" style={{ borderColor: STATUS_COLORS[status], color: STATUS_COLORS[status] }}>
                    {status}
                  </span>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && <div className="p-4 text-sm text-stone-400">No offices match your filters.</div>}
        </div>

        {/* Map */}
        <div className="flex-1 relative bg-stone-100 overflow-hidden">
          <MapContainer center={center} zoom={10} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FlyToSelected selected={selected} geocoded={geocoded} />
            {mapped.map((o) => {
              const g = geocoded[o.id];
              if (!g) return null;
              const c = crmData[o.id] || {};
              const status = c.status || "Not Started";
              const color = STATUS_COLORS[status];
              const isSelected = selected && selected.id === o.id;
              return (
                <Marker
                  key={o.id}
                  position={[g.lat, g.lon]}
                  icon={makeIcon(color, isSelected)}
                  eventHandlers={{ click: () => handleSelect(o) }}
                >
                  <Popup>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{o.office}</div>
                      <div style={{ color: "#78716c", fontSize: 11 }}>{o.first} {o.last}{o.prof ? `, ${o.prof}` : ""}</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{o.addr}, {o.city}</div>
                      <div style={{ fontSize: 11, marginTop: 2, color }}>{status}</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>

          {selected && (
            <DetailPanel
              office={selected}
              crm={crmData[selected.id]}
              onUpdateCrm={updateCrm}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

