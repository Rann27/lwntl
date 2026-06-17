# -*- mode: python ; coding: utf-8 -*-
"""
LWNTL PyInstaller Spec — Portable (onedir) build for Windows.
Run via build.bat or:  venv\Scripts\pyinstaller.exe lwntl.spec --clean --noconfirm
"""
from pathlib import Path

_root = Path(SPECPATH)

# pywebview 6.x ships its own PyInstaller hook — point to it explicitly.
_webview_hook = str(_root / 'venv' / 'Lib' / 'site-packages' / 'webview' / '__pyinstaller')

a = Analysis(
    [str(_root / 'main.py')],
    pathex=[str(_root)],
    binaries=[],
    datas=[
        # Bundle the pre-built React frontend
        (str(_root / 'frontend' / 'dist'), 'frontend/dist'),
    ],
    hiddenimports=[
        # pywebview picks its backend dynamically at runtime — must declare it
        'webview.platforms.winforms',
        # pywebview runtime dependencies
        'bottle',
        'proxy_tools',
        # pythonnet (used by winforms backend)
        'clr',
        'clr_loader',
    ],
    hookspath=[_webview_hook],
    hooksconfig={},
    runtime_hooks=[],
    # Trim unused stdlib modules to reduce size
    excludes=['tkinter', 'unittest', 'pydoc', 'difflib', 'doctest', 'optparse'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='LWNTL',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,          # UPX off — avoids false-positive AV flags
    console=False,      # No black console window
    icon=None,          # TODO: add icon=r'assets\icon.ico' when available
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name='LWNTL',       # Output folder: dist\LWNTL\
)
