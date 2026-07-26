using System;
using System.Diagnostics;
using System.IO;

class PiD {
  static int Main() {
    try {
      string me = typeof(PiD).Assembly.Location;
      string dir = Path.GetDirectoryName(me);
      string root = dir;
      if (!File.Exists(Path.Combine(root, "package.json")))
        root = Path.GetFullPath(Path.Combine(dir, ".."));
      string ps1 = Path.Combine(root, "scripts", "launch.ps1");
      if (!File.Exists(ps1)) {
        System.Windows.Forms.MessageBox.Show(
          "launch.ps1 not found under: " + root,
          "piD");
        return 1;
      }
      var psi = new ProcessStartInfo();
      psi.FileName = "powershell.exe";
      psi.Arguments = "-NoProfile -ExecutionPolicy Bypass -File \"" + ps1 + "\"";
      psi.WorkingDirectory = root;
      psi.UseShellExecute = false;
      psi.CreateNoWindow = true;
      psi.WindowStyle = ProcessWindowStyle.Hidden;
      using (var p = Process.Start(psi)) {
        if (p == null) return 1;
        p.WaitForExit();
        return p.ExitCode;
      }
    } catch (Exception ex) {
      try { System.Windows.Forms.MessageBox.Show(ex.Message, "piD"); } catch {}
      return 1;
    }
  }
}
