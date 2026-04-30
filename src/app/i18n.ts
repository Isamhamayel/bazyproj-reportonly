export type Lang = "en" | "ar";

export const isRTL = (lang: Lang) => lang === "ar";

export const t = {
  en: {
    allVehicles: "All Vehicles",
    ignitionOn: "Ignition On",
    idle: "Idle",
    ignitionOff: "Ignition Off",
    deviceName: "Device Name",
    ignition: "Ignition",
    speed: "Speed",
    location: "Location",
    lastUpdate: "Last Update",
    noData: "No data",
    add: "Add",
  },
  ar: {
    allVehicles: "كل المركبات",
    ignitionOn: "تشغيل",
    idle: "خامل",
    ignitionOff: "إيقاف",
    deviceName: "اسم المركبة",
    ignition: "التشغيل",
    speed: "السرعة",
    location: "الموقع",
    lastUpdate: "آخر تحديث",
    noData: "لا توجد بيانات",
    add: "إضافة",
  },
} as const;
