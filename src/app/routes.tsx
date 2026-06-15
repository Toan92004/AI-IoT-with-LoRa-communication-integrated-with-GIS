import { createBrowserRouter } from "react-router";
import { AdminDashboard } from "./pages/AdminDashboard";
import MobileFieldWorker from "./pages/MobileFieldWorker";
import Login from "./pages/Login";
import Register from "./pages/Register";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: AdminDashboard,
  },
  {
    path: "/mobile",
    Component: MobileFieldWorker,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/register",
    Component: Register,
  },
]);
