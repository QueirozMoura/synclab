import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { DocumentsProvider } from "./context/DocumentsContext";
import { AuthProvider } from "./context/AuthContext";
import { OperationManagerProvider } from "./context/OperationManagerContext";
import { HttpSyncTransport } from "./lib/httpSyncTransport";

const syncApiBaseUrl = import.meta.env.VITE_SYNC_API_BASE_URL ?? "http://localhost:3000";
const appSyncTransport = new HttpSyncTransport(syncApiBaseUrl);

function App() {
  return (
    <OperationManagerProvider transport={appSyncTransport}>
      <AuthProvider>
        <DocumentsProvider>
          <RouterProvider router={router} />
        </DocumentsProvider>
      </AuthProvider>
    </OperationManagerProvider>
  );
}

export default App;
