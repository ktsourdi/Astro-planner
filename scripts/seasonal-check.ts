import fetch from 'node-fetch';

const cases = [
  { name: 'Winter', lat: 40, lon: -75, date: '2025-01-15T02:00:00Z', expect: ['Orion Nebula', 'Pleiades', 'Rosette Nebula', 'Crab Nebula'] },
  { name: 'Spring', lat: 40, lon: -75, date: '2025-04-15T02:00:00Z', expect: ['Whirlpool Galaxy', 'Sombrero Galaxy', 'Hercules Globular Cluster'] },
  { name: 'Summer', lat: 40, lon: -75, date: '2025-07-15T02:00:00Z', expect: ['Lagoon Nebula', 'Trifid Nebula', 'Eagle Nebula', 'Omega Nebula', 'North America Nebula'] },
  { name: 'Autumn', lat: 40, lon: -75, date: '2025-10-15T02:00:00Z', expect: ['Andromeda Galaxy', 'Triangulum Galaxy', 'Double Cluster', 'Pacman Nebula'] },
];

async function run() {
  let anyFail = false;
  for (const c of cases) {
    const url = `http://localhost:3000/api/recommend?lat=${c.lat}&lon=${c.lon}&sensorW=23.5&sensorH=15.6&pixelUm=3.76&focalMm=200&fNum=2.8&mount=tracker&date=${encodeURIComponent(c.date)}&minAlt=20&maxMag=12`;
    const resp = await fetch(url);
    if (!resp.ok) {
      console.log(`${c.name}: request failed ${resp.status}`);
      anyFail = true;
      continue;
    }
    const json = await resp.json();
    const names: string[] = (json.recommended_targets || []).map((t: any) => t.name);
    const report: string[] = [];
    for (const target of c.expect) {
      const hit = names.find(n => n.includes(target));
      report.push(`${target}: ${hit ? 'OK' : 'MISSING'}`);
      if (!hit) anyFail = true;
    }
    console.log(`${c.name}:`, report.join(' | '));
  }
  process.exit(anyFail ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
