import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { DocumentsProvider } from "./context/DocumentsContext";
import { OperationManagerProvider } from "./context/OperationManagerContext";

function App() {
  return (
    <OperationManagerProvider>
      <DocumentsProvider>
        <RouterProvider router={router} />
      </DocumentsProvider>
    </OperationManagerProvider>
  );
}

export default App;
