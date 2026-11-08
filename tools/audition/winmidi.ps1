# Opens the Microsoft GS Wavetable Synth through winmm and plays the MIDI messages
# it reads from standard input, one per line: "status data1 data2" (decimal).
# The line "RESET" silences everything. Started by bridge.mjs, not meant to be run by hand.

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class WinMidi {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
  public struct MIDIOUTCAPS {
    public ushort wMid; public ushort wPid; public uint vDriverVersion;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst=32)] public string szPname;
    public ushort wTechnology; public ushort wVoices; public ushort wNotes; public ushort wChannelMask; public uint dwSupport;
  }
  [DllImport("winmm.dll")] public static extern uint midiOutGetNumDevs();
  [DllImport("winmm.dll", CharSet=CharSet.Auto)] public static extern uint midiOutGetDevCaps(IntPtr id, ref MIDIOUTCAPS caps, uint size);
  [DllImport("winmm.dll")] public static extern uint midiOutOpen(out IntPtr handle, uint id, IntPtr cb, IntPtr inst, uint flags);
  [DllImport("winmm.dll")] public static extern uint midiOutShortMsg(IntPtr handle, uint msg);
  [DllImport("winmm.dll")] public static extern uint midiOutReset(IntPtr handle);
  [DllImport("winmm.dll")] public static extern uint midiOutClose(IntPtr handle);
  public static string Name(int i) {
    MIDIOUTCAPS c = new MIDIOUTCAPS();
    midiOutGetDevCaps(new IntPtr(i), ref c, (uint)Marshal.SizeOf(c));
    return c.szPname;
  }
}
'@

$found = -1
$count = [WinMidi]::midiOutGetNumDevs()
for ($i = 0; $i -lt $count; $i++) {
  if ([WinMidi]::Name($i) -like '*GS Wavetable*') { $found = $i; break }
}
if ($found -lt 0) { [Console]::Out.WriteLine('NOSYNTH'); [Console]::Out.Flush(); exit 2 }

$handle = [IntPtr]::Zero
$rc = [WinMidi]::midiOutOpen([ref]$handle, [uint32]$found, [IntPtr]::Zero, [IntPtr]::Zero, 0)
if ($rc -ne 0) { [Console]::Out.WriteLine("OPENFAIL $rc"); [Console]::Out.Flush(); exit 3 }

[Console]::Out.WriteLine('READY ' + [WinMidi]::Name($found))
[Console]::Out.Flush()

while ($null -ne ($line = [Console]::In.ReadLine())) {
  if ($line -eq 'RESET') { [void][WinMidi]::midiOutReset($handle); continue }
  $p = $line.Split(' ')
  if ($p.Length -lt 3) { continue }
  $msg = [uint32]([int]$p[0] -bor ([int]$p[1] -shl 8) -bor ([int]$p[2] -shl 16))
  [void][WinMidi]::midiOutShortMsg($handle, $msg)
}

[void][WinMidi]::midiOutReset($handle)
[void][WinMidi]::midiOutClose($handle)
