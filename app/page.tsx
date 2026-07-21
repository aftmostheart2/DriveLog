"use client";

import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase/client";
import { upsertRecord } from "../lib/supabase/storage";

type VehicleShape = "sedan" | "coupe" | "suv" | "truck" | "wagon" | "van";
type Vehicle = { id: string; year: number; make: string; model: string; trim: string; nickname: string; vin: string; plate: string; mileage: number; color: string; shape?: VehicleShape; notes: string; };
type Service = { id: string; vehicleId: string; date: string; mileage: number; type: string; shop: string; mode: "Shop" | "DIY"; partsCost: number; laborCost: number; notes: string; receipt: string; };
type Reminder = { id: string; vehicleId: string; title: string; dueDate: string; dueMileage: number; interval: string; status: "Overdue" | "Due soon" | "Upcoming"; };
type Part = { id: string; vehicleId: string; projectId?: string; name: string; category: string; price: number; purchaseDate: string; retailer: string; order: string; warranty: string; installed: boolean; link: string; notes: string; };
type Project = { id: string; vehicleId: string; name: string; description: string; estimatedCost: number; actualCost: number; priority: "High" | "Medium" | "Low"; status: "Idea" | "Planned" | "Parts Needed" | "Parts Ordered" | "Ready to Install" | "In Progress" | "Completed"; targetDate: string; notes: string; tasks: { label: string; done: boolean }[]; };
type WishlistItem = { id: string; vehicleId: string; name: string; estimate: number; priority: "High" | "Medium" | "Low"; retailers: { name: string; price: number; link: string }[]; notes: string; };
type AppData = { vehicles: Vehicle[]; services: Service[]; reminders: Reminder[]; parts: Part[]; projects: Project[]; wishlist: WishlistItem[]; };
type ModalType = "vehicle" | "service" | "part" | "project" | "reminder" | "wishlist" | "backup";
type AccountState = { email: string; signedIn: boolean; message: string; };

const emptyData: AppData = { vehicles: [], services: [], reminders: [], parts: [], projects: [], wishlist: [] };
const STORAGE_KEY = "carkeep.v1";
const uid = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "id-" + Date.now() + "-" + Math.random().toString(16).slice(2);
const money = (n: number) => Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "$0";
const serviceTotal = (service: Service) => service.partsCost + service.laborCost;
const backupName = () => `carkeep-backup-${new Date().toISOString().slice(0, 10)}.json`;

async function saveBackupToFile(data: AppData) {
  const payload = JSON.stringify({ exportedAt: new Date().toISOString(), app: "CarKeep", version: 1, data }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const picker = (typeof window !== "undefined" ? (window as unknown as { showSaveFilePicker?: (options: unknown) => Promise<{ createWritable: () => Promise<{ write: (blob: Blob) => Promise<void>; close: () => Promise<void> }> }> }).showSaveFilePicker : undefined);
  if (picker) {
    try {
      const handle = await picker({ suggestedName: backupName(), types: [{ description: "CarKeep JSON backup", accept: { "application/json": [".json"] } }] });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return "Backup saved";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "Backup canceled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = backupName();
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "Backup file created";
}

const repository = {
  load(): AppData {
    if (typeof window === "undefined") return emptyData;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyData;
      const parsed = JSON.parse(raw) as AppData;
      if (!Array.isArray(parsed.vehicles)) return emptyData;
      return { ...emptyData, ...parsed };
    } catch {
      return emptyData;
    }
  },
  save(data: AppData) { if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); },
  clear() { if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY); },
};

const nav = [["dashboard", "Home", "home"], ["garage", "Garage", "garage"], ["history", "History", "history"], ["analytics", "Stats", "stats"], ["more", "More", "more"]] as const;
const moreScreens = [["parts", "Purchased parts", "Items you already own"], ["projects", "Future projects", "Repairs and modifications"], ["wishlist", "Wishlist", "Parts to compare later"], ["reminders", "Reminders", "Time and mileage alerts"], ["settings", "Settings & backup", "Export or clear local data"]] as const;

