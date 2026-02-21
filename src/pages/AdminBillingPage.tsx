import { Navigate } from "react-router-dom";

export default function AdminBillingPage() {
  return <Navigate to="/admin?tab=billing" replace />;
}
