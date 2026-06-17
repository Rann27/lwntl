"""
LWNTL - LN/WN Translator
PyWebView entry point
"""

import sys
import io
import webview
from pathlib import Path
from api import API

# Force UTF-8 on stdout/stderr — PyInstaller windowed exe uses cp1252 by default
# which crashes on Japanese/Unicode chars (→, ♪, etc.) in translation logs.
for _s in ('stdout', 'stderr'):
    _stream = getattr(sys, _s, None)
    if _stream is None:
        continue
    if hasattr(_stream, 'reconfigure'):
        try:
            _stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass
    elif hasattr(_stream, 'buffer'):
        setattr(sys, _s, io.TextIOWrapper(_stream.buffer, encoding='utf-8', errors='replace'))

# Configuration
DEBUG = False  # Set to True to use Vite dev server instead of built dist
WINDOW_TITLE = "LWNTL - LN/WN Translator"
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 800


def get_base_dir() -> Path:
    """Return correct base directory for both normal and PyInstaller-frozen runs."""
    if getattr(sys, 'frozen', False):
        return Path(sys._MEIPASS)
    return Path(__file__).parent.resolve()


def get_html_file():
    """
    Determine which HTML file to serve:
    - DEBUG=True: Use Vite dev server URL
    - DEBUG=False: Use built index.html from dist/
    """
    if DEBUG:
        return "http://localhost:5174/"
    else:
        html_file = get_base_dir() / "frontend" / "dist" / "index.html"

        if not html_file.exists():
            raise FileNotFoundError(
                f"Built frontend not found at {html_file}.\n"
                "Run 'npm run build' in the frontend directory first."
            )

        return html_file.as_uri()


def main():
    """Main entry point for PyWebView application"""
    
    # Get HTML file or URL
    try:
        html_file = get_html_file()
    except FileNotFoundError as e:
        print(f"ERROR: {e}")
        print("Please build the frontend first:")
        print("  cd frontend")
        print("  npm run build")
        input("Press Enter to exit...")
        return
    
    if DEBUG:
        print("=" * 60)
        print("LWNTL - DEBUG MODE")
        print("=" * 60)
        print("Make sure Vite dev server is running:")
        print("  cd frontend")
        print("  npm run dev")
        print("=" * 60)
    else:
        print("LWNTL - Starting application...")
        print(f"Loading frontend from: {html_file}")
    
    # Create API instance (no window reference yet)
    api = API()
    
    # Create PyWebView window with API exposed via js_api
    window = webview.create_window(
        title=WINDOW_TITLE,
        url=html_file,
        js_api=api,
        width=WINDOW_WIDTH,
        height=WINDOW_HEIGHT,
        background_color="#F8F3EA"
    )
    
    # Set window reference on API after creation
    api.set_window(window)
    
    # Start the application
    webview.start(debug=False)


if __name__ == '__main__':
    main()