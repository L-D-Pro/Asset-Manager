import { createRoot } from "react-dom/client";
import App from "./App";
import "@workspace/ui-core/styles/tokens.css";
import "@workspace/ui-core/styles/glass.css";
import "@workspace/ui-core/styles/utilities.css";


import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
