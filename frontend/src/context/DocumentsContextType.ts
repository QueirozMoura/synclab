import { createContext } from "react";
import type { DocumentsContextType } from "./DocumentsContext";

export const DocumentsContext = createContext<DocumentsContextType | undefined>(undefined);