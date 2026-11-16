using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace VaultStreamDesktop
{
    internal sealed class VaultStreamApp : ApplicationContext
    {
        private const string RepoUrl = "https://github.com/swagfromnorth-creator/music.git";
        private const string HealthUrl = "http://127.0.0.1:3456/api/health";
        private const string AppUrl = "http://127.0.0.1:3456";

        private readonly string _appDataDir;
        private readonly string _repoRoot;
        private readonly string _nodeExe;
        private readonly string _gitExe;
        private readonly string _browserExe;

        private readonly NotifyIcon _trayIcon;
        private readonly object _procLock = new object();

        private Process _serverProc;
        private Process _appWindowProc;
        private DateTime _appWindowLaunchedAt;
        private volatile bool _shuttingDown;
        private volatile bool _ownsServer;

        public VaultStreamApp()
        {
            _appDataDir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "VaultStream"
            );
            Directory.CreateDirectory(_appDataDir);

            _gitExe = FindGitExecutable();
            _nodeExe = FindNodeExecutable();
            _browserExe = FindAppBrowserExecutable();
            _repoRoot = ResolveOrCloneRepo();

            Icon appIcon = null;
            try
            {
                appIcon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            }
            catch
            {
                appIcon = SystemIcons.Application;
            }

            var menu = new ContextMenuStrip();
            menu.Items.Add("Open VaultStream", null, (s, e) => OpenAppWindow());
            menu.Items.Add("Check GitHub Updates Now", null, (s, e) => TriggerManualUpdateCheck());
            menu.Items.Add("Open Project Folder", null, (s, e) => Process.Start("explorer.exe", _repoRoot));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Quit VaultStream", null, (s, e) => ShutdownAll());

            _trayIcon = new NotifyIcon
            {
                Icon = appIcon ?? SystemIcons.Application,
                Text = "VaultStream — Lossless Player (Auto-Updating)",
                ContextMenuStrip = menu,
                Visible = true,
            };
            _trayIcon.DoubleClick += (s, e) => OpenAppWindow();

            ThreadPool.QueueUserWorkItem(_ => BootstrapAndRun());
        }

        private void BootstrapAndRun()
        {
            try
            {
                if (string.IsNullOrEmpty(_nodeExe))
                {
                    ShowFatalAndExit("Node.js v24+ was not found on this machine. Install Node.js from https://nodejs.org and try again.");
                    return;
                }

                if (string.IsNullOrEmpty(_repoRoot) || !File.Exists(Path.Combine(_repoRoot, "src", "server.ts")))
                {
                    ShowFatalAndExit("Could not locate or clone the VaultStream repository.");
                    return;
                }

                if (!IsHealthOk())
                {
                    PullUpdatesBeforeLaunch();
                    EnsureNodeModules();
                    StartSupervisedServer();
                }

                if (!WaitForServerReady(18000))
                {
                    ShowBalloon("VaultStream failed to start on port 3456. Check data\\server.log.", ToolTipIcon.Error);
                    return;
                }

                OpenAppWindow();
            }
            catch (Exception ex)
            {
                ShowFatalAndExit("Failed to start VaultStream: " + ex.Message);
            }
        }

        private string ResolveOrCloneRepo()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd('\\', '/');
            string parentDir = Directory.GetParent(exeDir) != null ? Directory.GetParent(exeDir).FullName : "";
            string savedPathFile = Path.Combine(_appDataDir, "repo-path.txt");
            string savedPath = File.Exists(savedPathFile) ? File.ReadAllText(savedPathFile, Encoding.UTF8).Trim() : "";

            string[] candidates = new[]
            {
                exeDir,
                parentDir,
                savedPath,
                @"C:\Users\manny\.gemini\antigravity\scratch\music",
                Path.Combine(_appDataDir, "repo")
            };

            foreach (string dir in candidates)
            {
                if (!string.IsNullOrEmpty(dir) && File.Exists(Path.Combine(dir, "src", "server.ts")))
                {
                    try { File.WriteAllText(savedPathFile, dir, Encoding.UTF8); } catch { }
                    return dir;
                }
            }

            if (!string.IsNullOrEmpty(_gitExe))
            {
                string cloneTarget = Path.Combine(_appDataDir, "repo");
                RunHiddenProcess(_gitExe, "clone \"" + RepoUrl + "\" \"" + cloneTarget + "\"", _appDataDir, 60000);
                if (File.Exists(Path.Combine(cloneTarget, "src", "server.ts")))
                {
                    try { File.WriteAllText(savedPathFile, cloneTarget, Encoding.UTF8); } catch { }
                    return cloneTarget;
                }
            }

            return null;
        }

        private void PullUpdatesBeforeLaunch()
        {
            if (string.IsNullOrEmpty(_gitExe) || !Directory.Exists(Path.Combine(_repoRoot, ".git")))
                return;

            string beforeHash = RunHiddenCapture(_gitExe, "rev-parse --short HEAD", _repoRoot, 5000);
            RunHiddenProcess(_gitExe, "pull --rebase --autostash origin main", _repoRoot, 12000);
            string afterHash = RunHiddenCapture(_gitExe, "rev-parse --short HEAD", _repoRoot, 5000);

            if (!string.IsNullOrEmpty(beforeHash) && !string.IsNullOrEmpty(afterHash) && beforeHash != afterHash)
            {
                string changed = RunHiddenCapture(_gitExe, "diff --name-only " + beforeHash + " " + afterHash, _repoRoot, 5000);
                if (changed != null && (changed.IndexOf("package.json", StringComparison.OrdinalIgnoreCase) >= 0 ||
                                        changed.IndexOf("package-lock.json", StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    RunHiddenProcess("cmd.exe", "/c npm.cmd install", _repoRoot, 60000);
                }
            }
        }

        private void EnsureNodeModules()
        {
            if (!Directory.Exists(Path.Combine(_repoRoot, "node_modules")))
            {
                RunHiddenProcess("cmd.exe", "/c npm.cmd install", _repoRoot, 60000);
            }
        }

        private void StartSupervisedServer()
        {
            lock (_procLock)
            {
                if (_shuttingDown) return;

                string dataDir = Path.Combine(_repoRoot, "data");
                Directory.CreateDirectory(dataDir);
                string logPath = Path.Combine(dataDir, "server.log");

                var psi = new ProcessStartInfo
                {
                    FileName = _nodeExe,
                    Arguments = "src\\server.ts",
                    WorkingDirectory = _repoRoot,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                };
                psi.EnvironmentVariables["VAULTSTREAM_SUPERVISED"] = "1";

                var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
                proc.OutputDataReceived += (s, e) => AppendLog(logPath, e.Data);
                proc.ErrorDataReceived += (s, e) => AppendLog(logPath, e.Data);
                proc.Exited += (s, e) =>
                {
                    int code = 0;
                    try { code = proc.ExitCode; } catch { }
                    if (!_shuttingDown && code == 42)
                    {
                        Thread.Sleep(350);
                        StartSupervisedServer();
                    }
                };

                proc.Start();
                proc.BeginOutputReadLine();
                proc.BeginErrorReadLine();
                _serverProc = proc;
                _ownsServer = true;
            }
        }

        private void OpenAppWindow()
        {
            if (_shuttingDown) return;

            if (!string.IsNullOrEmpty(_browserExe))
            {
                string profileDir = Path.Combine(_appDataDir, "edge-profile");
                Directory.CreateDirectory(profileDir);
                string args =
                    "--app=" + AppUrl +
                    " --user-data-dir=\"" + profileDir + "\"" +
                    " --window-size=1340,860" +
                    " --no-first-run --no-default-browser-check";

                var psi = new ProcessStartInfo
                {
                    FileName = _browserExe,
                    Arguments = args,
                    UseShellExecute = false,
                };

                var proc = new Process { StartInfo = psi, EnableRaisingEvents = true };
                _appWindowLaunchedAt = DateTime.UtcNow;
                proc.Exited += (s, e) =>
                {
                    double aliveSec = (DateTime.UtcNow - _appWindowLaunchedAt).TotalSeconds;
                    if (_ownsServer && !_shuttingDown && aliveSec > 2.0)
                    {
                        ShutdownAll();
                    }
                };
                proc.Start();
                _appWindowProc = proc;
            }
            else
            {
                Process.Start(AppUrl);
            }
        }

        private void TriggerManualUpdateCheck()
        {
            ThreadPool.QueueUserWorkItem(_ =>
            {
                try
                {
                    using (var wc = new WebClient())
                    {
                        wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                        string resp = wc.UploadString("http://127.0.0.1:3456/api/update/apply", "POST", "{}");
                        if (resp.Contains("\"updated\":true"))
                        {
                            ShowBalloon("Pulled latest update from GitHub!", ToolTipIcon.Info);
                            if (resp.Contains("\"needsServerRestart\":true"))
                            {
                                wc.UploadString("http://127.0.0.1:3456/api/update/restart", "POST", "{}");
                            }
                        }
                        else
                        {
                            ShowBalloon("VaultStream is already up to date.", ToolTipIcon.Info);
                        }
                    }
                }
                catch (Exception ex)
                {
                    ShowBalloon("Update check failed: " + ex.Message, ToolTipIcon.Warning);
                }
            });
        }

        private void ShutdownAll()
        {
            if (_shuttingDown) return;
            _shuttingDown = true;

            try
            {
                lock (_procLock)
                {
                    if (_ownsServer && _serverProc != null && !_serverProc.HasExited)
                    {
                        _serverProc.Kill();
                    }
                }
            }
            catch { }

            try
            {
                if (_appWindowProc != null && !_appWindowProc.HasExited)
                {
                    _appWindowProc.CloseMainWindow();
                }
            }
            catch { }

            try
            {
                _trayIcon.Visible = false;
                _trayIcon.Dispose();
            }
            catch { }

            ExitThread();
        }

        private static bool WaitForServerReady(int timeoutMs)
        {
            DateTime deadline = DateTime.UtcNow.AddMilliseconds(timeoutMs);
            while (DateTime.UtcNow < deadline)
            {
                if (IsHealthOk()) return true;
                Thread.Sleep(180);
            }
            return false;
        }

        private static bool IsHealthOk()
        {
            try
            {
                var req = (HttpWebRequest)WebRequest.Create(HealthUrl);
                req.Timeout = 1000;
                using (var resp = (HttpWebResponse)req.GetResponse())
                {
                    return resp.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private void ShowBalloon(string text, ToolTipIcon icon)
        {
            try
            {
                _trayIcon.ShowBalloonTip(3000, "VaultStream", text, icon);
            }
            catch { }
        }

        private void ShowFatalAndExit(string message)
        {
            MessageBox.Show(message, "VaultStream", MessageBoxButtons.OK, MessageBoxIcon.Error);
            ShutdownAll();
        }

        private static void AppendLog(string logPath, string line)
        {
            if (string.IsNullOrEmpty(line)) return;
            try
            {
                File.AppendAllText(logPath, line + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        private static void RunHiddenProcess(string exe, string args, string cwd, int timeoutMs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = args,
                    WorkingDirectory = cwd,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                };
                psi.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0";
                using (var p = Process.Start(psi))
                {
                    if (p != null) p.WaitForExit(timeoutMs);
                }
            }
            catch { }
        }

        private static string RunHiddenCapture(string exe, string args, string cwd, int timeoutMs)
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = exe,
                    Arguments = args,
                    WorkingDirectory = cwd,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                };
                psi.EnvironmentVariables["GIT_TERMINAL_PROMPT"] = "0";
                using (var p = Process.Start(psi))
                {
                    if (p == null) return null;
                    string outStr = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(timeoutMs);
                    return outStr != null ? outStr.Trim() : null;
                }
            }
            catch
            {
                return null;
            }
        }

        private static string FindNodeExecutable()
        {
            string fromPath = FindInPath("node.exe");
            if (!string.IsNullOrEmpty(fromPath)) return fromPath;
            string[] known = new[]
            {
                @"C:\Program Files\nodejs\node.exe",
                @"C:\Program Files (x86)\nodejs\node.exe"
            };
            foreach (string k in known) if (File.Exists(k)) return k;
            return null;
        }

        private static string FindGitExecutable()
        {
            string fromPath = FindInPath("git.exe");
            if (!string.IsNullOrEmpty(fromPath)) return fromPath;

            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string wingetPkgs = Path.Combine(localApp, "Microsoft", "WinGet", "Packages");
            if (Directory.Exists(wingetPkgs))
            {
                foreach (string dir in Directory.GetDirectories(wingetPkgs, "Git.MinGit*"))
                {
                    string candidate = Path.Combine(dir, "cmd", "git.exe");
                    if (File.Exists(candidate)) return candidate;
                }
            }

            string[] known = new[]
            {
                Path.Combine(localApp, "Programs", "Git", "cmd", "git.exe"),
                @"C:\Program Files\Git\cmd\git.exe",
                @"C:\Program Files (x86)\Git\cmd\git.exe",
                @"C:\Program Files\Microsoft Visual Studio\18\Community\Common7\IDE\CommonExtensions\Microsoft\TeamFoundation\Team Explorer\Git\cmd\git.exe"
            };
            foreach (string k in known) if (File.Exists(k)) return k;
            return null;
        }

        private static string FindAppBrowserExecutable()
        {
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string[] candidates = new[]
            {
                @"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
                @"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
                Path.Combine(localApp, @"Microsoft\Edge\Application\msedge.exe"),
                @"C:\Program Files\Google\Chrome\Application\chrome.exe",
                @"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
                Path.Combine(localApp, @"Google\Chrome\Application\chrome.exe"),
            };
            foreach (string c in candidates) if (File.Exists(c)) return c;
            return null;
        }

        private static string FindInPath(string exeName)
        {
            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string rawDir in pathEnv.Split(';'))
            {
                string dir = rawDir.Trim();
                if (string.IsNullOrEmpty(dir)) continue;
                try
                {
                    string full = Path.Combine(dir, exeName);
                    if (File.Exists(full)) return full;
                }
                catch { }
            }
            return null;
        }

        [STAThread]
        private static void Main()
        {
            bool createdNew;
            using (var mutex = new Mutex(true, @"Local\VaultStreamDesktopAppMutex", out createdNew))
            {
                if (!createdNew)
                {
                    // Already running: just pop open an app window cleanly
                    string browser = FindAppBrowserExecutable();
                    if (!string.IsNullOrEmpty(browser))
                    {
                        string profile = Path.Combine(
                            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                            "VaultStream",
                            "edge-profile"
                        );
                        Process.Start(browser, "--app=" + AppUrl + " --user-data-dir=\"" + profile + "\"");
                    }
                    else
                    {
                        Process.Start(AppUrl);
                    }
                    return;
                }

                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                Application.Run(new VaultStreamApp());
            }
        }
    }
}
