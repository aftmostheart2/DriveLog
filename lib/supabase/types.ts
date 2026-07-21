export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type CarKeepTable =
  | "vehicles"
  | "services"
  | "reminders"
  | "parts"
  | "projects"
  | "wishlist_items";

export type SyncRecord = {
  id: string;
  user_id?: string;
  vehicle_id?: string | null;
  payload: Json;
  created_at?: string;
  updated_at?: string;
};
