const PATIENTS = [
  {
    name: "Elena Ruiz",
    dept: "Cardiology Clinic",
    provider: "Dr. A. Alvarez",
    dayOffset: 0,
    time: "9:00 AM",
    minutes: 540,
    stage: "resolved",
    statusLabel: "Auto-Registered",
    tagline: "Full auto-resolution — zero outreach, zero staff time",
    file: "ambulatory-registration.html",
    scenario: 0
  },
  {
    name: "Marcus Webb",
    dept: "Family Medicine",
    provider: "Dr. N. Park",
    dayOffset: 0,
    time: "10:30 AM",
    minutes: 630,
    stage: "resolved",
    statusLabel: "Registered via SMS",
    tagline: "Auto-resolution flags 4 items — closed via Two way SMS AI outreach",
    file: "ambulatory-registration.html",
    scenario: 1
  },
  {
    name: "Diane Foster",
    dept: "Internal Medicine",
    provider: "Dr. T. Nguyen",
    dayOffset: 0,
    time: "11:15 AM",
    minutes: 675,
    stage: "needs-action",
    statusLabel: "Needs Front Desk",
    tagline: "Full cascade — Voice AI miss → kiosk → front desk (ambient) → exception",
    file: "ambulatory-registration.html",
    scenario: 2
  }
];

export { PATIENTS };
