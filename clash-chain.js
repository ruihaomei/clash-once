/**
 * 国内白名单 + 住宅 SOCKS5 链式代理 / Clash Verge Rev + Mihomo
 * Public template v1.0.0 / 建议 Mihomo >= 1.19.31。
 * Public template contains placeholders only. Keep your filled-in copy private.
 * 公开模板不含真实凭据；填写后的副本仅本地保存。
 * 只返回配置对象；不会修改系统代理、TUN、路由、端口或运行中的 VPN。
 *
 * 基于 mcxiaochenn/Clash_Override_Script_For_CN v2026.06.28.03 的
 * provider 架构重新实现；不会执行其重建所有组或空组 DIRECT 回退的逻辑。
 * 持续更新：mcxiaochenn/clash-rules-cn@rules + MetaCubeX/meta-rules-dat@meta。
 * SPDX-License-Identifier: MIT
 */

// ===== EDIT HERE / 只需填写这里 =====
// Keep quotes around text; port is a number without quotes.
// 文本保留引号；端口填写不带引号的整数。账号中的双引号、反斜线需按 JS 语法转义。
const SETTINGS = {
  mainGroup: "默认节点", // Usually leave unchanged / 一般不用改；自动寻找现有主选择组
  residential: {
    enabled: true, // false = upstream proxies only / false 则不创建住宅出口
    server: "__RESIDENTIAL_SERVER__", // SOCKS5 hostname or IP / 服务商提供的地址（不带协议或端口）
    port: 0, // Replace with your provider's port, 1–65535 / 填服务商端口
    username: "__RESIDENTIAL_USERNAME__", // SOCKS5 username / 账号
    password: "__RESIDENTIAL_PASSWORD__", // SOCKS5 password / 密码
    udp: false // Enable only if your provider confirms support / 供应商确认支持后再启用
  },
  // Optional domain suffixes that bypass the proxy; no protocol, path or wildcard.
  // 可选：优先直连域名及其子域名；不填协议、路径或通配符。默认留空。
  customDirectDomains: []
};
// ===== END OF USER SETTINGS / 以下通常无需修改 =====

const FRONT = "🔗 前置节点 (自动优选)";
const HOME = "🏠 静态住宅 IP - 链式";
const PREFIX = "smart-cn-v1-";
const AD_NAME = "📢 脚本来源：YouTube 不一样的强哥";
const RESERVED = ["DIRECT", "REJECT", "REJECT-DROP", "PASS", "COMPATIBLE", "GLOBAL"];
const TERMINAL_TYPES = ["direct", "reject", "reject-drop", "pass", "compatible", "dns"];
const INFO_NODE = /剩余流量|套餐到期|到期时间|重置时间|流量重置|官网地址|订阅地址|脚本来源|traffic remaining|expire date/i;
const HOME_NAME = /静态住宅|住宅.*链式|residential.*chain/i;

// 小型内置安全网：远程 AI/proxy 规则首次下载失败时，核心服务仍有明确保护。
// 来源：上游 ai-domain / proxy-domain 与 MetaCubeX category-ai-!cn；大规则仍在线更新。
const SAFETY_DOMAINS = [
  "+.openai.com", "+.chatgpt.com", "+.oaistatic.com", "+.oaiusercontent.com",
  "+.anthropic.com", "+.claude.ai", "+.claude.com", "+.perplexity.ai", "+.pplx.ai",
  "+.x.ai", "+.grok.com", "+.grokusercontent.com", "+.grokipedia.com",
  "+.google.com", "+.googleapis.com", "+.googleusercontent.com", "+.gstatic.com",
  "+.google.dev", "+.notebooklm.google", "+.copilot.microsoft.com", "+.copilot.com",
  "+.github.com", "+.githubusercontent.com", "+.githubassets.com",
  "+.youtube.com", "+.youtu.be", "+.googlevideo.com", "+.ytimg.com",
  "+.reddit.com", "+.redd.it", "+.twitter.com", "+.x.com", "+.t.co", "+.twimg.com",
  "+.netflix.com", "+.nflxvideo.net", "+.telegram.org", "+.t.me",
  "+.discord.com", "+.discord.gg", "+.discordapp.com", "challenges.cloudflare.com"
];

