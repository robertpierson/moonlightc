// Types into Windows' own credential box (CredentialUIBroker.exe) for MoonlightC remote control, and nothing else.
// Since the January 2026 Windows update (CVE-2026-20824) that box ignores input from normal-rights apps. Microsoft's
// listed mitigation is sending it with administrator rights, so this small program runs that way, on request, from a
// folder only administrators can change. MoonlightC itself keeps normal rights, because Windows refuses live screen
// capture to an elevated app.
//
// Limits: every press is refused unless Windows' own CredentialUIBroker.exe is the window in front, and for a click,
// also the window under the pointer. No Ctrl, Alt or Windows keys. Stores and logs nothing. Exits when MoonlightC hangs up.
//
// Lines on the pipe: "c <char code>"  "k <virtual key> d|u"  "m <l|r> d|u <x> <y>". Replies "1" (done) or "0" (refused).
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;
using System.Threading;

static class MoonlightCInput {
  [StructLayout(LayoutKind.Sequential)] struct POINT { public int x, y; }
  [StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct UNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public UNION u; }

  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w, out uint pid);
  [DllImport("user32.dll")] static extern IntPtr WindowFromPoint(POINT p);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr w, uint flags);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] inputs, int size);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, uint flags, StringBuilder name, ref uint size);

  static readonly string Broker = Path.Combine(Environment.SystemDirectory, "CredentialUIBroker.exe");
  static readonly HashSet<ushort> DownKeys = new HashSet<ushort>();
  static readonly HashSet<char> DownButtons = new HashSet<char>();

  static bool IsBroker(IntPtr window) {
    if (window == IntPtr.Zero) return false;
    uint pid;
    GetWindowThreadProcessId(window, out pid);
    IntPtr p = OpenProcess(0x1000, false, pid); // limited query
    if (p == IntPtr.Zero) return false;
    var name = new StringBuilder(1024);
    uint size = 1024;
    bool ok = QueryFullProcessImageName(p, 0, name, ref size);
    CloseHandle(p);
    return ok && string.Equals(name.ToString(), Broker, StringComparison.OrdinalIgnoreCase);
  }

  static void Send(INPUT i) { SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  static void Key(ushort vk, ushort scan, uint flags) {
    var i = new INPUT { type = 1 };
    i.u.ki = new KEYBDINPUT { wVk = vk, wScan = scan, dwFlags = flags };
    Send(i);
  }
  static void Button(char which, bool down) {
    var i = new INPUT { type = 0 };
    i.u.mi = new MOUSEINPUT { dwFlags = which == 'r' ? (down ? 8u : 16u) : (down ? 2u : 4u) };
    Send(i);
  }

  // Shift, and the keys a PIN or password box uses. No Ctrl (17), Alt (18) or Windows (91, 92).
  static bool Allowed(int vk) {
    return vk == 8 || vk == 9 || vk == 13 || vk == 16 || vk == 27 || vk == 32 || vk == 46 || (vk >= 35 && vk <= 40)
      || (vk >= 0x30 && vk <= 0x39) || (vk >= 0x41 && vk <= 0x5A) || (vk >= 0x60 && vk <= 0x69);
  }

  static bool Run(string[] a) {
    // Letting go is always allowed, so nothing stays stuck if the box closes between press and release.
    if (a[0] == "k" && a.Length == 3) {
      int vk = int.Parse(a[1]);
      if (!Allowed(vk)) return false;
      if (a[2] == "u") { if (DownKeys.Remove((ushort)vk)) Key((ushort)vk, 0, 2); return true; }
      if (!IsBroker(GetForegroundWindow())) return false;
      DownKeys.Add((ushort)vk);
      Key((ushort)vk, 0, 0);
      return true;
    }
    if (a[0] == "c" && a.Length == 2) {
      int c = int.Parse(a[1]);
      if (c < 32 || c > 0xFFFF || !IsBroker(GetForegroundWindow())) return false;
      if (c >= '0' && c <= '9') { Key((ushort)c, 0, 0); Key((ushort)c, 0, 2); } // a PIN box takes real number keys
      else { Key(0, (ushort)c, 4); Key(0, (ushort)c, 6); }
      return true;
    }
    if (a[0] == "m" && a.Length == 5 && (a[1] == "l" || a[1] == "r")) {
      char which = a[1][0];
      if (a[2] == "u") { if (DownButtons.Remove(which)) Button(which, false); return true; }
      if (!IsBroker(GetForegroundWindow())) return false;
      var at = new POINT { x = int.Parse(a[3]), y = int.Parse(a[4]) };
      if (!IsBroker(GetAncestor(WindowFromPoint(at), 2))) return false; // 2 = the top-level window
      SetCursorPos(at.x, at.y);
      DownButtons.Add(which);
      Button(which, true);
      return true;
    }
    return false;
  }

  static void LetGo() {
    foreach (var k in DownKeys) Key(k, 0, 2);
    foreach (var b in DownButtons) Button(b, false);
  }

  static int Main() {
    SetProcessDpiAwarenessContext(new IntPtr(-4)); // the same pixels MoonlightC's mouse uses
    var security = new PipeSecurity();
    security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.ReadWrite | PipeAccessRights.CreateNewInstance, AccessControlType.Allow));
    NamedPipeServerStream pipe;
    try { pipe = new NamedPipeServerStream("moonlightc-credential-input", PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.None, 1024, 1024, security); }
    catch (IOException) { return 1; } // another copy already runs
    // Nobody connected within a minute: go away.
    var giveUp = new Timer(_ => { if (!pipe.IsConnected) Environment.Exit(0); }, null, 60000, Timeout.Infinite);
    pipe.WaitForConnection();
    giveUp.Dispose();
    using (var read = new StreamReader(pipe, new UTF8Encoding(false)))
    using (var write = new StreamWriter(pipe, new UTF8Encoding(false)) { AutoFlush = true, NewLine = "\n" }) {
      try {
        string line;
        while ((line = read.ReadLine()) != null) {
          bool ok;
          try { ok = Run(line.Split(' ')); } catch (FormatException) { ok = false; } catch (OverflowException) { ok = false; }
          write.WriteLine(ok ? "1" : "0");
        }
      } catch (IOException) { }
    }
    LetGo();
    return 0;
  }
}
