"use client";
import { Empleado } from "./types";

const KEY = "pos_empleado";

export function getSession(): Empleado | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setSession(emp: Empleado) {
  sessionStorage.setItem(KEY, JSON.stringify(emp));
}

export function clearSession() {
  sessionStorage.removeItem(KEY);
}
