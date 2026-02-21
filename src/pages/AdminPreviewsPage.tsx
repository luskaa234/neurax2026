import { Navigate } from "react-router-dom";

export default function AdminPreviewsPage() {
  return <Navigate to="/admin?tab=previews" replace />;
}
