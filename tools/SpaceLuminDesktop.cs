using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("Lumin Flow: Utopia Run")]
[assembly: AssemblyDescription("SpaceLumin - Bio-Cybernetic Space Survival Odyssey")]
[assembly: AssemblyCompany("Lumin Flow Studios")]
[assembly: AssemblyCopyright("Copyright © 2026 Lumin Flow Studios. Protected under German UrhG §§ 69a, 95a & EU Law.")]
[assembly: AssemblyTrademark("Lumin Flow Studios™")]
[assembly: AssemblyProduct("Lumin Flow: Utopia Run")]
[assembly: AssemblyVersion("4.5.0.0")]
[assembly: AssemblyFileVersion("4.5.0.0")]

namespace SpaceLuminDesktop
{
    public class LocalGameServer
    {
        private TcpListener _listener;
        private bool _running;
        private string _rootDir;
        public int Port { get; private set; }

        public LocalGameServer(string rootDir)
        {
            _rootDir = rootDir;
            _listener = new TcpListener(IPAddress.Loopback, 0);
            _listener.Start();
            Port = ((IPEndPoint)_listener.LocalEndpoint).Port;
            _running = true;

            Thread serverThread = new Thread(AcceptLoop);
            serverThread.IsBackground = true;
            serverThread.Start();
        }

        public void Stop()
        {
            _running = false;
            try { _listener.Stop(); } catch { }
        }

        private void AcceptLoop()
        {
            while (_running)
            {
                try
                {
                    TcpClient client = _listener.AcceptTcpClient();
                    ThreadPool.QueueUserWorkItem(HandleClient, client);
                }
                catch
                {
                    if (!_running) break;
                }
            }
        }

        private void HandleClient(object state)
        {
            using (TcpClient client = (TcpClient)state)
            {
                try
                {
                    client.ReceiveTimeout = 5000;
                    client.SendTimeout = 5000;
                    using (NetworkStream stream = client.GetStream())
                    {
                        byte[] buf = new byte[4096];
                        int read = stream.Read(buf, 0, buf.Length);
                        if (read <= 0) return;

                        string req = Encoding.UTF8.GetString(buf, 0, read);
                        string[] lines = req.Split(new string[] { "\r\n", "\n" }, StringSplitOptions.None);
                        if (lines.Length == 0) return;

                        string[] parts = lines[0].Split(' ');
                        if (parts.Length < 2) return;

                        string method = parts[0];
                        string rawUrl = parts[1];
                        if (method == "POST" && rawUrl.StartsWith("/api/telemetry/screened"))
                        {
                            try {
                                int bodyIdx = req.IndexOf("\r\n\r\n");
                                if (bodyIdx > 0) {
                                    string jsonBody = req.Substring(bodyIdx + 4).Trim();
                                    string dataDir = Path.Combine(_rootDir, "data");
                                    Directory.CreateDirectory(dataDir);
                                    File.AppendAllText(Path.Combine(dataDir, "screened_sessions.jsonl"), jsonBody + Environment.NewLine);
                                }
                            } catch { }
                            WriteResponse(stream, "200 OK", "application/json", Encoding.UTF8.GetBytes("{\"ok\":true}"));
                            return;
                        }
                        int qIdx = rawUrl.IndexOf('?');
                        string urlPath = qIdx >= 0 ? rawUrl.Substring(0, qIdx) : rawUrl;
                        urlPath = Uri.UnescapeDataString(urlPath);

                        if (urlPath == "/" || string.IsNullOrEmpty(urlPath))
                        {
                            urlPath = "/index.html";
                        }

                        string relPath = urlPath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                        string fullPath = Path.GetFullPath(Path.Combine(_rootDir, relPath));

                        // Security check: keep within root directory
                        if (!fullPath.StartsWith(Path.GetFullPath(_rootDir), StringComparison.OrdinalIgnoreCase))
                        {
                            WriteResponse(stream, "403 Forbidden", "text/plain", Encoding.UTF8.GetBytes("Forbidden"));
                            return;
                        }

                        if (!File.Exists(fullPath))
                        {
                            WriteResponse(stream, "404 Not Found", "text/plain", Encoding.UTF8.GetBytes("Not Found: " + urlPath));
                            return;
                        }

                        byte[] body = File.ReadAllBytes(fullPath);
                        string mime = GetMimeType(Path.GetExtension(fullPath));
                        WriteResponse(stream, "200 OK", mime, body);
                    }
                }
                catch { }
            }
        }

        private void WriteResponse(NetworkStream stream, string status, string mime, byte[] body)
        {
            string header = "HTTP/1.1 " + status + "\r\n" +
                            "Content-Type: " + mime + "\r\n" +
                            "Content-Length: " + body.Length + "\r\n" +
                            "Cache-Control: no-cache\r\n" +
                            "X-Frame-Options: DENY\r\n" +
                            "X-Content-Type-Options: nosniff\r\n" +
                            "Cross-Origin-Resource-Policy: same-origin\r\n" +
                            "TDM-Reservation: 1\r\n" +
                            "X-Copyright-Protection: German-UrhG-69a-95a-EU-2009-24-EC\r\n" +
                            "Connection: close\r\n\r\n";
            byte[] headerBytes = Encoding.UTF8.GetBytes(header);
            stream.Write(headerBytes, 0, headerBytes.Length);
            stream.Write(body, 0, body.Length);
            stream.Flush();
        }

