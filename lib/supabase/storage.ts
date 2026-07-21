import { supabase } from "./client";
import type { CarKeepTable, Json } from "./types";

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
