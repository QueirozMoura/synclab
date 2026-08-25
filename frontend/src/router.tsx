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
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ActivityDetailsPage } from "./pages/ActivityDetailsPage";
import { ProtectedRoute } from "./context/AuthContext";

export const router = createBrowserRouter([
  {
    Component: RootLayout,
    children: [
      {
        path: "/",
        Component: LandingPage,
      },
      { path: "/login", Component: LoginPage },
      { path: "/register", Component: RegisterPage },
      {
        path: "/app",
        element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
      },
      {
        path: "/app/activity/:activityId",
        element: <ProtectedRoute><ActivityDetailsPage /></ProtectedRoute>,
      },
      {
        path: "/app/favorites",
        element: <ProtectedRoute><FavoritesPage /></ProtectedRoute>,
      },
      {
        path: "/app/documents",
        element: <ProtectedRoute><DocumentsPage /></ProtectedRoute>,
      },
      {
        path: "/app/documents/new",
        element: <ProtectedRoute><NewDocumentRedirect /></ProtectedRoute>,
      },
      {
        path: "/app/documents/:documentId",
        element: <ProtectedRoute><EditorPage /></ProtectedRoute>,
      },
      {
        path: "/app/settings",
        element: <ProtectedRoute><SettingsPage /></ProtectedRoute>,
      },
      {
        path: "/app/help",
        element: <ProtectedRoute><HelpPage /></ProtectedRoute>,
      },
    ],
  },
]);