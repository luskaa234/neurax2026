import { Navigate } from "react-router-dom";

export default function AdminProjectsPage() {
  return <Navigate to="/admin?tab=projects" replace />;
}
