import os from "node:os";

// Docker, VM and VPN bridges aren't reachable from a phone on the same Wi-Fi.
const VIRTUAL_INTERFACE = /^(lo|docker|br-|veth|virbr|vmnet|vboxnet|tun|tap|utun|wg|zt)/;

/** This machine's IPv4 addresses on real network interfaces (Wi-Fi first, then Ethernet). */
export function lanAddresses(): string[] {
  const found: { name: string; address: string }[] = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    if (VIRTUAL_INTERFACE.test(name)) continue;
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) found.push({ name, address: entry.address });
    }
  }
  const rank = (name: string) => (/^(wl|wlan|wi)/.test(name) ? 0 : /^(en|eth)/.test(name) ? 1 : 2);
  return found.sort((a, b) => rank(a.name) - rank(b.name)).map((f) => f.address);
}
