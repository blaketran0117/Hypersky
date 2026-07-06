/**
 * Country of registration from the ICAO 24-bit address, for the major
 * allocation blocks. Conservative subset — anything outside these well-known
 * ranges returns null and the UI simply omits the country.
 */
const RANGES: [start: number, end: number, country: string][] = [
  [0x008000, 0x00ffff, "South Africa"],
  [0x010000, 0x017fff, "Egypt"],
  [0x06a000, 0x06afff, "Qatar"],
  [0x0d0000, 0x0d7fff, "Mexico"],
  [0x100000, 0x1fffff, "Russia"],
  [0x300000, 0x33ffff, "Italy"],
  [0x340000, 0x37ffff, "Spain"],
  [0x380000, 0x3bffff, "France"],
  [0x3c0000, 0x3fffff, "Germany"],
  [0x400000, 0x43ffff, "United Kingdom"],
  [0x440000, 0x447fff, "Austria"],
  [0x448000, 0x44ffff, "Belgium"],
  [0x458000, 0x45ffff, "Denmark"],
  [0x460000, 0x467fff, "Finland"],
  [0x468000, 0x46ffff, "Greece"],
  [0x470000, 0x477fff, "Hungary"],
  [0x478000, 0x47ffff, "Norway"],
  [0x480000, 0x487fff, "Netherlands"],
  [0x488000, 0x48ffff, "Poland"],
  [0x490000, 0x497fff, "Portugal"],
  [0x498000, 0x49ffff, "Czech Republic"],
  [0x4a8000, 0x4affff, "Sweden"],
  [0x4b0000, 0x4b7fff, "Switzerland"],
  [0x4b8000, 0x4bffff, "Turkey"],
  [0x4ca000, 0x4cafff, "Ireland"],
  [0x4cc000, 0x4ccfff, "Iceland"],
  [0x508000, 0x50ffff, "Ukraine"],
  [0x710000, 0x717fff, "Saudi Arabia"],
  [0x718000, 0x71ffff, "South Korea"],
  [0x738000, 0x73ffff, "Israel"],
  [0x750000, 0x757fff, "Malaysia"],
  [0x760000, 0x767fff, "Pakistan"],
  [0x768000, 0x76ffff, "Singapore"],
  [0x780000, 0x7bffff, "China"],
  [0x7c0000, 0x7fffff, "Australia"],
  [0x800000, 0x83ffff, "India"],
  [0x840000, 0x87ffff, "Japan"],
  [0x880000, 0x887fff, "Thailand"],
  [0x888000, 0x88ffff, "Vietnam"],
  [0x8a0000, 0x8a7fff, "Indonesia"],
  [0xa00000, 0xafffff, "United States"],
  [0xc00000, 0xc3ffff, "Canada"],
  [0xc80000, 0xc87fff, "New Zealand"],
  [0xe00000, 0xe3ffff, "Argentina"],
  [0xe40000, 0xe7ffff, "Brazil"],
];

export function countryFromIcao24(icao24: string): string | null {
  const addr = parseInt(icao24, 16);
  if (Number.isNaN(addr)) return null;
  for (const [start, end, country] of RANGES) {
    if (addr >= start && addr <= end) return country;
  }
  return null;
}
