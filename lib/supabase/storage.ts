import { supabase } from "./client";
import type { CarKeepTable, Json } from "./types";

function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : "";
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  return code === "42P01" || /schema cache|does not exist|could not find the table/i.test(message);
}

export async function getCurrentUserId() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listRecords<T>(table: CarKeepTable) {
  if (!supabase) return { data: [] as T[], error: null };
  const { data, error } = await supabase
    .from(table)
    .select("payload")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  return {
    data: (data ?? []).map((row) => row.payload as T),
    error,
  };
}

export async function upsertRecord(table: CarKeepTable, payload: { id: string; vehicleId?: string } & Record<string, unknown>) {
  if (!supabase) return { error: null };
  const userId = await getCurrentUserId();
  if (!userId) return { error: new Error("Sign in before syncing to Supabase.") };

  const { error } = await supabase.from(table).upsert({
    id: payload.id,
    user_id: userId,
    vehicle_id: payload.vehicleId ?? null,
    payload: payload as Json,
    updated_at: new Date().toISOString(),
  });

  return { error };
}

export async function softDeleteRecord(table: CarKeepTable, id: string) {
  if (!supabase) return { error: null };
  const { error } = await supabase
    .from(table)
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error };
}


export async function deleteCloudVehicleData(vehicleId: string) {
  if (!supabase) return { error: null };
  const userId = await getCurrentUserId();
  if (!userId) return { error: new Error("Sign in before clearing cloud data.") };

  const relatedTables: CarKeepTable[] = ["services", "reminders", "parts", "projects", "wishlist_items", "fuel_entries"];
  for (const table of relatedTables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId)
      .eq("vehicle_id", vehicleId);
    if (error && !isMissingTableError(error)) return { error };
  }

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("user_id", userId)
    .eq("id", vehicleId);

  return { error };
}
