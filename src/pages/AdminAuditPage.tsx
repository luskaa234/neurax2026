import { Navigate } from "react-router-dom";

export default function AdminAuditPage() {
  return <Navigate to="/admin?tab=audit" replace />;
}
