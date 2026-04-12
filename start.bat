@echo off
:: Nightreign Overlay launcher
:: Drop this path into Steam → Right-click game → Properties → Launch Options:
::   cmd /c "C:\path\to\Nightreign\start.bat" && %command%
::
:: Or use it as a desktop shortcut target:
::   cmd /c "C:\path\to\Nightreign\start.bat"
::
:: The overlay will automatically show when the game starts and hide when it exits.

cd /d "%~dp0"
start "" npx electron .
