"use client";

import { useEffect, useMemo, useState } from "react";

type Vehicle = {
  id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  nickname: string;
  vin: string;
  plate: string;
  mileage: number;
  color: string;
  image: string;
  notes: string;
};

type Service = {
  id: string;
  vehicleId: string;
  date: string;
  mileage: number;
  type: string;
  shop: string;
  mode: "Shop" | "DIY";
  partsCost: number;
  laborCost: number;
  notes: string;
  receipt: string;
};

type Reminder = {
  id: string;
  vehicleId: string;
  title: string;
  dueDate: string;
  dueMileage: number;
  interval: string;
  status: "Overdue" | "Due soon" | "Upcoming";
};

type Part = {
  id: string;
  vehicleId: string;
  projectId?: string;
  name: string;
  category: string;
  price: number;
  purchaseDate: string;
  retailer: string;
  order: string;
  warranty: string;
  installed: boolean;
  link: string;
  notes: string;
};

type Project = {
  id: string;
  vehicleId: string;
  name: string;
  description: string;
  estimatedCost: number;
  actualCost: number;
  priority: "High" | "Medium" | "Low";
  status: "Idea" | "Planned" | "Parts Needed" | "Parts Ordered" | "Ready to Install" | "In Progress" | "Completed";
  targetDate: string;
  notes: string;
  tasks: { label: string; done: boolean }[];
};

type WishlistItem = {
  id: string;
  vehicleId: string;
  name: string;
  estimate: number;
  priority: "High" | "Medium" | "Low";
  retailers: { name: string; price: number; link: string }[];
  notes: string;
};

type AppData = {
  vehicles: Vehicle[];
  services: Service[];
  reminders: Reminder[];
  parts: Part[];
  projects: Project[];
  wishlist: WishlistItem[];
};

