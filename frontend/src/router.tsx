import { createBrowserRouter } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";
import { HelpPage } from "./pages/HelpPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EditorPage } from "./pages/EditorPage";
import { NewDocumentRedirect } from "./pages/NewDocumentRedirect";
import { FavoritesPage } from "./pages/FavoritesPage";
import { RootLayout } from "./components/RootLayout";

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        path: "/",
        Component: LandingPage,
      },
      {
        path: "/app",
        Component: DashboardPage,
      },
      {
        path: "/app/favorites",
        Component: FavoritesPage,
      },
      {
        path: "/app/documents",
        Component: DocumentsPage,
      },
      {
        path: "/app/documents/new",
        Component: NewDocumentRedirect,
      },
      {
        path: "/app/documents/:documentId",
        Component: EditorPage,
      },
      {
        path: "/app/settings",
        Component: SettingsPage,
      },
      {
        path: "/app/help",
        Component: HelpPage,
      },
    ],
  },
]);