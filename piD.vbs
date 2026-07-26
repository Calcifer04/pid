' Double-click on Windows to open piD as an app window (no console flash).
Option Explicit
Dim sh, fso, root, ps1
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = root & "\scripts\launch.ps1"
sh.CurrentDirectory = root
' 0 = hidden window, False = don't wait
sh.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & ps1 & """", 0, False