const STORAGE_KEY = "drivelog.prototype.v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const demoData: AppData = {
  vehicles: [
    {
      id: "cc",
      year: 2012,
      make: "Volkswagen",
      model: "CC",
      trim: "Sport PZEV",
      nickname: "Daily CC",
      vin: "WVWHP7ANXCE000000",
      plate: "CC 2012",
      mileage: 128420,
      color: "#d96a2b",
      image:
        "linear-gradient(135deg, rgba(217,106,43,.95), rgba(42,43,48,.95)), radial-gradient(circle at 70% 20%, rgba(255,255,255,.25), transparent 28%)",
      notes: "Demo daily driver with timing-chain, DSG, and cooling-system history.",
    },
    {
      id: "tacoma",
      year: 2019,
      make: "Toyota",
      model: "Tacoma",
      trim: "TRD Off-Road",
      nickname: "Trail Rig",
      vin: "3TMCZ5AN5KM102938",
      plate: "TRAIL4X",
      mileage: 68450,
      color: "#2dd4bf",
      image:
        "linear-gradient(135deg, rgba(45,212,191,.75), rgba(28,34,39,.95)), radial-gradient(circle at 30% 10%, rgba(255,255,255,.28), transparent 26%)",
      notes: "Overland build with lighting and service reminders.",
    },
    {
      id: "m3",
      year: 2022,
      make: "BMW",
      model: "M3",
      trim: "Competition",
      nickname: "Track Car",
      vin: "WBS8M9C09NCH48213",
      plate: "M3 TRAK",
      mileage: 24180,
      color: "#4fa8ff",
      image:
        "linear-gradient(135deg, rgba(79,168,255,.8), rgba(10,16,28,.98)), radial-gradient(circle at 60% 16%, rgba(255,255,255,.25), transparent 24%)",
      notes: "Performance-focused car with tire, brake, and fluid tracking.",
    },
  ],
  services: [
    {
      id: "svc-1",
      vehicleId: "cc",
      date: "2026-05-12",
      mileage: 127930,
      type: "Timing-chain service",
      shop: "EuroTech Independent",
      mode: "Shop",
      partsCost: 780,
      laborCost: 1120,
      notes: "Upper timing cover reseal, updated tensioner, guides inspected.",
      receipt: "https://example.com/receipt/timing",
    },
    {
      id: "svc-2",
      vehicleId: "cc",
      date: "2026-03-28",
      mileage: 126640,
      type: "DSG service",
      shop: "DIY",
      mode: "DIY",
      partsCost: 168,
      laborCost: 0,
      notes: "Fluid, filter, gasket, and fill adapter. Reset adaptation after warm-up.",
      receipt: "",
    },
    {
      id: "svc-3",
      vehicleId: "cc",
      date: "2025-11-18",
      mileage: 123050,
      type: "Water pump replacement",
      shop: "German Auto Works",
      mode: "Shop",
      partsCost: 310,
      laborCost: 540,
      notes: "Replaced pump assembly and thermostat housing after coolant seep.",
      receipt: "",
    },
    {
      id: "svc-4",
      vehicleId: "tacoma",
      date: "2026-04-02",
      mileage: 67290,
      type: "Oil and filter",
      shop: "QuickLube Express",
      mode: "Shop",
      partsCost: 42,
      laborCost: 45,
      notes: "Full synthetic 5W-30.",
      receipt: "",
    },
    {
      id: "svc-5",
      vehicleId: "m3",
      date: "2026-02-21",
      mileage: 23900,
      type: "Brake fluid flush",
      shop: "DIY",
      mode: "DIY",
      partsCost: 58,
      laborCost: 0,
      notes: "ATE Type 200 before track weekend.",
      receipt: "",
    },
  ],
  reminders: [
    { id: "rem-1", vehicleId: "cc", title: "Oil service", dueDate: "2026-08-15", dueMileage: 131000, interval: "5,000 mi", status: "Due soon" },
    { id: "rem-2", vehicleId: "cc", title: "DSG inspection", dueDate: "2027-03-28", dueMileage: 166000, interval: "40,000 mi", status: "Upcoming" },
    { id: "rem-3", vehicleId: "m3", title: "Annual safety inspection", dueDate: "2026-07-02", dueMileage: 0, interval: "12 months", status: "Overdue" },
  ],
  parts: [
    { id: "part-1", vehicleId: "cc", projectId: "proj-1", name: "Bilstein B6 front struts", category: "Suspension", price: 428, purchaseDate: "2026-06-10", retailer: "FCP Euro", order: "FCP-771204", warranty: "Lifetime replacement", installed: false, link: "https://example.com/bilstein", notes: "Waiting on mounts before install." },
    { id: "part-2", vehicleId: "cc", name: "INA timing-chain kit", category: "Engine", price: 520, purchaseDate: "2026-04-22", retailer: "ECS Tuning", order: "ECS-2241", warranty: "2 years", installed: true, link: "", notes: "Installed during timing service." },
    { id: "part-3", vehicleId: "tacoma", projectId: "proj-2", name: "20 inch LED light bar", category: "Lighting", price: 189, purchaseDate: "2026-05-02", retailer: "Rigid Industries", order: "RI-90341", warranty: "Lifetime", installed: false, link: "", notes: "For grille mount." },
  ],
  projects: [
    { id: "proj-1", vehicleId: "cc", name: "Suspension refresh", description: "Tighten the CC back up for daily driving.", estimatedCost: 1250, actualCost: 428, priority: "High", status: "Parts Ordered", targetDate: "2026-09-01", notes: "Pair struts with mounts, rear shocks, alignment.", tasks: [{ label: "Buy front struts", done: true }, { label: "Order mounts and hardware", done: false }, { label: "Schedule alignment", done: false }] },
    { id: "proj-2", vehicleId: "tacoma", name: "Overland lighting", description: "Add trail lighting and tidy wiring.", estimatedCost: 820, actualCost: 189, priority: "Medium", status: "Parts Needed", targetDate: "2026-10-15", notes: "Need switch panel and relay harness.", tasks: [{ label: "Mock up grille mount", done: true }, { label: "Buy harness", done: false }] },
    { id: "proj-3", vehicleId: "m3", name: "Track tire package", description: "Dedicated wheel and tire setup.", estimatedCost: 2800, actualCost: 0, priority: "Low", status: "Idea", targetDate: "2027-03-01", notes: "Wait until current PS4S set wears down.", tasks: [{ label: "Compare wheel offsets", done: false }] },
  ],
  wishlist: [
    { id: "wish-1", vehicleId: "cc", name: "034Motorsport dogbone insert", estimate: 48, priority: "Medium", retailers: [{ name: "034", price: 48, link: "https://example.com/034" }, { name: "UroTuning", price: 52, link: "" }], notes: "Cheap driveline feel upgrade." },
    { id: "wish-2", vehicleId: "m3", name: "Michelin Cup 2 set", estimate: 1540, priority: "High", retailers: [{ name: "Tire Rack", price: 1540, link: "" }, { name: "Discount Tire", price: 1580, link: "" }], notes: "Buy after alignment." },
  ],
};

