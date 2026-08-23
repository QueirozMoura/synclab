import { useEffect, useState } from "react";

const getInitialOnlineState = (): boolean => {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
};

export const useConnectivity = (): boolean => {
  const [online, setOnline] = useState(getInitialOnlineState);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
};
