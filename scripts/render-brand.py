"""Render the original FramePilot SVG sources to PNG with system Chromium.
Development only: requires Python Playwright. No dependencies in the extension.
Run from any directory: python scripts/render-brand.py
"""
import asyncio
from pathlib import Path
from playwright.async_api import async_playwright
ROOT = Path(__file__).resolve().parents[1]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(executable_path='/usr/bin/chromium', headless=True, args=['--no-sandbox'])
        page = await browser.new_page()
        async def render(svg, width, height, destination):
            await page.set_viewport_size({'width': width, 'height': height})
            await page.set_content('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>' + svg)
            await page.screenshot(path=str(destination), omit_background=True)
        mark = (ROOT / 'brand/mark.svg').read_text()
        for size in [16, 32, 48, 128]:
            await render(mark, size, size, ROOT / f'icons/icon-{size}.png')
        for size in [256, 512, 1024]:
            await render(mark, size, size, ROOT / f'brand/mark-{size}.png')
        for name in ['logo-light', 'logo-dark']:
            await render((ROOT / f'brand/{name}.svg').read_text(), 1440, 320, ROOT / f'brand/{name}.png')
        for name in ['mark-transparent','mark-white']:
            await render((ROOT / f'brand/{name}.svg').read_text(), 1024, 1024, ROOT / f'brand/{name}.png')
        for name, width, height in [('promo-small', 440, 280), ('promo-marquee', 1400, 560)]:
            await render((ROOT / f'brand/{name}.svg').read_text(), width, height, ROOT / f'brand/{name}.png')
        await browser.close()
        print('Rendered Chrome icons and FramePilot brand PNGs from SVG masters.')

if __name__ == '__main__':
    asyncio.run(main())