export default function Home() {
  const [data, setData] = useState<AppData>(emptyData);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [screen, setScreen] = useState("dashboard");
  const [vehicleId, setVehicleId] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState<ModalType | null>(null);
  const [projectDetail, setProjectDetail] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [account, setAccount] = useState<AccountState>({ email: "", signedIn: false, message: "" });
  const [installState, setInstallState] = useState({ ready: false, needsInstall: false });

  useEffect(() => { const saved = repository.load(); setData(saved); setVehicleId(saved.vehicles[0]?.id ?? ""); setHasLoaded(true); }, []);
  useEffect(() => {
    const navLike = navigator as Navigator & { standalone?: boolean; maxTouchPoints?: number };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean(navLike.standalone);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && Number(navLike.maxTouchPoints ?? 0) > 1);
    setInstallState({ ready: true, needsInstall: ios && !standalone });
  }, []);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: authData }) => {
      setAccount((current) => ({ ...current, email: authData.user?.email ?? "", signedIn: Boolean(authData.user) }));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccount((current) => ({ ...current, email: session?.user.email ?? "", signedIn: Boolean(session?.user) }));
    });
    return () => listener.subscription.unsubscribe();
  }, []);
  useEffect(() => { if (hasLoaded) repository.save(data); }, [data, hasLoaded]);

  const vehicles = data.vehicles;
  const vehicle = vehicles.find((item) => item.id === vehicleId) ?? vehicles[0];
  const hasVehicles = vehicles.length > 0;
  const services = vehicle ? data.services.filter((item) => item.vehicleId === vehicle.id) : [];
  const allSpend = data.services.reduce((sum, item) => sum + serviceTotal(item), 0);
  const vehicleSpend = services.reduce((sum, item) => sum + serviceTotal(item), 0);
  const activeProjects = data.projects.filter((item) => item.status !== "Completed");
  const filteredServices = data.services.filter((item) => (item.type + " " + item.shop + " " + item.notes).toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.date.localeCompare(a.date));

  function saveData(updater: (current: AppData) => AppData, message: string) { setData(updater); setToast(message); setModal(null); }
  async function signInWithEmail(email: string) {
    if (!supabase) return setAccount((current) => ({ ...current, message: "Add Supabase env vars first." }));
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setAccount((current) => ({ ...current, email, message: error ? error.message : "Check your email for the sign-in link." }));
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAccount({ email: "", signedIn: false, message: "Signed out." });
  }
  async function exportBackup() {
    const message = await saveBackupToFile(data);
    setToast(message);
  }
  async function syncToSupabase() {
    if (!supabase || !account.signedIn) return setToast("Sign in before syncing");
    const jobs = [
      ...data.vehicles.map((item) => upsertRecord("vehicles", item)),
      ...data.services.map((item) => upsertRecord("services", item)),
      ...data.reminders.map((item) => upsertRecord("reminders", item)),
      ...data.parts.map((item) => upsertRecord("parts", item)),
      ...data.projects.map((item) => upsertRecord("projects", item)),
      ...data.wishlist.map((item) => upsertRecord("wishlist_items", item)),
    ];
    const results = await Promise.all(jobs);
    const failed = results.find((result) => result.error);
    setToast(failed ? String(failed.error?.message ?? failed.error) : "Synced to Supabase");
  }
  function submitModal(form: FormData) { if (modal === "vehicle") return createVehicle(form); if (!vehicle && modal !== "backup") return setToast("Add a vehicle first"); if (modal === "service") return createService(form); if (modal === "part") return createPart(form); if (modal === "project") return createProject(form); if (modal === "reminder") return createReminder(form); if (modal === "wishlist") return createWishlistItem(form); }

  function createVehicle(form: FormData) {
    const next: Vehicle = { id: uid(), year: Number(form.get("year") || new Date().getFullYear()), make: String(form.get("make") || "").trim(), model: String(form.get("model") || "").trim(), trim: String(form.get("trim") || "").trim(), nickname: String(form.get("nickname") || "").trim() || String(form.get("model") || "Vehicle"), vin: String(form.get("vin") || "").trim(), plate: String(form.get("plate") || "").trim(), mileage: Number(form.get("mileage") || 0), color: String(form.get("color") || "#ff6a2a"), shape: String(form.get("shape") || "sedan") as VehicleShape, notes: String(form.get("notes") || "").trim() };
    if (!next.make || !next.model) return setToast("Make and model are required");
    saveData((current) => ({ ...current, vehicles: [next, ...current.vehicles] }), "Vehicle added");
    setVehicleId(next.id);
  }
  function createService(form: FormData) { const next: Service = { id: uid(), vehicleId: String(form.get("vehicleId") || vehicle?.id), date: String(form.get("date") || new Date().toISOString().slice(0, 10)), mileage: Number(form.get("mileage") || vehicle?.mileage || 0), type: String(form.get("type") || "Service").trim(), shop: String(form.get("shop") || "DIY").trim(), mode: String(form.get("mode")) === "Shop" ? "Shop" : "DIY", partsCost: Number(form.get("partsCost") || 0), laborCost: Number(form.get("laborCost") || 0), notes: String(form.get("notes") || "").trim(), receipt: String(form.get("link") || "").trim() }; saveData((current) => ({ ...current, services: [next, ...current.services] }), "Service saved"); }
  function createPart(form: FormData) { const next: Part = { id: uid(), vehicleId: String(form.get("vehicleId") || vehicle?.id), projectId: String(form.get("projectId") || "") || undefined, name: String(form.get("name") || "Part").trim(), category: String(form.get("category") || "General").trim(), price: Number(form.get("price") || 0), purchaseDate: String(form.get("date") || new Date().toISOString().slice(0, 10)), retailer: String(form.get("retailer") || "").trim(), order: String(form.get("order") || "").trim(), warranty: String(form.get("warranty") || "").trim(), installed: form.get("installed") === "on", link: String(form.get("link") || "").trim(), notes: String(form.get("notes") || "").trim() }; saveData((current) => ({ ...current, parts: [next, ...current.parts] }), "Part saved"); }
  function createProject(form: FormData) { const tasks = String(form.get("tasks") || "").split("\n").map((label) => label.trim()).filter(Boolean).map((label) => ({ label, done: false })); const next: Project = { id: uid(), vehicleId: String(form.get("vehicleId") || vehicle?.id), name: String(form.get("name") || "Project").trim(), description: String(form.get("description") || "").trim(), estimatedCost: Number(form.get("estimatedCost") || 0), actualCost: Number(form.get("actualCost") || 0), priority: String(form.get("priority") || "Medium") as Project["priority"], status: String(form.get("status") || "Idea") as Project["status"], targetDate: String(form.get("date") || ""), notes: String(form.get("notes") || "").trim(), tasks }; saveData((current) => ({ ...current, projects: [next, ...current.projects] }), "Project saved"); }
  function createReminder(form: FormData) { const next: Reminder = { id: uid(), vehicleId: String(form.get("vehicleId") || vehicle?.id), title: String(form.get("title") || "Reminder").trim(), dueDate: String(form.get("date") || ""), dueMileage: Number(form.get("mileage") || 0), interval: String(form.get("interval") || "").trim(), status: "Upcoming" }; saveData((current) => ({ ...current, reminders: [next, ...current.reminders] }), "Reminder saved"); }
  function createWishlistItem(form: FormData) { const next: WishlistItem = { id: uid(), vehicleId: String(form.get("vehicleId") || vehicle?.id), name: String(form.get("name") || "Wishlist item").trim(), estimate: Number(form.get("price") || 0), priority: String(form.get("priority") || "Medium") as WishlistItem["priority"], retailers: [{ name: String(form.get("retailer") || "Retailer").trim(), price: Number(form.get("price") || 0), link: String(form.get("link") || "").trim() }], notes: String(form.get("notes") || "").trim() }; saveData((current) => ({ ...current, wishlist: [next, ...current.wishlist] }), "Wishlist item saved"); }

  function completeProject(project: Project) {
    const linkedParts = data.parts.filter((item) => item.projectId === project.id);
    const partsCost = linkedParts.reduce((sum, item) => sum + item.price, 0);
    const service: Service = { id: uid(), vehicleId: project.vehicleId, date: new Date().toISOString().slice(0, 10), mileage: data.vehicles.find((item) => item.id === project.vehicleId)?.mileage ?? 0, type: project.name, shop: "Project conversion", mode: "DIY", partsCost, laborCost: Math.max(0, project.actualCost - partsCost), notes: (project.description + " " + project.notes).trim(), receipt: "" };
    setData((current) => ({ ...current, services: [service, ...current.services], projects: current.projects.map((item) => item.id === project.id ? { ...item, status: "Completed", actualCost: Math.max(item.actualCost, partsCost) } : item), parts: current.parts.map((item) => item.projectId === project.id ? { ...item, installed: true } : item) }));
    setToast("Project converted to history"); setProjectDetail(null); setScreen("history");
  }

  const page = useMemo(() => {
    if (!hasVehicles && screen !== "settings") return <StartScreen onAddVehicle={() => setModal("vehicle")} />;
    if (screen === "garage") return <Garage vehicles={vehicles} selected={vehicle?.id ?? ""} onOpen={(id) => { setVehicleId(id); setScreen("vehicle"); }} onAdd={() => setModal("vehicle")} />;
    if (screen === "vehicle" && vehicle) return <VehicleOverview vehicle={vehicle} services={services} reminders={data.reminders.filter((item) => item.vehicleId === vehicle.id)} parts={data.parts.filter((item) => item.vehicleId === vehicle.id)} onAdd={() => setModal("service")} />;
    if (screen === "history") return <History services={filteredServices} vehicles={vehicles} query={query} setQuery={setQuery} onAdd={() => setModal("service")} />;
    if (screen === "analytics") return <Analytics data={data} />;
    if (screen === "parts") return <Parts data={data} setData={setData} onAdd={() => setModal("part")} />;
    if (screen === "projects") return <Projects data={data} openDetail={setProjectDetail} onAdd={() => setModal("project")} />;
    if (screen === "wishlist") return <Wishlist data={data} setData={setData} onAdd={() => setModal("wishlist")} />;
    if (screen === "reminders") return <Reminders data={data} onAdd={() => setModal("reminder")} />;
    if (screen === "settings") return <Settings data={data} account={account} onSignIn={signInWithEmail} onSignOut={signOut} onSync={syncToSupabase} onBackup={exportBackup} onClear={() => { repository.clear(); setData(emptyData); setVehicleId(""); setToast("Local data cleared"); }} />;
    if (screen === "more") return <More setScreen={setScreen} />;
    return <Dashboard data={data} vehicle={vehicle} allSpend={allSpend} vehicleSpend={vehicleSpend} setScreen={setScreen} setVehicleId={setVehicleId} onQuickAdd={() => setModal("service")} onAddVehicle={() => setModal("vehicle")} />;
  }, [screen, hasVehicles, vehicles, vehicle, services, data, filteredServices, query, allSpend, vehicleSpend, account]);

  const activeNav = ["parts", "projects", "wishlist", "reminders", "settings"].includes(screen) ? "more" : screen;
  if (installState.ready && installState.needsInstall) return <InstallGate />;
  return <main className="shell"><section className="appSurface" aria-label="CarKeep vehicle maintenance app"><div className="content"><div className="topbar"><div><p className="eyebrow">CarKeep</p><h1>{screen === "dashboard" ? "Garage" : titleFor(screen)}</h1></div></div>{page}</div><nav className="tabbar" aria-label="Primary navigation">{nav.map(([key, label, iconName]) => <button key={key} className={activeNav === key ? "active" : ""} onClick={() => setScreen(key)} aria-label={label}><span className={`navIcon navIcon-${iconName}`} aria-hidden="true" />{label}</button>)}</nav></section><aside className="desktopPanel"><p className="eyebrow">CarKeep</p><h2>Know what your car costs before it surprises you.</h2><p>Track service history, parts, projects, reminders, and ownership cost from one clean maintenance record.</p><div className="metrics"><strong>{vehicles.length}</strong><span>Vehicles</span><strong>{data.services.length}</strong><span>Services</span><strong>{activeProjects.length}</strong><span>Active projects</span></div></aside>{projectDetail && <ProjectDetail project={data.projects.find((project) => project.id === projectDetail)!} data={data} onClose={() => setProjectDetail(null)} onComplete={completeProject} />}{modal && <EntryModal type={modal} vehicles={vehicles} projects={data.projects} onClose={() => setModal(null)} onSubmit={submitModal} data={data} />}{toast && <button className="toast" onAnimationEnd={() => setToast("")}>{toast}</button>}</main>;
}

