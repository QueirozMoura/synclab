import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { DocumentsProvider } from "./context/DocumentsContext";
import { OperationManagerProvider } from "./context/OperationManagerContext";
import { HttpSyncTransport } from "./lib/httpSyncTransport";

const syncApiBaseUrl = import.meta.env.VITE_SYNC_API_BASE_URL ?? "";
const appSyncTransport = new HttpSyncTransport(syncApiBaseUrl);

function App() {
  return (
    <OperationManagerProvider transport={appSyncTransport}>
      <DocumentsProvider>
        <RouterProvider router={router} />
      </DocumentsProvider>
    </OperationManagerProvider>
  );
}

export default App;
