// Clash Once advanced menu
const standardClashOnce = main;
main = function (input) {
  const config = standardClashOnce(input);
  const home = config.proxies.find(proxy => proxy.name === HOME && proxy.type === "socks5");
  if (!home) return config;
  const target = config.rules[config.rules.length - 1].split(",")[1];
  const mainGroup = config["proxy-groups"].find(group => group.name === target && group.type === "select");
  if (!mainGroup) return config;

  const pools = JSON.parse(__PRIVATE_NODE_POOLS__);
  const slots = ["A", "B", "C"];
  const labels = slots.concat("总");
  const menu = "链式代理";
  const exitName = label => "链式代理 " + label;
  const frontName = label => "Clash Once/auto/" + label;
  const providerName = slot => "Clash Once/pool/" + slot;
  const exits = labels.map(exitName);
  const providers = config["proxy-providers"] || {};
  const occupied = [
    ...config.proxies.map(proxy => proxy.name),
    ...config["proxy-groups"].map(group => group.name),
    ...Object.keys(providers)
  ];
  for (const provider of Object.values(providers)) {
    if (provider && Array.isArray(provider.payload)) {
      occupied.push(...provider.payload.filter(Boolean).map(proxy => proxy.name));
    }
  }
  // On a collision, keep the result of standard mode intact.
  const names = new Set([menu, ...exits]);
  if (occupied.some(name => typeof name === "string" && (names.has(name) || name.startsWith("Clash Once/")))) {
    return config;
  }

  for (const group of config["proxy-groups"]) {
    const exclusions = [];
    if (group["include-all"] || group["include-all-proxies"]) {
      exclusions.push("^(?:" + exits.map(escaped).join("|") + ")$");
    }
    if (group["include-all"] || group["include-all-providers"]) {
      exclusions.push("^Clash Once/entry/");
    }
    if (exclusions.length) {
      group["exclude-filter"] = exclusions.concat(group["exclude-filter"] || []).join("|");
    }
  }

  const url = "https://www.gstatic.com/generate_204";
  config["proxy-providers"] = providers;
  for (const slot of Object.keys(pools)) {
    providers[providerName(slot)] = {
      type: "inline",
      payload: pools[slot],
      "health-check": {enable: true, url, interval: 300, timeout: 5000, lazy: true, "expected-status": "204"}
    };
  }
  for (const label of labels) {
    const use = (label === "总" ? slots : [label]).filter(slot => pools[slot]).map(providerName);
    config["proxy-groups"].push({
      name: frontName(label), type: "url-test", ...(use.length ? {use} : {proxies: ["REJECT"]}),
      url, interval: 300, tolerance: 50, lazy: true, timeout: 5000,
      "expected-status": "204", "empty-fallback": "REJECT", hidden: true
    });
    config.proxies.push({...home, name: exitName(label), "dialer-proxy": frontName(label)});
  }
  config["proxy-groups"].push({name: menu, type: "select", proxies: exits, "empty-fallback": "REJECT"});
  mainGroup.proxies.push(menu);
  return config;
};