function titleFor(screen: string) { return ({ garage: "Garage", vehicle: "Vehicle", history: "History", analytics: "Stats", more: "More", parts: "Parts", projects: "Projects", wishlist: "Wishlist", reminders: "Reminders", settings: "Settings" } as Record<string, string>)[screen] ?? "CarKeep"; }
function InstallGate() { return <main className="installShell"><section className="installCard"><p className="eyebrow">Install CarKeep</p><h1>Add it to your Home Screen first</h1><p>CarKeep works best as a Home Screen app. It gets the full-screen layout, avoids Safari tab chrome, and keeps your local records tied to the installed app.</p><ol><li>Tap the Share button in Safari.</li><li>Choose Add to Home Screen.</li><li>Tap Add, then open CarKeep from the new icon.</li></ol><p className="fine">After it opens from your Home Screen, you can add vehicles and save JSON backups to Files from Settings.</p></section></main>; }
function StartScreen({ onAddVehicle }: { onAddVehicle: () => void }) { return <div className="stack"><div className="emptyHero"><p className="eyebrow">Start clean</p><h2>Add your first vehicle</h2><p>CarKeep starts empty so your maintenance log belongs to you from the first record.</p><button className="primary" onClick={onAddVehicle}>Add vehicle</button></div><div className="setupList"><span>1. Add vehicle details</span><span>2. Log service history</span><span>3. Track parts, reminders, and projects</span></div></div>; }
function VehicleArt({ vehicle }: { vehicle: Vehicle }) { const background = "linear-gradient(135deg, " + vehicle.color + ", #1b1f25)"; const shape = vehicle.shape ?? "sedan"; return <div className={`vehicleArt shape-${shape}`} style={{ background }}><span>{vehicle.year || "Vehicle"}</span><strong>{vehicle.make} {vehicle.model}</strong><i className="carShape" aria-hidden="true" /></div>; }
function Dashboard({ data, vehicle, allSpend, vehicleSpend, setScreen, setVehicleId, onQuickAdd, onAddVehicle }: { data: AppData; vehicle?: Vehicle; allSpend: number; vehicleSpend: number; setScreen: (screen: string) => void; setVehicleId: (id: string) => void; onQuickAdd: () => void; onAddVehicle: () => void }) { const recent = data.services.slice().sort((a, b) => b.date.localeCompare(a.date))[0]; if (!vehicle) return <StartScreen onAddVehicle={onAddVehicle} />; const costPerMile = vehicle.mileage > 0 ? vehicleSpend / vehicle.mileage : 0; return <div className="stack"><div className="heroCard"><VehicleArt vehicle={vehicle} /><div className="heroInfo"><span className="badge good">Selected vehicle</span><h2>{vehicle.nickname}</h2><p>{vehicle.mileage.toLocaleString()} mi {vehicle.vin ? "· " + vehicle.vin : ""}</p></div></div><div className="grid3"><Stat label="Fleet spend" value={money(allSpend)} tone="orange" /><Stat label="This vehicle" value={money(vehicleSpend)} /><Stat label="Cost / mi" value={`$${costPerMile.toFixed(2)}`} /></div><div className="quickActions"><button onClick={onQuickAdd}>Log service</button><button onClick={() => setScreen("parts")}>Add parts</button><button onClick={onAddVehicle}>Add vehicle</button></div><Section title="Vehicles"><div className="vehicleRail">{data.vehicles.map((item) => <button key={item.id} onClick={() => { setVehicleId(item.id); setScreen("vehicle"); }} className="miniVehicle"><VehicleArt vehicle={item} /><strong>{item.nickname}</strong><span>{item.mileage.toLocaleString()} mi</span></button>)}</div></Section><Section title="Recent service">{recent ? <ServiceCard service={recent} vehicle={data.vehicles.find((item) => item.id === recent.vehicleId)!} /> : <EmptyState title="No service logged yet" text="Add oil changes, repairs, inspections, receipts, and notes as they happen." action="Log service" onAction={onQuickAdd} />}</Section></div>; }
function Garage({ vehicles, selected, onOpen, onAdd }: { vehicles: Vehicle[]; selected: string; onOpen: (id: string) => void; onAdd: () => void }) { return <div className="stack"><button className="primary" onClick={onAdd}>Add vehicle</button>{vehicles.map((vehicle) => <button className={`garageCard ${selected === vehicle.id ? "selected" : ""}`} key={vehicle.id} onClick={() => onOpen(vehicle.id)}><VehicleArt vehicle={vehicle} /><div><h2>{vehicle.nickname}</h2><p>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p>{vehicle.plate && <span className="plate">{vehicle.plate}</span>}</div></button>)}</div>; }
function VehicleOverview({ vehicle, services, reminders, parts, onAdd }: { vehicle: Vehicle; services: Service[]; reminders: Reminder[]; parts: Part[]; onAdd: () => void }) { return <div className="stack"><div className="heroCard"><VehicleArt vehicle={vehicle} /><div className="heroInfo"><h2>{vehicle.nickname}</h2><p>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</p></div></div><div className="profileGrid"><Info label="VIN" value={vehicle.vin || "Not added"} /><Info label="Plate" value={vehicle.plate || "Not added"} /><Info label="Mileage" value={`${vehicle.mileage.toLocaleString()} mi`} /><Info label="Notes" value={vehicle.notes || "No notes yet"} /></div><button className="primary" onClick={onAdd}>Log service entry</button><Section title="Reminders">{reminders.length ? reminders.map((reminder) => <ReminderCard key={reminder.id} reminder={reminder} />) : <EmptyState title="No reminders" text="Add time or mileage reminders for upcoming service." />}</Section><Section title="Purchased parts">{parts.length ? parts.map((part) => <PartCard key={part.id} part={part} vehicle={vehicle} />) : <EmptyState title="No parts saved" text="Purchased parts will appear here when linked to this vehicle." />}</Section><Section title="History">{services.length ? services.map((service) => <ServiceCard key={service.id} service={service} vehicle={vehicle} />) : <EmptyState title="No history yet" text="Your service records will build the ownership story for this vehicle." />}</Section></div>; }
function History({ services, vehicles, query, setQuery, onAdd }: { services: Service[]; vehicles: Vehicle[]; query: string; setQuery: (query: string) => void; onAdd: () => void }) { return <div className="stack"><div className="searchRow"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search repairs, shops, notes..." /><button onClick={onAdd}>Add</button></div>{services.length ? services.map((service) => <ServiceCard key={service.id} service={service} vehicle={vehicles.find((vehicle) => vehicle.id === service.vehicleId)!} />) : <EmptyState title="No service records" text="Log your first maintenance entry to start building history." action="Log service" onAction={onAdd} />}</div>; }
function Analytics({ data }: { data: AppData }) { const spend = data.services.reduce((sum, service) => sum + serviceTotal(service), 0); const avg = data.services.length ? spend / data.services.length : 0; const expensive = [...data.services].sort((a, b) => serviceTotal(b) - serviceTotal(a))[0]; const bars = data.services.slice(0, 6).map((service) => ({ label: service.date.slice(5), value: serviceTotal(service) })); const max = Math.max(1, ...bars.map((bar) => bar.value)); return <div className="stack"><div className="bigNumber"><span>Total ownership cost</span><strong>{money(spend)}</strong><p>Based on the service records you have entered.</p></div><div className="grid2"><Stat label="Avg service" value={money(avg)} /><Stat label="Most expensive" value={expensive ? money(serviceTotal(expensive)) : "$0"} /></div><Section title="Spending over time">{bars.length ? <div className="barChart">{bars.map((bar) => <div key={bar.label}><span style={{ height: `${Math.max(12, (bar.value / max) * 100)}%` }} /><em>{bar.label}</em></div>)}</div> : <EmptyState title="No chart data" text="Charts will appear after you log service records." />}</Section></div>; }
function Parts({ data, setData, onAdd }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onAdd: () => void }) { return <div className="stack"><button className="primary" onClick={onAdd}>Add purchased part</button>{data.parts.length ? data.parts.map((part) => <PartCard key={part.id} part={part} vehicle={data.vehicles.find((vehicle) => vehicle.id === part.vehicleId)!} project={data.projects.find((project) => project.id === part.projectId)} onToggle={() => setData((current) => ({ ...current, parts: current.parts.map((item) => item.id === part.id ? { ...item, installed: !item.installed } : item) }))} />) : <EmptyState title="No purchased parts" text="Save parts before install, link them to projects, then convert completed work to history." />}</div>; }
function Projects({ data, openDetail, onAdd }: { data: AppData; openDetail: (id: string) => void; onAdd: () => void }) { return <div className="stack"><button className="primary" onClick={onAdd}>Create project</button>{data.projects.length ? data.projects.map((project) => <button className="projectCard" key={project.id} onClick={() => openDetail(project.id)}><div><span className={`badge ${project.priority.toLowerCase()}`}>{project.priority}</span><h2>{project.name}</h2><p>{project.description || "No description"}</p></div><Progress project={project} /><small>{project.status}{project.targetDate ? " · target " + project.targetDate : ""}</small></button>) : <EmptyState title="No projects" text="Plan repairs, modifications, parts, budget, and install tasks here." />}</div>; }
function Wishlist({ data, setData, onAdd }: { data: AppData; setData: React.Dispatch<React.SetStateAction<AppData>>; onAdd: () => void }) { return <div className="stack"><button className="primary" onClick={onAdd}>Add wishlist item</button>{data.wishlist.length ? data.wishlist.map((item) => { const best = Math.min(...item.retailers.map((retailer) => retailer.price)); return <article className="card" key={item.id}><span className={`badge ${item.priority.toLowerCase()}`}>{item.priority}</span><h2>{item.name}</h2><p>{data.vehicles.find((vehicle) => vehicle.id === item.vehicleId)?.nickname} · est. {money(item.estimate)}</p><div className="retailers">{item.retailers.map((retailer) => <span key={retailer.name}>{retailer.name} <b>{money(retailer.price)}</b>{retailer.price === best && <em>Best</em>}</span>)}</div><button onClick={() => setData((current) => ({ ...current, parts: [{ id: uid(), vehicleId: item.vehicleId, name: item.name, category: "Wishlist purchase", price: best, purchaseDate: new Date().toISOString().slice(0, 10), retailer: item.retailers.find((retailer) => retailer.price === best)?.name ?? "Retailer", order: "", warranty: "", installed: false, link: "", notes: item.notes }, ...current.parts], wishlist: current.wishlist.filter((wishlistItem) => wishlistItem.id !== item.id) }))}>Move to purchased parts</button></article>; }) : <EmptyState title="No wishlist items" text="Compare future parts and prices before you buy." />}</div>; }
function Reminders({ data, onAdd }: { data: AppData; onAdd: () => void }) { return <div className="stack"><button className="primary" onClick={onAdd}>Add reminder</button>{data.reminders.length ? data.reminders.map((reminder) => <ReminderCard key={reminder.id} reminder={reminder} vehicle={data.vehicles.find((vehicle) => vehicle.id === reminder.vehicleId)} />) : <EmptyState title="No reminders" text="Create mileage or date reminders for service before it sneaks up." />}</div>; }
function Settings({ data, account, onSignIn, onSignOut, onSync, onBackup, onClear }: { data: AppData; account: AccountState; onSignIn: (email: string) => void; onSignOut: () => void; onSync: () => void; onBackup: () => void; onClear: () => void }) {
  const [email, setEmail] = useState(account.email);
  const recordCount = data.vehicles.length + data.services.length + data.parts.length + data.projects.length + data.reminders.length + data.wishlist.length;
  return <div className="stack"><div className="card"><h2>Account</h2><p>{isSupabaseConfigured ? "Sign in with an email magic link to sync your records to Supabase." : "Supabase is not configured yet. Add the env vars in Vercel to enable login."}</p><div className="accountBox">{account.signedIn ? <><strong>{account.email}</strong><button onClick={onSignOut}>Sign out</button></> : <><input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" /><button onClick={() => onSignIn(email)}>Email sign-in link</button></>}{account.message && <small>{account.message}</small>}</div></div><div className="card"><h2>Data</h2><p>CarKeep saves locally first. Supabase sync is optional until your account is connected.</p><div className="grid2"><Stat label="Records" value={String(recordCount)} /><Stat label="Storage" value={account.signedIn ? "Local + cloud" : "Local"} /></div></div><button className="primary" onClick={onSync}>Sync to Supabase</button><button className="primary" onClick={onBackup}>Export JSON backup</button><button className="danger" onClick={onClear}>Delete local data</button></div>;
}
function More({ setScreen }: { setScreen: (screen: string) => void }) { return <div className="moreGrid">{moreScreens.map(([key, title, sub]) => <button key={key} onClick={() => setScreen(key)}><strong>{title}</strong><span>{sub}</span></button>)}</div>; }
function ProjectDetail({ project, data, onClose, onComplete }: { project: Project; data: AppData; onClose: () => void; onComplete: (project: Project) => void }) { const vehicle = data.vehicles.find((item) => item.id === project.vehicleId)!; const parts = data.parts.filter((part) => part.projectId === project.id); return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet"><button className="close" onClick={onClose}>×</button><span className={`badge ${project.priority.toLowerCase()}`}>{project.priority}</span><h2>{project.name}</h2><p>{vehicle.nickname} · {project.status}</p><Progress project={project} /><p>{project.description}</p><div className="checklist">{project.tasks.length ? project.tasks.map((task) => <label key={task.label}><input type="checkbox" checked={task.done} readOnly /> {task.label}</label>) : <p>No checklist tasks yet.</p>}</div><Section title="Linked purchased parts">{parts.length ? parts.map((part) => <PartCard key={part.id} part={part} vehicle={vehicle} />) : <EmptyState title="No linked parts" text="Purchased parts linked to this project will appear here." />}</Section><button className="primary" onClick={() => onComplete(project)}>Convert project to service entry</button></div></div>; }
function EntryModal({ type, vehicles, projects, onClose, onSubmit, data }: { type: ModalType; vehicles: Vehicle[]; projects: Project[]; onClose: () => void; onSubmit: (form: FormData) => void; data: AppData }) { if (type === "backup") return <div className="overlay" role="dialog" aria-modal="true"><div className="sheet"><button className="close" onClick={onClose}>×</button><h2>Backup export</h2><textarea readOnly value={JSON.stringify(data, null, 2)} /><p className="fine">Use Settings to save this as a JSON file. Keep it somewhere safe until cloud sync is connected.</p></div></div>; return <div className="overlay" role="dialog" aria-modal="true"><form className="sheet" onSubmit={(event) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}><button type="button" className="close" onClick={onClose}>×</button><h2>{modalTitle(type)}</h2>{type !== "vehicle" && <VehicleSelect vehicles={vehicles} />}{type === "vehicle" && <VehicleFields />}{type === "service" && <ServiceFields vehicle={vehicles[0]} />}{type === "part" && <PartFields projects={projects} />}{type === "project" && <ProjectFields />}{type === "reminder" && <ReminderFields />}{type === "wishlist" && <WishlistFields />}<button className="primary">Save</button></form></div>; }
function modalTitle(type: ModalType) { return ({ vehicle: "Add vehicle", service: "Log service", part: "Add purchased part", project: "Create project", reminder: "Add reminder", wishlist: "Add wishlist item", backup: "Backup export" })[type]; }
function VehicleSelect({ vehicles }: { vehicles: Vehicle[] }) { return <label>Vehicle<select name="vehicleId">{vehicles.map((vehicle) => <option value={vehicle.id} key={vehicle.id}>{vehicle.nickname}</option>)}</select></label>; }
function VehicleFields() { const shapes: VehicleShape[] = ["sedan", "coupe", "suv", "truck", "wagon", "van"]; return <><div className="formGrid"><label>Year<input name="year" type="number" placeholder="2018" /></label><label>Mileage<input name="mileage" type="number" placeholder="85000" /></label></div><label>Make<input name="make" required placeholder="Toyota" /></label><label>Model<input name="model" required placeholder="Tacoma" /></label><label>Trim<input name="trim" placeholder="TRD Off-Road" /></label><label>Nickname<input name="nickname" placeholder="Daily, weekend car, truck..." /></label><label>VIN<input name="vin" placeholder="Optional" /></label><label>License plate<input name="plate" placeholder="Optional" /></label><label>Color<input name="color" type="color" defaultValue="#ff6a2a" /></label><fieldset className="shapePicker"><legend>Car shape</legend>{shapes.map((shape) => <label key={shape}><input type="radio" name="shape" value={shape} defaultChecked={shape === "sedan"} /><span className={`shapePreview shape-${shape}`}><i className="carShape" />{shape}</span></label>)}</fieldset><label>Notes<textarea name="notes" placeholder="Anything worth remembering about this vehicle" /></label></>; }
function ServiceFields({ vehicle }: { vehicle?: Vehicle }) { return <><label>Date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label><label>Mileage<input name="mileage" type="number" defaultValue={vehicle?.mileage ?? 0} /></label><label>Service type<input name="type" required placeholder="Oil change, brakes, inspection..." /></label><label>Shop or technician<input name="shop" placeholder="Shop name or DIY" /></label><label>Mode<select name="mode"><option>DIY</option><option>Shop</option></select></label><div className="formGrid"><label>Parts cost<input name="partsCost" type="number" min="0" defaultValue="0" /></label><label>Labor cost<input name="laborCost" type="number" min="0" defaultValue="0" /></label></div><label>Receipt link<input name="link" placeholder="https://..." /></label><label>Notes<textarea name="notes" placeholder="What was done? Any torque specs, parts, receipts, photos?" /></label></>; }
function PartFields({ projects }: { projects: Project[] }) { return <><label>Part name<input name="name" required placeholder="Brake pads, water pump, coilovers..." /></label><label>Category<input name="category" placeholder="Engine, suspension, brakes..." /></label><div className="formGrid"><label>Price<input name="price" type="number" min="0" defaultValue="0" /></label><label>Purchase date<input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} /></label></div><label>Retailer<input name="retailer" placeholder="FCP Euro, dealer, local shop..." /></label><label>Order number<input name="order" /></label><label>Warranty<input name="warranty" /></label>{projects.length > 0 && <label>Linked project<select name="projectId"><option value="">None</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>}<label><input name="installed" type="checkbox" /> Installed</label><label>Product link<input name="link" placeholder="https://..." /></label><label>Notes<textarea name="notes" /></label></>; }
function ProjectFields() { return <><label>Project name<input name="name" required placeholder="Suspension refresh" /></label><label>Description<textarea name="description" placeholder="What are you planning and why?" /></label><div className="formGrid"><label>Estimated cost<input name="estimatedCost" type="number" min="0" defaultValue="0" /></label><label>Actual cost<input name="actualCost" type="number" min="0" defaultValue="0" /></label></div><label>Priority<select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></label><label>Status<select name="status"><option>Idea</option><option>Planned</option><option>Parts Needed</option><option>Parts Ordered</option><option>Ready to Install</option><option>In Progress</option><option>Completed</option></select></label><label>Target date<input name="date" type="date" /></label><label>Checklist<textarea name="tasks" placeholder="One task per line" /></label><label>Notes<textarea name="notes" /></label></>; }
function ReminderFields() { return <><label>Title<input name="title" required placeholder="Oil change, registration, inspection..." /></label><label>Due date<input name="date" type="date" /></label><label>Due mileage<input name="mileage" type="number" min="0" /></label><label>Interval<input name="interval" placeholder="5,000 mi or 12 months" /></label></>; }
function WishlistFields() { return <><label>Item name<input name="name" required placeholder="Part or tool" /></label><div className="formGrid"><label>Estimated price<input name="price" type="number" min="0" defaultValue="0" /></label><label>Priority<select name="priority"><option>Medium</option><option>High</option><option>Low</option></select></label></div><label>Retailer<input name="retailer" placeholder="Retailer name" /></label><label>Product link<input name="link" placeholder="https://..." /></label><label>Notes<textarea name="notes" /></label></>; }
function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) { return <div className="emptyState"><h2>{title}</h2><p>{text}</p>{action && onAction && <button onClick={onAction}>{action}</button>}</div>; }
function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><div className="sectionTitle">{title}</div>{children}</section>; }
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) { return <div className={`stat ${tone ?? ""}`}><strong>{value}</strong><span>{label}</span></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div className="info"><span>{label}</span><strong>{value}</strong></div>; }
function ServiceCard({ service, vehicle }: { service: Service; vehicle: Vehicle }) { return <article className="card service"><div><span className="badge">{service.mode}</span><h2>{service.type}</h2><p>{vehicle.nickname} · {service.date} · {service.mileage.toLocaleString()} mi</p><small>{service.notes}</small></div><strong>{money(serviceTotal(service))}</strong></article>; }
function ReminderCard({ reminder, vehicle }: { reminder: Reminder; vehicle?: Vehicle }) { return <article className="card reminder"><span className={`badge ${reminder.status === "Overdue" ? "high" : reminder.status === "Due soon" ? "medium" : ""}`}>{reminder.status}</span><h2>{reminder.title}</h2><p>{vehicle?.nickname} {reminder.dueDate ? "· " + reminder.dueDate : ""} {reminder.dueMileage ? "· " + reminder.dueMileage.toLocaleString() + " mi" : reminder.interval ? "· " + reminder.interval : ""}</p></article>; }
function PartCard({ part, vehicle, project, onToggle }: { part: Part; vehicle: Vehicle; project?: Project; onToggle?: () => void }) { return <article className="card part"><div><span className="badge">{part.category}</span><h2>{part.name}</h2><p>{vehicle.nickname}{part.retailer ? " · " + part.retailer : ""}{part.order ? " · #" + part.order : ""}</p><small>{project ? "Linked to " + project.name : part.notes}</small></div><div className="right"><strong>{money(part.price)}</strong>{onToggle && <button onClick={onToggle}>{part.installed ? "Installed" : "Not installed"}</button>}</div></article>; }
function Progress({ project }: { project: Project }) { const done = project.tasks.filter((task) => task.done).length; const pct = project.tasks.length ? Math.round((done / project.tasks.length) * 100) : 0; return <div className="progress"><span style={{ width: `${pct}%` }} /><em>{pct}%</em></div>; }
