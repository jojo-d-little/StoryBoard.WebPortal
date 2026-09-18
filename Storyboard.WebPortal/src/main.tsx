import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { loadWebPortalSettings } from "./settings/webPortalSettings";
import "./styles.css";

async function bootstrap(): Promise<void> {
  const settings = await loadWebPortalSettings();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App initialSettings={settings} />
    </React.StrictMode>
  );
}

void bootstrap();
