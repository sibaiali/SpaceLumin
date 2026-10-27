# Development Mode

Developer mode is available when the game is opened on `localhost` or `127.0.0.1`. It can also be enabled explicitly by adding `?dev=1` to the URL. In an enabled development context, click the version text seven times within two seconds to open the developer telemetry panel. Press Escape or use the panel's close button to hide it.

Client-side passwords were removed because values shipped in browser code are visible to every visitor and cannot provide authentication. The development-context check is a visibility safeguard for debug tooling, not a security boundary.

The developer panel exposes neural telemetry (jerk, entropy, chaos, and playstyle), enemy DNA evolution statistics, sector parameters, and predictive-AI risk and transition telemetry. The existing localhost-only Ghost Console remains available with Shift+Alt+L.

On production or public deployments, the developer panel is removed from the page by default and the seven-click gesture does nothing. A deployment only enables it when the URL explicitly contains `?dev=1`.
