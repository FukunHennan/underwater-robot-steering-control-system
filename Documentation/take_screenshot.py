"""Take dashboard screenshots with white theme using Playwright
- 2x device scale for crisp text
- Viewport-only (not full_page) for clarity
"""
from playwright.sync_api import sync_playwright
import os

output_dir = os.path.join(os.path.dirname(__file__), 'diagrams', 'png')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 2x scale for Retina-level clarity
    ctx = browser.new_context(
        viewport={'width': 1440, 'height': 900},
        device_scale_factor=2
    )
    page = ctx.new_page()

    page.goto('http://localhost:5173/?mock=1')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(2000)

    # Screenshot 1: Dashboard top area (header + system/attitude/3D + ADC/baro/waveform)
    page.screenshot(
        path=os.path.join(output_dir, 'Dashboard界面截图.png'),
        full_page=False
    )
    print('[OK] Dashboard界面截图.png (1440x900 @2x)')

    # Screenshot 2: Scroll down to show attitude waveform clearly
    page.evaluate('window.scrollTo(0, 0)')
    page.wait_for_timeout(500)
    page.screenshot(
        path=os.path.join(output_dir, '姿态数据显示界面.png'),
        full_page=False
    )
    print('[OK] 姿态数据显示界面.png (1440x900 @2x)')

    browser.close()
    print('Done!')