// Windows 与 macOS 微信进程名称；不把浏览器、通用下载器或所有国外域名统统直连。
// Weixin：ScoopInstaller/Extras bucket/wechat.json。
// WeChatAppEx/BaiduNetdiskHost：FlClash issue #870 配置示例。
// WeChat/QQ/DingTalk/Feishu：FirTech/AutoShortcut 配置；Feishu/WXWork：Verge issue #8105 实际日志。
// 百度：ACL4SSR/ACL4SSR Clash/Download.list；cloudmusic：Seraph310/cloudmusic-desktop-mcp。
const CHINESE_PROCESSES = [
  "Weixin.exe", "WeChat.exe", "WeChatAppEx.exe",
  "WeChat", "Weixin", "WeChatAppEx", "WeChatAppEx Helper", // macOS 微信
  "QQ.exe", "WXWork.exe", "DingTalk.exe",
  "Feishu.exe", "cloudmusic.exe", "BaiduNetdisk.exe", "BaiduNetdiskHost.exe"
];

function fail(message) {
  throw new Error("国内白名单脚本：" + message);
}
function unique(list) { return Array.from(new Set(list)); }
function escaped(name) { return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function addExcluded(group, names) {
  const exact = names.length ? "^(?:" + unique(names).map(escaped).join("|") + ")$" : "";
  if (exact && !(group["exclude-filter"] || "").split("```").includes(exact)) {
    group["exclude-filter"] = [group["exclude-filter"], exact].filter(Boolean).join("```");
  }
}
function isTerminal(proxy) {
  return TERMINAL_TYPES.includes(String(proxy.type || "").toLowerCase());
}
function isFront(proxy) {
  return !isTerminal(proxy) && !proxy["dialer-proxy"] && proxy.name !== AD_NAME &&
    !INFO_NODE.test(proxy.name) && !HOME_NAME.test(proxy.name) && proxy.name !== HOME;
}
function duplicateCheck(items, description) {
  const seen = new Set();
  for (const item of items) {
    if (!item || typeof item.name !== "string" || !item.name || /[,\r\n]/.test(item.name)) {
      fail(description + "存在缺少名称或名称含逗号/换行的条目，请修正订阅。");
    }
    if (seen.has(item.name)) fail(description + "存在同名条目：" + item.name);
    if (RESERVED.includes(item.name)) fail(description + "占用了内置名称：" + item.name);
    seen.add(item.name);
  }
}

function main(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("输入不是有效配置对象。");
  // 克隆后修改；失败时不会留下部分修改的输入配置。无 Node.js / 文件系统依赖。
  const config = JSON.parse(JSON.stringify(input));
  const originalProxies = config.proxies || [];
  const originalGroups = config["proxy-groups"] || [];
  if (!Array.isArray(originalProxies) || !Array.isArray(originalGroups)) fail("节点和代理组必须是数组。");
  const providers = config["proxy-providers"] || {};
  if (typeof providers !== "object" || Array.isArray(providers)) fail("proxy-providers 必须是映射。");

  // 识别旧住宅脚本产物，清理各个 select / include-all 组中的重复注入。
  const oldHomes = originalProxies.filter(p => p && HOME_NAME.test(p.name || ""));
  const oldHomeNames = unique(oldHomes.map(p => p.name).concat(HOME));
  let home = null;
  if (SETTINGS.residential.enabled) {
    const settings = SETTINGS.residential;
    if (!settings.server || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 ||
        !settings.username || !settings.password || /__RESIDENTIAL_/.test(settings.server + settings.username + settings.password)) {
      fail("请填写顶部 residential 的 server、port、username、password；仅用机场可将 enabled 设为 false。");
    }
    home = {
      name: HOME, type: "socks5", server: settings.server, port: settings.port,
      username: settings.username, password: settings.password, udp: settings.udp === true,
      "dialer-proxy": FRONT
    };
  }
  const removed = unique(oldHomeNames.concat(AD_NAME));
  const proxies = originalProxies.filter(p => p && !removed.includes(p.name));
  duplicateCheck(proxies, "订阅节点");
  if (proxies.some(p => p.name === FRONT)) fail("前置组名称与一个订阅节点冲突，请重命名该订阅节点。");
  if (home) proxies.push(home);
  const groups = originalGroups.filter(g => g && g.name !== FRONT && g.name !== AD_NAME);
  duplicateCheck(groups, "订阅代理组");
  if (groups.some(g => oldHomeNames.includes(g.name))) fail("住宅节点名称与订阅代理组冲突。");

  // inline provider 可逐节点检查；HTTP/file 的内容在 JS 执行时不可见，不能证明无链式递归。
  // 未审计的动态 provider 可保留在无关组，但不准进入主要代理路径或前置候选。
  const inlineNodes = new Map();
  const safeProviders = [];
  const providerExcluded = [];
  for (const name of Object.keys(providers)) {
    const provider = providers[name];
    if (!provider || provider.type !== "inline" || !Array.isArray(provider.payload)) continue;
    const override = provider.override || {};
    if (override["override-expr"] || override["proxy-name"] || override["additional-prefix"] || override["additional-suffix"]) continue;
    duplicateCheck(provider.payload, "inline provider " + name);
    const nodes = provider.payload.map(p => Object.assign({}, p, override, {name: p.name}));
    duplicateCheck(nodes, "inline provider " + name);
    if (nodes.some(p => removed.includes(p.name) || p.name === FRONT)) {
      fail("inline provider 含住宅/脚本保留名称，请将住宅节点放在顶部 residential 中。");
    }
    inlineNodes.set(name, nodes);
    providerExcluded.push(...nodes.filter(p => !isFront(p)).map(p => p.name));
    if (nodes.some(isFront)) safeProviders.push(name);
  }
  const ordinary = proxies.filter(isFront).map(p => p.name);
  if (!ordinary.length && !safeProviders.length) {
    fail("没有可安全使用的普通前置节点。若订阅仅使用 HTTP/file proxy-providers，JS 无法审计其节点的 dialer-proxy；请先导出为普通 proxies 或 inline payload。");
  }
  const front = {
    name: FRONT, type: "url-test", proxies: ordinary, url: "https://www.gstatic.com/generate_204",
    interval: 300, tolerance: 50, lazy: true, timeout: 5000, "expected-status": "204",
    "empty-fallback": "REJECT"
  };
  if (safeProviders.length) front.use = safeProviders;
  addExcluded(front, providerExcluded);
  groups.push(front);

  let selected = groups.find(g => g.name === SETTINGS.mainGroup && g.type === "select");
  if (!selected) {
    for (const name of ["节点选择", "🚀 节点选择", "PROXY", "Proxy", "代理选择"]) {
      selected = groups.find(g => g.name === name && g.type === "select");
      if (selected) break;
    }
  }
  if (!selected) {
    const lastMatch = (config.rules || []).filter(r => typeof r === "string" && r.startsWith("MATCH,")).pop();
    const target = lastMatch && lastMatch.split(",")[1];
    selected = groups.find(g => g.name === target && g.type === "select");
  }
  if (!selected) {
    const name = groups.some(g => g.name === SETTINGS.mainGroup) ? SETTINGS.mainGroup + "（智能分流）" : SETTINGS.mainGroup;
    selected = {name: name, type: "select", proxies: [FRONT].concat(ordinary)};
    groups.unshift(selected);
  }
  const target = selected.name;
  if (proxies.some(p => p.name === target)) fail("主代理组名称与节点重名。");

  // 不向无关服务组直接注入住宅节点；include-all-proxies 也必须显式排除。
  for (const group of groups) {
    if (group.name === FRONT) continue;
    group.proxies = unique((group.proxies || []).filter(name => !removed.includes(name)));
    if (group.name !== target) addExcluded(group, [HOME]);
    if (!group.proxies.length && !(group.use || []).length && !group["include-all"] &&
        !group["include-all-proxies"] && !group["include-all-providers"]) group.proxies = ["REJECT"];
  }
  selected.proxies = unique((selected.proxies || []).filter(n => n !== "REJECT"));
  if (!selected.proxies.includes(FRONT)) selected.proxies.unshift(FRONT);
  if (home) selected.proxies.push(HOME);
  // 确保显式选项不会被继承的 provider filter 遮蔽；Mihomo filter 仅筛选动态候选。
  selected["empty-fallback"] = "REJECT";

  const rawByName = new Map(proxies.map(p => [p.name, p]));
  const groupByName = new Map(groups.map(g => [g.name, g]));
  for (const name of rawByName.keys()) if (groupByName.has(name)) fail("节点与代理组重名：" + name);
  const inlineByName = new Map();
  for (const nodes of inlineNodes.values()) for (const p of nodes) {
    if (rawByName.has(p.name) || groupByName.has(p.name) || inlineByName.has(p.name)) fail("inline 节点名称冲突：" + p.name);
    inlineByName.set(p.name, p);
  }

  // 主要路径及其子组：移除 DIRECT/PASS/COMPATIBLE，空组拒绝，禁止绕过代理。
  const protectedGroups = new Set();
  function protect(name) {
    if (protectedGroups.has(name)) return;
    protectedGroups.add(name);
    const group = groupByName.get(name);
    if (!group) return;
    if (group.type === "relay") fail("主要路径包含旧 relay 组；请改用节点 dialer-proxy。");
    const use = unique((group.use || []).concat(group["include-all"] || group["include-all-providers"] ? Object.keys(providers) : []));
    for (const providerName of use) {
      if (!providers[providerName]) fail("代理组引用不存在的 provider：" + providerName);
      if (!inlineNodes.has(providerName)) fail("主代理路径引用无法在 JS 中审计的 provider：" + providerName + "。请导出为 proxies/inline，避免隐藏的 DIRECT 或链式递归。");
    }
    group.proxies = unique((group.proxies || []).filter(n => {
      const p = rawByName.get(n) || inlineByName.get(n);
      return !["DIRECT", "PASS", "COMPATIBLE", "GLOBAL"].includes(n) && !(p && isTerminal(p));
    }));
    if (group["include-all"] || group["include-all-proxies"]) {
      group.proxies = unique(group.proxies.concat(proxies.filter(p => !isTerminal(p) && !removed.includes(p.name)).map(p => p.name)));
      delete group["include-all"]; delete group["include-all-proxies"];
    }
    if (use.length) group.use = use;
    delete group["include-all-providers"];
    addExcluded(group, Array.from(inlineByName.values()).filter(isTerminal).map(p => p.name));
    group["empty-fallback"] = "REJECT";
    if (!group.proxies.length && !use.length) group.proxies = ["REJECT"];
    if (group["default-selected"] && !group.proxies.includes(group["default-selected"])) delete group["default-selected"];
    for (const next of group.proxies) if (groupByName.has(next)) protect(next);
  }
  protect(target);
  protect(FRONT);
  // include-all 展开后统一住宅选项位置，保证多次执行得到同一结果。
  selected.proxies = selected.proxies.filter(name => name !== HOME);
  if (home) selected.proxies.push(HOME);

  // 全配置引用检查：不凭空猜测动态 provider 的节点名称。
  function known(name, group) {
    if (RESERVED.includes(name) || rawByName.has(name) || groupByName.has(name) || inlineByName.has(name)) return true;
    return group && ((group.use || []).some(n => providers[n] && !inlineNodes.has(n)) ||
      ((group["include-all"] || group["include-all-providers"]) && Object.keys(providers).some(n => !inlineNodes.has(n))));
  }
  for (const group of groups) {
    for (const name of group.proxies || []) if (!known(name, group)) fail("组 " + group.name + " 引用了不存在的节点/组：" + name);
    for (const name of group.use || []) if (!providers[name]) fail("组引用了不存在的 provider：" + name);
    if (group["empty-fallback"] && !known(group["empty-fallback"], group)) fail("empty-fallback 引用不存在。");
  }
  const visiting = new Set(), visited = new Set();
  function visit(name) {
    if (visited.has(name) || RESERVED.includes(name)) return;
    if (visiting.has(name)) fail("检测到节点/组递归链：" + name + "，请修正原订阅。");
    visiting.add(name);
    const group = groupByName.get(name), proxy = rawByName.get(name) || inlineByName.get(name);
    if (group) {
      for (const next of group.proxies || []) visit(next);
      for (const providerName of group.use || []) for (const p of inlineNodes.get(providerName) || []) {
        // 前置组只连接经逐项审计的普通节点，排除链式候选。
        if (group.name !== FRONT || isFront(p)) visit(p.name);
      }
      if (group["empty-fallback"]) visit(group["empty-fallback"]);
    }
    if (proxy && proxy["dialer-proxy"]) {
      if (proxy["dialer-proxy"] === "GLOBAL") fail("dialer-proxy 不能使用会包含自身的 GLOBAL 组：" + proxy.name);
      if (!known(proxy["dialer-proxy"])) fail("dialer-proxy 引用不存在：" + proxy.name);
      visit(proxy["dialer-proxy"]);
    }
    visiting.delete(name); visited.add(name);
  }
  for (const name of groupByName.keys()) visit(name);
  for (const name of rawByName.keys()) visit(name);

  config.proxies = proxies;
  config["proxy-groups"] = groups;
  const rulesets = Object.assign({}, config["rule-providers"] || {});
  function remote(key, behavior, url) {
    rulesets[PREFIX + key] = {
      type: "http", behavior: behavior, format: "yaml", url: url,
      path: "./ruleset/" + PREFIX + key + ".yaml", interval: 86400,
      proxy: FRONT
    };
  }
  const cn = "https://raw.githubusercontent.com/mcxiaochenn/clash-rules-cn/rules/";
  const meta = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta/geo/geosite/";
  remote("ai", "domain", cn + "ai-domain.yaml");
  remote("ai-meta", "domain", meta + "category-ai-!cn.yaml");
  remote("foreign", "domain", cn + "proxy-domain.yaml");
  remote("china-domain", "domain", cn + "direct-domain.yaml");
  remote("china-ip", "ipcidr", cn + "china-ip.yaml");
  // 上游 .domain 仅匹配子域名；MetaCubeX +.domain 补齐根域名覆盖。
  remote("china-meta", "domain", meta + "cn.yaml");
  remote("baidu", "domain", meta + "baidu.yaml");
  rulesets[PREFIX + "safety"] = {type: "inline", behavior: "domain", payload: SAFETY_DOMAINS};
  config["rule-providers"] = rulesets;

  const rules = [
    "DOMAIN,localhost,DIRECT", "DOMAIN-SUFFIX,localhost,DIRECT",
    "DOMAIN-SUFFIX,local,DIRECT", "DOMAIN-SUFFIX,lan,DIRECT", "DOMAIN-SUFFIX,home.arpa,DIRECT",
    "DOMAIN-SUFFIX,internal,DIRECT", "DOMAIN-SUFFIX,localdomain,DIRECT", "DOMAIN-SUFFIX,ts.net,DIRECT"
  ];
  // 不使用会提前解析域名的 LAN rule-set；no-resolve 避免把公共域名解析到内网而绕过 AI。
  // 不直连 198.18.0.0/15，避免 fake-IP 被当作 LAN。
  for (const cidr of ["0.0.0.0/32", "10.0.0.0/8", "100.64.0.0/10", "127.0.0.0/8",
    "169.254.0.0/16", "172.16.0.0/12", "192.168.0.0/16", "224.0.0.0/4",
    "::1/128", "fc00::/7", "fe80::/10", "ff00::/8"]) {
    rules.push("IP-CIDR," + cidr + ",DIRECT,no-resolve");
  }
  function proxyRule(key) {
    const provider = PREFIX + key;
    rules.push("RULE-SET," + provider + "," + target);
    // 支持 UDP 的节点正常转发；不支持时 Mihomo 会跳过上一条，这条立即拒绝，避免匹配后面的 DIRECT。
    rules.push("AND,((NETWORK,udp),(RULE-SET," + provider + ")),REJECT");
  }
  proxyRule("safety");
  proxyRule("ai");
  proxyRule("ai-meta");
  proxyRule("foreign");
  for (const process of CHINESE_PROCESSES) rules.push("PROCESS-NAME," + process + ",DIRECT");
  rules.push("RULE-SET," + PREFIX + "baidu,DIRECT");
  rules.push("RULE-SET," + PREFIX + "china-domain,DIRECT");
  rules.push("RULE-SET," + PREFIX + "china-meta,DIRECT");
  // 不为 China IP 主动解析未知域名；已知目标 IP 仍可匹配。覆盖 IPv4/IPv6。
  rules.push("RULE-SET," + PREFIX + "china-ip,DIRECT,no-resolve");
  // 未知 UDP 先尝试主代理，不支持就拒绝；TCP 最后一条必须 MATCH → 主代理。
  rules.push("NETWORK,udp," + target, "NETWORK,udp,REJECT", "MATCH," + target);
  config.rules = rules;
  config.mode = "rule";
  config["find-process-mode"] = "always";
  // Optional direct-domain overrides keep the original custom-rule priority.
  const directDomains = SETTINGS.customDirectDomains;
  if (!Array.isArray(directDomains) || directDomains.some(domain =>
    typeof domain !== "string" || !domain || domain !== domain.trim() ||
    /[\s,/:*]/.test(domain) || domain.startsWith(".") || domain.endsWith("."))) {
    fail("customDirectDomains 请填写纯域名数组，如 [\"example.org\"]，不填协议、路径、通配符或空格。");
  }
  config.rules = unique(directDomains).map(domain =>
    "DOMAIN-SUFFIX," + domain + ",DIRECT"
  ).concat(config.rules || []);

  return config;
}

/* Upstream MIT notice:
MIT License

Copyright (c) 2026 mcxiaochenn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE
*/