const repository = {
  load(): AppData {
    if (typeof window === "undefined") return demoData;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return demoData;
      const parsed = JSON.parse(raw) as AppData;
      if (!Array.isArray(parsed.vehicles) || !Array.isArray(parsed.services)) return demoData;
      return parsed;
    } catch {
      return demoData;
    }
  },
  save(data: AppData) {
    if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  reset() {
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  },
};

const nav = [
  ["dashboard", "Home", "⌂"],
  ["garage", "Garage", "▦"],
  ["history", "History", "◷"],
  ["analytics", "Analytics", "▥"],
  ["more", "More", "⋯"],
] as const;

const moreScreens = [
  ["parts", "Purchased parts", "Inventory you already own"],
  ["projects", "Future projects", "Repairs and modifications"],
  ["wishlist", "Wishlist", "Compare before buying"],
  ["reminders", "Reminders", "Time and mileage alerts"],
  ["settings", "Settings & backup", "Export, reset, and app readiness"],
] as const;

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const total = (s: Service) => s.partsCost + s.laborCost;

export default function Home() {
  const [data, setData] = useState<AppData>(demoData);
  const [screen, setScreen] = useState("dashboard");
  const [vehicleId, setVehicleId] = useState("cc");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<null | "service" | "part" | "project" | "reminder" | "fuel" | "backup">(null);
  const [projectDetail, setProjectDetail] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  useEffect(() => setData(repository.load()), []);
  useEffect(() => repository.save(data), [data]);

  const vehicles = data.vehicles;
  const vehicle = vehicles.find((v) => v.id === vehicleId) ?? vehicles[0];
  const services = data.services.filter((s) => s.vehicleId === vehicle.id);
  const allSpend = data.services.reduce((sum, s) => sum + total(s), 0);
  const vehicleSpend = services.reduce((sum, s) => sum + total(s), 0);
  const activeProjects = data.projects.filter((p) => p.status !== "Completed");

  const filteredServices = data.services
    .filter((s) => `${s.type} ${s.shop} ${s.notes}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date));

  function addServiceFromForm(form: FormData) {
    const service: Service = {
      id: uid(),
      vehicleId: String(form.get("vehicleId") || vehicle.id),
      date: String(form.get("date") || new Date().toISOString().slice(0, 10)),
      mileage: Number(form.get("mileage") || vehicle.mileage),
      type: String(form.get("type") || "General service"),
      shop: String(form.get("shop") || "DIY"),
      mode: String(form.get("mode")) === "Shop" ? "Shop" : "DIY",
      partsCost: Number(form.get("partsCost") || 0),
      laborCost: Number(form.get("laborCost") || 0),
      notes: String(form.get("notes") || ""),
      receipt: String(form.get("receipt") || ""),
    };
    setData((d) => ({ ...d, services: [service, ...d.services] }));
    setToast("Service entry saved");
    setModal(null);
  }

  function completeProject(project: Project) {
    const linkedParts = data.parts.filter((p) => p.projectId === project.id);
    const partsCost = linkedParts.reduce((sum, p) => sum + p.price, 0);
    const service: Service = {
      id: uid(),
      vehicleId: project.vehicleId,
      date: new Date().toISOString().slice(0, 10),
      mileage: data.vehicles.find((v) => v.id === project.vehicleId)?.mileage ?? 0,
      type: project.name,
      shop: "Project conversion",
      mode: "DIY",
      partsCost,
      laborCost: Math.max(0, project.actualCost - partsCost),
      notes: `${project.description} ${project.notes}`.trim(),
      receipt: "",
    };
    setData((d) => ({
      ...d,
      services: [service, ...d.services],
      projects: d.projects.map((p) => (p.id === project.id ? { ...p, status: "Completed", actualCost: Math.max(p.actualCost, partsCost) } : p)),
      parts: d.parts.map((p) => (p.projectId === project.id ? { ...p, installed: true } : p)),
    }));
    setToast("Project converted to maintenance history");
    setProjectDetail(null);
    setScreen("history");
  }

  const page = useMemo(() => {
    if (screen === "garage") return <Garage vehicles={vehicles} selected={vehicle.id} onOpen={(id) => { setVehicleId(id); setScreen("vehicle"); }} />;
    if (screen === "vehicle") return <VehicleOverview vehicle={vehicle} services={services} reminders={data.reminders.filter((r) => r.vehicleId === vehicle.id)} parts={data.parts.filter((p) => p.vehicleId === vehicle.id)} onAdd={() => setModal("service")} />;
    if (screen === "history") return <History services={filteredServices} vehicles={vehicles} query={query} setQuery={setQuery} onAdd={() => setModal("service")} />;
    if (screen === "analytics") return <Analytics data={data} />;
    if (screen === "parts") return <Parts data={data} setData={setData} onAdd={() => setModal("part")} />;
    if (screen === "projects") return <Projects data={data} openDetail={setProjectDetail} onAdd={() => setModal("project")} />;
    if (screen === "wishlist") return <Wishlist data={data} setData={setData} />;
    if (screen === "reminders") return <Reminders data={data} onAdd={() => setModal("reminder")} />;
    if (screen === "settings") return <Settings data={data} onBackup={() => setModal("backup")} onReset={() => { repository.reset(); setData(demoData); setToast("Demo data reset"); }} />;
    if (screen === "more") return <More setScreen={setScreen} />;
    return <Dashboard data={data} vehicle={vehicle} allSpend={allSpend} vehicleSpend={vehicleSpend} setScreen={setScreen} setVehicleId={setVehicleId} onQuickAdd={() => setModal("service")} />;
  }, [screen, vehicles, vehicle, services, data, filteredServices, query, allSpend, vehicleSpend]);

  const activeNav = ["parts", "projects", "wishlist", "reminders", "settings"].includes(screen) ? "more" : screen;

  return (
    <main className="shell">
      <section className="phone" aria-label="DriveLog interactive mobile prototype">
        <div className="status"><span>9:41</span><span>DriveLog</span><span>●●●</span></div>
        <div className="content">
          <div className="topbar">
            <div>
              <p className="eyebrow">Local-first prototype</p>
              <h1>{screen === "dashboard" ? "Your garage" : titleFor(screen)}</h1>
            </div>
            <button className="iconButton" onClick={() => setScreen("settings")} aria-label="Open settings">⚙</button>
          </div>
          {page}
        </div>
        <nav className="tabbar" aria-label="Primary navigation">
          {nav.map(([key, label, glyph]) => (
            <button key={key} className={activeNav === key ? "active" : ""} onClick={() => setScreen(key)} aria-label={label}>
              <span>{glyph}</span>{label}
            </button>
          ))}
        </nav>
      </section>
      <aside className="desktopPanel">
        <p className="eyebrow">Future app path</p>
        <h2>Designed for GitHub now, iPhone later.</h2>
        <p>This prototype keeps records separate from screens, uses local persistence for now, and models the flows you would later wire into IndexedDB, SQLite, cloud sync, Expo, Capacitor, or SwiftUI.</p>
        <div className="metrics">
          <strong>{vehicles.length}</strong><span>Vehicles</span>
          <strong>{data.services.length}</strong><span>Services</span>
          <strong>{activeProjects.length}</strong><span>Active projects</span>
        </div>
      </aside>
      {projectDetail && <ProjectDetail project={data.projects.find((p) => p.id === projectDetail)!} data={data} onClose={() => setProjectDetail(null)} onComplete={completeProject} />}
      {modal && <EntryModal type={modal} vehicles={vehicles} projects={data.projects} onClose={() => setModal(null)} onSubmit={addServiceFromForm} data={data} />}
      {toast && <button className="toast" onAnimationEnd={() => setToast("")}>{toast}</button>}
    </main>
  );
}

function titleFor(screen: string) {
  return ({ garage: "Garage", vehicle: "Vehicle profile", history: "Maintenance", analytics: "Analytics", more: "More", parts: "Purchased parts", projects: "Future projects", wishlist: "Wishlist", reminders: "Reminders", settings: "Settings" } as Record<string, string>)[screen] ?? "DriveLog";
}

function VehicleArt({ vehicle }: { vehicle: Vehicle }) {
  return <div className="vehicleArt" style={{ background: vehicle.image }}><span>{vehicle.year}</span><strong>{vehicle.make} {vehicle.model}</strong></div>;
}

function Dashboard({ data, vehicle, allSpend, vehicleSpend, setScreen, setVehicleId, onQuickAdd }: { data: AppData; vehicle: Vehicle; allSpend: number; vehicleSpend: number; setScreen: (s: string) => void; setVehicleId: (id: string) => void; onQuickAdd: () => void }) {
  const recent = data.services.slice().sort((a, b) => b.date.localeCompare(a.date))[0];
  return <div className="stack">
    <div className="heroCard">
      <VehicleArt vehicle={vehicle} />
      <div className="heroInfo">
        <span className="badge good">Selected vehicle</span>
        <h2>{vehicle.nickname}</h2>
        <p>{vehicle.mileage.toLocaleString()} mi · {vehicle.vin}</p>
      </div>
    </div>
    <div className="grid3">
      <Stat label="Fleet spend" value={money(allSpend)} tone="orange" />
      <Stat label="This vehicle" value={money(vehicleSpend)} />
      <Stat label="Cost / mi" value={`$${(vehicleSpend / vehicle.mileage).toFixed(2)}`} />
    </div>
    <div className="quickActions">
      <button onClick={onQuickAdd}>＋ Log service</button>
      <button onClick={() => setScreen("reminders")}>◷ Reminders</button>
      <button onClick={() => setScreen("projects")}>▤ Projects</button>
    </div>
    <Section title="Vehicles">
      <div className="vehicleRail">
        {data.vehicles.map((v) => <button key={v.id} onClick={() => { setVehicleId(v.id); setScreen("vehicle"); }} className="miniVehicle"><VehicleArt vehicle={v} /><strong>{v.nickname}</strong><span>{v.mileage.toLocaleString()} mi</span></button>)}
      </div>
    </Section>
    <Section title="Recent service">
      {recent && <ServiceCard service={recent} vehicle={data.vehicles.find((v) => v.id === recent.vehicleId)!} />}
    </Section>
  </div>;
}

function Garage({ vehicles, selected, onOpen }: { vehicles: Vehicle[]; selected: string; onOpen: (id: string) => void }) {
  return <div className="stack">{vehicles.map((v) => <button className={`garageCard ${selected === v.id ? "selected" : ""}`} key={v.id} onClick={() => onOpen(v.id)}><VehicleArt vehicle={v} /><div><h2>{v.nickname}</h2><p>{v.year} {v.make} {v.model} {v.trim}</p><span className="plate">{v.plate}</span></div></button>)}</div>;
}

function VehicleOverview({ vehicle, services, reminders, parts, onAdd }: { vehicle: Vehicle; services: Service[]; reminders: Reminder[]; parts: Part[]; onAdd: () => void }) {
  return <div className="stack">
    <div className="heroCard"><VehicleArt vehicle={vehicle} /><div className="heroInfo"><h2>{vehicle.nickname}</h2><p>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p></div></div>
    <div className="profileGrid">
      <Info label="VIN" value={vehicle.vin} />
      <Info label="Plate" value={vehicle.plate} />
      <Info label="Mileage" value={`${vehicle.mileage.toLocaleString()} mi`} />
      <Info label="Notes" value={vehicle.notes} />
    </div>
    <button className="primary" onClick={onAdd}>Log service entry</button>
    <Section title="Maintenance reminders">{reminders.map((r) => <ReminderCard key={r.id} reminder={r} />)}</Section>
    <Section title="Photos & receipts"><div className="photoGrid"><span>Engine bay</span><span>Receipt</span><span>VIN plate</span><span>＋</span></div></Section>
    <Section title="Purchased parts">{parts.map((p) => <PartCard key={p.id} part={p} vehicle={vehicle} />)}</Section>
    <Section title="History">{services.map((s) => <ServiceCard key={s.id} service={s} vehicle={vehicle} />)}</Section>
  </div>;
}

function History({ services, vehicles, query, setQuery, onAdd }: { services: Service[]; vehicles: Vehicle[]; query: string; setQuery: (q: string) => void; onAdd: () => void }) {
  return <div className="stack"><div className="searchRow"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search repairs, shops, notes..." /><button onClick={onAdd}>＋</button></div><div className="chips"><button>Newest</button><button>All vehicles</button><button>Shop + DIY</button></div>{services.map((s) => <ServiceCard key={s.id} service={s} vehicle={vehicles.find((v) => v.id === s.vehicleId)!} />)}</div>;
}

function Analytics({ data }: { data: AppData }) {
  const spend = data.services.reduce((sum, s) => sum + total(s), 0);
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"].map((m, i) => ({ m, v: [260, 168, 87, 1900, 428, 310][i] }));
  const max = Math.max(...months.map((m) => m.v));
  const expensive = [...data.services].sort((a, b) => total(b) - total(a))[0];
  return <div className="stack">
    <div className="bigNumber"><span>Total ownership cost</span><strong>{money(spend)}</strong><p>Across maintenance, repair, fuel-ready data, parts, and projects.</p></div>
    <div className="grid2"><Stat label="Avg service" value={money(spend / data.services.length)} /><Stat label="Most expensive" value={money(total(expensive))} /></div>
    <Section title="Spending over time"><div className="barChart">{months.map((m) => <div key={m.m}><span style={{ height: `${Math.max(12, (m.v / max) * 100)}%` }} /><em>{m.m}</em></div>)}</div></Section>
    <Section title="Category split"><div className="donutList"><p><b className="dot orange" /> Engine and drivetrain <strong>58%</strong></p><p><b className="dot blue" /> Suspension and tires <strong>24%</strong></p><p><b className="dot teal" /> Fluids and service <strong>18%</strong></p></div></Section>
  </div>;
}

function Parts({ data, setData, onAdd }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onAdd: () => void }) {
  return <div className="stack"><button className="primary" onClick={onAdd}>Add purchased part</button>{data.parts.map((p) => <PartCard key={p.id} part={p} vehicle={data.vehicles.find((v) => v.id === p.vehicleId)!} project={data.projects.find((x) => x.id === p.projectId)} onToggle={() => setData((d) => ({ ...d, parts: d.parts.map((part) => part.id === p.id ? { ...part, installed: !part.installed } : part) }))} />)}</div>;
}

function Projects({ data, openDetail, onAdd }: { data: AppData; openDetail: (id: string) => void; onAdd: () => void }) {
  return <div className="stack"><button className="primary" onClick={onAdd}>Create project</button>{data.projects.map((p) => <button className="projectCard" key={p.id} onClick={() => openDetail(p.id)}><div><span className={`badge ${p.priority.toLowerCase()}`}>{p.priority}</span><h2>{p.name}</h2><p>{p.description}</p></div><Progress project={p} /><small>{p.status} · target {p.targetDate}</small></button>)}</div>;
}

function Wishlist({ data, setData }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>> }) {
  return <div className="stack">{data.wishlist.map((w) => {
    const best = Math.min(...w.retailers.map((r) => r.price));
    return <article className="card" key={w.id}><span className={`badge ${w.priority.toLowerCase()}`}>{w.priority}</span><h2>{w.name}</h2><p>{data.vehicles.find((v) => v.id === w.vehicleId)?.nickname} · est. {money(w.estimate)}</p><div className="retailers">{w.retailers.map((r) => <span key={r.name}>{r.name} <b>{money(r.price)}</b>{r.price === best && <em>Best</em>}</span>)}</div><button onClick={() => setData((d) => ({ ...d, parts: [{ id: uid(), vehicleId: w.vehicleId, name: w.name, category: "Wishlist purchase", price: best, purchaseDate: new Date().toISOString().slice(0, 10), retailer: w.retailers.find((r) => r.price === best)?.name ?? "Retailer", order: "TBD", warranty: "Unknown", installed: false, link: "", notes: w.notes }, ...d.parts], wishlist: d.wishlist.filter((item) => item.id !== w.id) }))}>Move to purchased parts</button></article>;
  })}</div>;
}

function Reminders({ data, onAdd }: { data: AppData; onAdd: () => void }) {
  return <div className="stack"><button className="primary" onClick={onAdd}>Add reminder</button>{data.reminders.map((r) => <ReminderCard key={r.id} reminder={r} vehicle={data.vehicles.find((v) => v.id === r.vehicleId)} />)}</div>;
}

function Settings({ data, onBackup, onReset }: { data: AppData; onBackup: () => void; onReset: () => void }) {
  return <div className="stack"><div className="card"><h2>Data backup</h2><p>Prototype data is saved locally through a repository boundary. A real app should move this to IndexedDB/SQLite plus cloud sync.</p><div className="grid2"><Stat label="Records" value={String(data.services.length + data.parts.length + data.projects.length)} /><Stat label="Schema" value="v1" /></div></div><button className="primary" onClick={onBackup}>Export JSON backup</button><button className="danger" onClick={onReset}>Reset demo data</button></div>;
}

function More({ setScreen }: { setScreen: (s: string) => void }) {
  return <div className="moreGrid">{moreScreens.map(([key, title, sub]) => <button key={key} onClick={() => setScreen(key)}><strong>{title}</strong><span>{sub}</span></button>)}</div>;
}

function ProjectDetail({ project, data, onClose, onComplete }: { project: Project; data: AppData; onClose: () => void; onComplete: (p: Project) => void }) {
  const vehicle = data.vehicles.find((v) => v.id === project.vehicleId)!;
  const parts = data.parts.filter((p) => p.projectId === project.id);
  return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet"><button className="close" onClick={onClose}>×</button><span className={`badge ${project.priority.toLowerCase()}`}>{project.priority}</span><h2>{project.name}</h2><p>{vehicle.nickname} · {project.status}</p><Progress project={project} /><p>{project.description}</p><div className="checklist">{project.tasks.map((t) => <label key={t.label}><input type="checkbox" checked={t.done} readOnly /> {t.label}</label>)}</div><Section title="Linked purchased parts">{parts.map((p) => <PartCard key={p.id} part={p} vehicle={vehicle} />)}</Section><button className="primary" onClick={() => onComplete(project)}>Convert completed project to service entry</button></div></div>;
}

function EntryModal({ type, vehicles, onClose, onSubmit, data }: { type: string; vehicles: Vehicle[]; projects: Project[]; onClose: () => void; onSubmit: (f: FormData) => void; data: AppData }) {
  if (type === "backup") return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet"><button className="close" onClick={onClose}>×</button><h2>Backup export</h2><textarea readOnly value={JSON.stringify(data, null, 2)} /><p className="fine">This is a prototype JSON backup. Real cloud sync comes later.</p></div></div>;
  return <div className="overlay" role="dialog" aria-modal="true"><form className="sheet" onSubmit={(e) => { e.preventDefault(); onSubmit(new FormData(e.currentTarget)); }}><button type="button" className="close" onClick={onClose}>×</button><h2>{type === "service" ? "Log service" : `Add ${type}`}</h2><label>Vehicle<select name="vehicleId">{vehicles.map((v) => <option value={v.id} key={v.id}>{v.nickname}</option>)}</select></label><label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Mileage<input name="mileage" type="number" defaultValue={vehicles[0]?.mileage} /></label><label>Type / name<input name="type" required placeholder="Oil change, coilovers, reminder..." /></label><label>Shop<input name="shop" placeholder="Shop name or DIY" /></label><label>Mode<select name="mode"><option>DIY</option><option>Shop</option></select></label><div className="formGrid"><label>Parts cost<input name="partsCost" type="number" min="0" defaultValue="0" /></label><label>Labor cost<input name="laborCost" type="number" min="0" defaultValue="0" /></label></div><label>Receipt / product link<input name="receipt" placeholder="https://..." /></label><label>Notes<textarea name="notes" placeholder="Photos, receipts, checklist details..." /></label><button className="primary">Save</button></form></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><div className="sectionTitle">{title}</div>{children}</section>; }
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className={`stat ${tone ?? ""}`}><strong>{value}</strong><span>{label}</span></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div>; }
function ServiceCard({ service, vehicle }: { service: Service; vehicle: Vehicle }) { return <article className="card service"><div><span className="badge">{service.mode}</span><h2>{service.type}</h2><p>{vehicle.nickname} · {service.date} · {service.mileage.toLocaleString()} mi</p><small>{service.notes}</small></div><strong>{money(total(service))}</strong></article>; }
function ReminderCard({ reminder, vehicle }: { reminder: Reminder; vehicle?: Vehicle }) { return <article className="card reminder"><span className={`badge ${reminder.status === "Overdue" ? "high" : reminder.status === "Due soon" ? "medium" : ""}`}>{reminder.status}</span><h2>{reminder.title}</h2><p>{vehicle?.nickname} · {reminder.dueDate} · {reminder.dueMileage ? `${reminder.dueMileage.toLocaleString()} mi` : reminder.interval}</p></article>; }
function PartCard({ part, vehicle, project, onToggle }: { part: Part; vehicle: Vehicle; project?: Project; onToggle?: () => void }) { return <article className="card part"><div><span className="badge">{part.category}</span><h2>{part.name}</h2><p>{vehicle.nickname} · {part.retailer} · #{part.order}</p><small>{project ? `Linked to ${project.name}` : part.notes}</small></div><div className="right"><strong>{money(part.price)}</strong><button onClick={onToggle}>{part.installed ? "Installed" : "Not installed"}</button></div></article>; }
function Progress({ project }: { project: Project }) { const done = project.tasks.filter((t) => t.done).length; const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0; return <div className="progress"><span style={{ width: `${pct}%` }} /><em>{pct}%</em></div>; }
