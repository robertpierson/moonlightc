// CI only. Opens Windows' real credential boxes and reports what they are, so the helper is tested against the real thing.
//   Probe prompt <file>   the "Windows Security" credential box; writes whatever was typed into it to <file>
//   Probe passkey         the passkey box a website gets, through webauthn.dll
//   Probe inspect         prints the window in front: program, integrity, title, class, capture setting
//   Probe type <text>     SendInput at this process's rights, the way a normal remote-control app types
//   Probe medium <cmd> [waitMs]   starts <cmd> at normal (medium) rights, the way a program runs on a normal PC
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

static class Probe {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct CREDUI_INFO { public int cbSize; public IntPtr hwndParent; public string pszMessageText, pszCaptionText; public IntPtr hbmBanner; }
  [DllImport("credui.dll", CharSet = CharSet.Unicode)] static extern int CredUIPromptForWindowsCredentialsW(ref CREDUI_INFO info, int err, ref uint pkg, IntPtr inBuf, uint inSize, out IntPtr outBuf, out uint outSize, ref bool save, uint flags);
  [DllImport("credui.dll", CharSet = CharSet.Unicode)] static extern bool CredUnPackAuthenticationBufferW(uint flags, IntPtr buf, uint size, StringBuilder user, ref int userLen, StringBuilder domain, ref int domainLen, StringBuilder pass, ref int passLen);

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct CLIENT_DATA { public uint dwVersion, cbClientDataJSON; public IntPtr pbClientDataJSON; public string pwszHashAlgId; }
  [DllImport("webauthn.dll", CharSet = CharSet.Unicode)] static extern int WebAuthNAuthenticatorGetAssertion(IntPtr hWnd, string rpId, ref CLIENT_DATA data, IntPtr options, out IntPtr assertion);

  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr w, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr w, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr w, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool GetWindowDisplayAffinity(IntPtr w, out uint affinity);
  [DllImport("user32.dll")] static extern uint SendInput(uint n, INPUT[] i, int size);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint pid);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, uint f, StringBuilder n, ref uint s);
  [DllImport("advapi32.dll")] static extern bool OpenProcessToken(IntPtr p, uint a, out IntPtr t);
  [DllImport("advapi32.dll")] static extern bool GetTokenInformation(IntPtr t, int c, IntPtr b, int n, out int r);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthority(IntPtr s, uint i);
  [DllImport("advapi32.dll")] static extern IntPtr GetSidSubAuthorityCount(IntPtr s);

  [StructLayout(LayoutKind.Sequential)] struct SID_AND_ATTRIBUTES { public IntPtr Sid; public uint Attributes; }
  [StructLayout(LayoutKind.Sequential)] struct STARTUPINFO { public int cb; public IntPtr r1, desktop, title; public int x, y, w, h, cx, cy, fill, flags; public short show, r2; public IntPtr r3, hin, hout, herr; }
  [StructLayout(LayoutKind.Sequential)] struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int pid, tid; }
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool DuplicateTokenEx(IntPtr t, uint access, IntPtr attrs, int level, int type, out IntPtr n);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool ConvertStringSidToSid(string s, out IntPtr sid);
  [DllImport("advapi32.dll", SetLastError = true)] static extern bool SetTokenInformation(IntPtr t, int c, ref SID_AND_ATTRIBUTES i, int n);
  [DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)] static extern bool CreateProcessAsUser(IntPtr t, string app, StringBuilder cmd, IntPtr pa, IntPtr ta, bool inherit, uint flags, IntPtr env, string dir, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);

  [StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; public long pad; }
  [StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public KEYBDINPUT ki; }

  static string Integrity(IntPtr process) {
    IntPtr token;
    if (!OpenProcessToken(process, 8, out token)) return "unknown";
    int size;
    GetTokenInformation(token, 25, IntPtr.Zero, 0, out size);
    IntPtr buf = Marshal.AllocHGlobal(size);
    if (!GetTokenInformation(token, 25, buf, size, out size)) return "unknown";
    IntPtr sid = Marshal.ReadIntPtr(buf);
    int count = Marshal.ReadByte(GetSidSubAuthorityCount(sid));
    return "0x" + Marshal.ReadInt32(GetSidSubAuthority(sid, (uint)(count - 1))).ToString("x");
  }

  [STAThread]
  static int Main(string[] a) {
    switch (a[0]) {
      case "prompt": {
        var info = new CREDUI_INFO { pszCaptionText = "Windows Security", pszMessageText = "MoonlightC test box" };
        info.cbSize = Marshal.SizeOf(info);
        uint pkg = 0, outSize; IntPtr outBuf; bool save = false;
        int r = CredUIPromptForWindowsCredentialsW(ref info, 0, ref pkg, IntPtr.Zero, 0, out outBuf, out outSize, ref save, 1 /* generic */);
        string got = "";
        if (r == 0) {
          int u = 256, d = 256, p = 256;
          var user = new StringBuilder(u); var domain = new StringBuilder(d); var pass = new StringBuilder(p);
          if (CredUnPackAuthenticationBufferW(0, outBuf, outSize, user, ref u, domain, ref d, pass, ref p)) got = user + "|" + pass;
        }
        File.WriteAllText(a[1], "result=" + r + " typed=" + got);
        return 0;
      }
      case "passkey": {
        var json = Encoding.UTF8.GetBytes("{\"type\":\"webauthn.get\",\"challenge\":\"bW9vbmxpZ2h0Yw\",\"origin\":\"https://localhost\"}");
        var h = GCHandle.Alloc(json, GCHandleType.Pinned);
        var data = new CLIENT_DATA { dwVersion = 1, cbClientDataJSON = (uint)json.Length, pbClientDataJSON = h.AddrOfPinnedObject(), pwszHashAlgId = "SHA-256" };
        var f = new Form { Text = "probe", TopMost = true };
        f.Shown += (s, e) => { IntPtr o; Console.WriteLine("webauthn result 0x" + WebAuthNAuthenticatorGetAssertion(f.Handle, "localhost", ref data, IntPtr.Zero, out o).ToString("x")); f.Close(); };
        Application.Run(f);
        return 0;
      }
      case "inspect": {
        IntPtr w = GetForegroundWindow();
        uint pid; GetWindowThreadProcessId(w, out pid);
        var title = new StringBuilder(256); GetWindowText(w, title, 256);
        var cls = new StringBuilder(256); GetClassName(w, cls, 256);
        var name = new StringBuilder(1024); uint n = 1024;
        IntPtr p = OpenProcess(0x1000, false, pid);
        bool got = p != IntPtr.Zero && QueryFullProcessImageName(p, 0, name, ref n);
        uint aff; GetWindowDisplayAffinity(w, out aff);
        Console.WriteLine("front: " + (got ? name.ToString() : "pid " + pid) + " integrity=" + (p != IntPtr.Zero ? Integrity(p) : "?") + " title=\"" + title + "\" class=" + cls + " captureAffinity=" + aff);
        Console.WriteLine("me: integrity=" + Integrity(System.Diagnostics.Process.GetCurrentProcess().Handle));
        return 0;
      }
      case "medium": {
        IntPtr me, dup, sid;
        OpenProcessToken(System.Diagnostics.Process.GetCurrentProcess().Handle, 0x000B, out me); // duplicate, assign, query
        DuplicateTokenEx(me, 0x02000000, IntPtr.Zero, 2, 1, out dup);
        ConvertStringSidToSid("S-1-16-8192", out sid);
        var label = new SID_AND_ATTRIBUTES { Sid = sid, Attributes = 0x20 };
        if (!SetTokenInformation(dup, 25, ref label, Marshal.SizeOf(label) + 12)) Console.WriteLine("label failed " + Marshal.GetLastWin32Error());
        var si = new STARTUPINFO(); si.cb = Marshal.SizeOf(si);
        PROCESS_INFORMATION pi;
        if (!CreateProcessAsUser(dup, null, new StringBuilder(a[1]), IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, null, ref si, out pi)) { Console.WriteLine("start failed " + Marshal.GetLastWin32Error()); return 1; }
        if (a.Length > 2) WaitForSingleObject(pi.hProcess, uint.Parse(a[2]));
        return 0;
      }
      case "type": {
        foreach (char c in a[1]) {
          var i = new[] { new INPUT { type = 1, ki = new KEYBDINPUT { wScan = c, dwFlags = 4 } }, new INPUT { type = 1, ki = new KEYBDINPUT { wScan = c, dwFlags = 6 } } };
          Console.Write(SendInput(2, i, Marshal.SizeOf(typeof(INPUT))));
        }
        Console.WriteLine(" sent");
        return 0;
      }
    }
    return 2;
  }
}
