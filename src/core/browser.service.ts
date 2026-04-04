import { chromium } from "playwright";

export class BrowserService {
  async search(query: string): Promise<string> {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
      await page.goto(
        `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      );
      const results = await page.evaluate(() => {
        return Array.from(document.querySelectorAll(".g"))
          .slice(0, 3)
          .map((item) => ({
            title: (item.querySelector("h3") as HTMLElement)?.innerText,
            snippet: (item.querySelector(".VwiC3b") as HTMLElement)?.innerText,
          }));
      });
      return JSON.stringify(results);
    } finally {
      await browser.close();
    }
  }
}
