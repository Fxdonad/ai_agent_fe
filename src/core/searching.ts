import { chromium } from "playwright";

async function performWebSearch(query: string) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(
    `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  );

  const results = await page.evaluate(() => {
    // Lấy danh sách các thẻ kết quả của Google
    const items = Array.from(document.querySelectorAll(".g")).slice(0, 3);

    return items.map((item) => {
      // Ép kiểu sang HTMLElement để truy cập innerText
      const titleEl = item.querySelector("h3") as HTMLElement | null;
      const snippetEl = item.querySelector(".VwiC3b") as HTMLElement | null;

      return {
        title: titleEl?.innerText || "No Title",
        snippet: snippetEl?.innerText || "No Snippet",
      };
    });
  });

  await browser.close();
  return JSON.stringify(results);
}
