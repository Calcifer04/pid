use std::io::{BufRead, BufReader};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager, RunEvent};

const PORT: u16 = 4000;

struct ServerChild(Mutex<Option<Child>>);

fn project_root(app: &AppHandle) -> PathBuf {
    if let Ok(p) = std::env::var("PID_ROOT") {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            return pb;
        }
    }
    // Dev: cwd is usually the JS project root (tauri.conf build cwd)
    if let Ok(cwd) = std::env::current_dir() {
        if cwd.join("package.json").is_file() {
            return cwd;
        }
        if cwd.join("../package.json").is_file() {
            return cwd.join("..").canonicalize().unwrap_or(cwd);
        }
    }
    // Packaged: look next to the executable (portable layout)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            for cand in [dir.to_path_buf(), dir.join(".."), dir.join("../..")] {
                if let Ok(c) = cand.canonicalize() {
                    if c.join("package.json").is_file() {
                        return c;
                    }
                }
            }
        }
    }
    // Resource dir fallback
    if let Ok(res) = app.path().resource_dir() {
        if res.join("package.json").is_file() {
            return res;
        }
        if res.join("../package.json").is_file() {
            return res.join("..").canonicalize().unwrap_or(res);
        }
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

fn port_open(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port)).is_ok()
}

fn wait_for_server(port: u16, timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if port_open(port) {
            return true;
        }
        thread::sleep(Duration::from_millis(100));
    }
    false
}

fn find_node() -> PathBuf {
    if cfg!(windows) {
        which("node.exe").unwrap_or_else(|| PathBuf::from("node"))
    } else {
        which("node").unwrap_or_else(|| PathBuf::from("node"))
    }
}

fn which(name: &str) -> Option<PathBuf> {
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            let cand = dir.join(name);
            if cand.is_file() {
                return Some(cand);
            }
        }
    }
    None
}

fn resolve_server_js(root: &Path, app: &AppHandle) -> PathBuf {
    let candidates = [
        root.join("dist-server/pid-server.mjs"),
        app.path()
            .resource_dir()
            .map(|r| r.join("pid-server.mjs"))
            .unwrap_or_default(),
        app.path()
            .resource_dir()
            .map(|r| r.join("dist-server/pid-server.mjs"))
            .unwrap_or_default(),
    ];
    for c in candidates {
        if c.is_file() {
            return c;
        }
    }
    root.join("dist-server/pid-server.mjs")
}

fn start_backend(root: &Path, app: &AppHandle) -> Result<Option<Child>, String> {
    if port_open(PORT) {
        eprintln!("πD: server already on :{PORT}");
        return Ok(None);
    }

    let server_js = resolve_server_js(root, app);
    let node = find_node();

    // Prefer bundled standalone server; fall back to vite preview
    let mut cmd = if server_js.is_file() {
        let mut c = Command::new(&node);
        c.arg(&server_js);
        c.env("PID_ROOT", root);
        c.env("PID_PORT", PORT.to_string());
        c.env("PID_HOST", "127.0.0.1");
        c
    } else {
        let npx = if cfg!(windows) {
            which("npx.cmd").unwrap_or_else(|| PathBuf::from("npx.cmd"))
        } else {
            which("npx").unwrap_or_else(|| PathBuf::from("npx"))
        };
        let mut c = Command::new(npx);
        c.args([
            "vite",
            "preview",
            "--host",
            "127.0.0.1",
            "--port",
            &PORT.to_string(),
            "--strictPort",
        ]);
        c
    };

    cmd.current_dir(root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to start πD server (is Node installed?): {e}"))?;

    // Stream logs
    if let Some(out) = child.stdout.take() {
        thread::spawn(move || {
            for line in BufReader::new(out).lines().flatten() {
                eprintln!("[pid-server] {line}");
            }
        });
    }
    if let Some(err) = child.stderr.take() {
        thread::spawn(move || {
            for line in BufReader::new(err).lines().flatten() {
                eprintln!("[pid-server] {line}");
            }
        });
    }

    if !wait_for_server(PORT, Duration::from_secs(30)) {
        let _ = child.kill();
        return Err(
            "πD server did not become ready on port 4000. Run: npm run build && npm run build:server"
                .into(),
        );
    }

    eprintln!("πD: backend ready on http://127.0.0.1:{PORT}/");
    Ok(Some(child))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(ServerChild(Mutex::new(None)))
        .setup(|app| {
            let root = project_root(app.handle());
            eprintln!("πD: project root {}", root.display());

            // Ensure dist exists in prod
            if !root.join("dist/index.html").is_file() {
                eprintln!("πD: dist missing — run npm run build");
            }

            match start_backend(&root, app.handle()) {
                Ok(child) => {
                    if let Some(c) = child {
                        *app.state::<ServerChild>().0.lock().unwrap() = Some(c);
                    }
                }
                Err(e) => {
                    eprintln!("πD backend error: {e}");
                    // still show window; UI may error on API
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                let mut child = app_handle
                    .state::<ServerChild>()
                    .0
                    .lock()
                    .ok()
                    .and_then(|mut g| g.take());
                if let Some(ref mut c) = child {
                    let _ = c.kill();
                    let _ = c.wait();
                }
            }
        });
}
