import "./index.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { DocumentsProvider } from "./context/DocumentsContext";

function App() {
  return (
    <DocumentsProvider>
      <RouterProvider router={router} />
    </DocumentsProvider>
  );
}

export default App;
