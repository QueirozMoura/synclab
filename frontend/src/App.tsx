import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { DocumentsProvider } from "./context/DocumentsContext";
import { OperationManagerProvider } from "./context/OperationManagerContext";

function App() {
  return (
    <DocumentsProvider>
      <OperationManagerProvider>
        <RouterProvider router={router} />
      </OperationManagerProvider>
    </DocumentsProvider>
  );
}

export default App;