        private string GetMimeType(string ext)
        {
            switch (ext.ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".js": return "application/javascript; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".ico": return "image/x-icon";
                case ".woff": return "font/woff";
                case ".woff2": return "font/woff2";
                default: return "application/octet-stream";
            }
        }
    }

    public class LauncherForm : Form
    {
        private LocalGameServer _server;
        private string _gameUrl;

        public LauncherForm(string rootDir)
        {
            _server = new LocalGameServer(rootDir);
            _gameUrl = "http://127.0.0.1:" + _server.Port + "/?dev=1";

            this.Text = "Lumin Flow: Utopia Run · Desktop Engine";
            this.Size = new Size(440, 290);
            this.FormBorderStyle = FormBorderStyle.FixedSingle;
            this.MaximizeBox = false;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.BackColor = Color.FromArgb(3, 10, 19);
            this.ForeColor = Color.FromArgb(240, 230, 210);

            try
            {
                this.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch { }

            Label titleLbl = new Label();
            titleLbl.Text = "LUMIN FLOW: UTOPIA RUN";
            titleLbl.Font = new Font("Segoe UI", 14, FontStyle.Bold);
            titleLbl.ForeColor = Color.FromArgb(200, 170, 110);
            titleLbl.AutoSize = false;
            titleLbl.TextAlign = ContentAlignment.MiddleCenter;
            titleLbl.Bounds = new Rectangle(20, 18, 385, 30);
            this.Controls.Add(titleLbl);

            Label subLbl = new Label();
            subLbl.Text = "v4.0 Bio-Cybernetic Singularity Edition\nLocal Engine Active on 127.0.0.1:" + _server.Port;
            subLbl.Font = new Font("Segoe UI", 9, FontStyle.Regular);
            subLbl.ForeColor = Color.FromArgb(34, 211, 238);
            subLbl.AutoSize = false;
            subLbl.TextAlign = ContentAlignment.MiddleCenter;
            subLbl.Bounds = new Rectangle(20, 50, 385, 38);
            this.Controls.Add(subLbl);

            Button playBtn = CreateHexButton("▶ LAUNCH GAME WINDOW", 98, Color.FromArgb(10, 200, 185));
            playBtn.Click += (s, e) => LaunchAppWindow(_gameUrl);
            this.Controls.Add(playBtn);

            Button browserBtn = CreateHexButton("🌐 OPEN IN DEFAULT BROWSER", 146, Color.FromArgb(200, 170, 110));
            browserBtn.Click += (s, e) => { try { Process.Start(_gameUrl); } catch { } };
            this.Controls.Add(browserBtn);

            Button quitBtn = CreateHexButton("✕ STOP ENGINE && EXIT", 194, Color.FromArgb(239, 68, 68));
            quitBtn.Click += (s, e) => this.Close();
            this.Controls.Add(quitBtn);

            this.Shown += (s, e) =>
            {
                LaunchAppWindow(_gameUrl);
            };

            this.FormClosing += (s, e) =>
            {
                _server.Stop();
            };
        }

        private Button CreateHexButton(string text, int top, Color borderCol)
        {
            Button btn = new Button();
            btn.Text = text;
            btn.Font = new Font("Segoe UI", 9.5f, FontStyle.Bold);
            btn.ForeColor = Color.FromArgb(240, 230, 210);
            btn.BackColor = Color.FromArgb(15, 23, 42);
            btn.FlatStyle = FlatStyle.Flat;
            btn.FlatAppearance.BorderColor = borderCol;
            btn.FlatAppearance.BorderSize = 1;
            btn.Bounds = new Rectangle(40, top, 345, 38);
            btn.Cursor = Cursors.Hand;
            return btn;
        }

        public static void LaunchAppWindow(string url)
        {
            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\Edge\Application\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\Chrome\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\Chrome\Application\chrome.exe")
            };

            foreach (string exe in candidates)
            {
                if (File.Exists(exe))
                {
                    try
                    {
                        ProcessStartInfo psi = new ProcessStartInfo();
                        psi.FileName = exe;
                        psi.Arguments = "--app=\"" + url + "\" --window-size=1366,840";
                        psi.UseShellExecute = false;
                        Process.Start(psi);
                        return;
                    }
                    catch { }
                }
            }

            try
            {
                Process.Start(url);
            }
            catch { }
        }
    }

    static class Program
    {
        [STAThread]
        static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string rootDir = baseDir;
            if (!File.Exists(Path.Combine(rootDir, "index.html")))
            {
                string parent = Path.GetFullPath(Path.Combine(baseDir, ".."));
                if (File.Exists(Path.Combine(parent, "index.html")))
                {
                    rootDir = parent;
                }
            }

            Application.Run(new LauncherForm(rootDir));
        }
    }
}
