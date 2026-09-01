export default async function run(page) {
  await page.evaluate(() =>
    localStorage.setItem(
      "synclab_offline_auth_user",
      JSON.stringify({
        id: "qa",
        email: "qa@synclab.test",
        name: "QA",
        avatarUrl: null,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      }),
    ),
  );
  const routes = [
    "/app/favorites",
    "/app",
    "/app/documents",
    "/app/sync",
    "/app/settings",
  ];
  const result = [];
  for (const route of routes) {
    await page.goto("http://localhost:5175" + route);
    await page.waitForTimeout(300);
    result.push({
      route,
      actualPath: await page.evaluate(() => location.pathname),
      globalSidebars: await page.locator(".global-sidebar").count(),
      topbars: await page.locator(".global-mobile-topbar").count(),
      dashboardSidebars: await page.locator(".dashboard-sidebar").count(),
      favoritesHeading: await page
        .getByRole("heading", { name: "Favoritos", level: 1 })
        .count(),
      bodyChars: await page
        .locator("body")
        .innerText()
        .then((text) => text.length),
    });
  }
  return result;
}
