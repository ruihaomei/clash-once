# Advanced multi-subscription menu

**Unsure which mode to choose? Start with [Standard mode](../README.en.md#get-started-in-three-steps).** If you frequently switch subscriptions, Advanced mode gives you a single selector inside your main group.

[中文](README.md)

| Option | Entry pool |
| --- | --- |
| 链式代理 A, B, C | One configured subscription each |
| 链式代理 总 | Automatic selection across all configured subscriptions |

All four choices use the same SOCKS5 exit configured at the top of the standard script. The original residential route and routing rules come from that script. Empty slots reject connections. If an existing name conflicts with the new menu or nodes, the extension keeps the standard configuration.

1. Download or clone the repository. Refresh your subscriptions in Clash Verge Rev and save each subscription's original Clash YAML using its **Edit File** menu. Each snapshot needs a top-level `proxies` list. The builder skips unsupported node types and nodes already using `dialer-proxy`.
2. Run from the repository root with Python 3.8+. Provide only the slots you need, with at least one YAML file. The paths below are examples.

   ```sh
   python3 -m pip install PyYAML
   python3 advanced/build.py --a ~/Downloads/sub-a.yaml --b ~/Downloads/sub-b.yaml --c ~/Downloads/sub-c.yaml
   ```

3. Fill in the SOCKS5 address, port, username and password at the top of the generated `clash-chain-menu.local.js`. If you already have a configured Standard script, pass its local path with `--base` to retain those settings. Back up your current extension script, paste the full generated script in its place, and save.
4. Keep Rule mode enabled. In the main selector, choose **链式代理** and then pick A, B, C, or **总** (all). Verify the residential exit IP for each configured choice and check the actual chain in the connection list. Restore the backed-up script to return to Standard mode.

Advanced mode uses local snapshots. After a subscription update, save its new YAML, rerun the builder, and replace the extension script. The four choices share each subscription's on-demand health checks, which can add a small amount of subscription traffic. These checks cover the entry node. Verify the residential exit separately.

Keep exported YAML, generated scripts, and effective configurations local because they contain proxy credentials. The builder requires neither subscription URLs nor portal passwords. Plain SOCKS5 username/password authentication is unencrypted, so use entry nodes you trust.
