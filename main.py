"""
LWNTL - LN/WN Translator
PyWebView entry point
"""

import webview
from pathlib import Path
from api import API

# Configuration
DEBUG = False  # Set to True to use Vite dev server instead of built dist
WINDOW_TITLE = "LWNTL - LN/WN Translator"
WINDOW_WIDTH = 1280
WINDOW_HEIGHT = 800


def get_html_file():
    """
    Determine which HTML file to serve:
    - DEBUG=True: Use Vite dev server URL
    - DEBUG=False: Use built index.html from dist/
    """
    if DEBUG:
        return "http://localhost:5174/"
    else:
        # Get the absolute path to frontend/dist/index.html
        current_dir = Path(__file__).parent.resolve()
        html_file = current_dir / "frontend" / "dist" / "index.html"
        
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