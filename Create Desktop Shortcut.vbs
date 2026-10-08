Set objShell = CreateObject("WScript.Shell")
strDesktop = objShell.SpecialFolders("Desktop")
Set objShortcut = objShell.CreateShortcut(strDesktop & "\StreamOps.lnk")
objShortcut.TargetPath = objShell.CurrentDirectory & "\Start-StreamOps.bat"
objShortcut.WorkingDirectory = objShell.CurrentDirectory
objShortcut.IconLocation = "%SystemRoot%\System32\SHELL32.dll,220"
objShortcut.Description = "Launch StreamOps"
objShortcut.Save
MsgBox "Desktop shortcut created!", 64, "StreamOps"
