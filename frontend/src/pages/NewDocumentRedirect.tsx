import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDocuments } from "../hooks/useDocuments";

export const NewDocumentRedirect: React.FC = () => {
  const navigate = useNavigate();
  const { createDocument } = useDocuments();

  useEffect(() => {
    const document = createDocument();
    navigate(`/app/documents/${document.id}`, { replace: true });
  }, [createDocument, navigate]);

  return null;
};