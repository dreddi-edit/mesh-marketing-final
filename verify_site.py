from playwright.sync_api import sync_playwright
import sys

def verify_site():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            page.goto('http://localhost:3000')
            page.wait_for_load_state('networkidle')
            title = page.title()
            print(f"Page Title: {title}")
            page.screenshot(path='homepage_screenshot.png')
            print("Screenshot saved to homepage_screenshot.png")
        except Exception as e:
            print(f"Error: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == "__main__":
    verify_site()
